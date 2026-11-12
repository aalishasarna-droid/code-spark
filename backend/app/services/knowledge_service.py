"""
Knowledge Hub Service
Handles file upload, text extraction, chunking, embedding, and RAG search
for uploaded study notes (PDF, TXT, MD).
"""
import hashlib
import uuid
import io
from typing import List, Dict, Optional, Tuple
from app.services.embedding_service import embedding_service
from app.services.supabase_service import supabase_service
from app.core.config import settings
import httpx

# PDF parser (optional — graceful fallback)
try:
    import fitz  # PyMuPDF
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    print("⚠️ PyMuPDF not installed. PDF upload disabled. Install with: pip install PyMuPDF")


class KnowledgeService:
    """
    Service for managing uploaded study documents.
    Extracts text, chunks it, generates embeddings, stores in Supabase,
    and enables RAG-powered Q&A with citations.
    """

    # ==================== TEXT EXTRACTION ====================

    def extract_text_from_pdf(self, file_bytes: bytes) -> List[Dict]:
        """
        Extract text from a PDF file, page by page.

        Returns:
            List of {page_number, text} dicts
        """
        if not PDF_AVAILABLE:
            raise RuntimeError("PyMuPDF is not installed. Cannot process PDF files.")

        pages = []
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text("text")
            if text.strip():
                pages.append({
                    "page_number": page_num + 1,
                    "text": text.strip()
                })
        doc.close()
        return pages

    def extract_text_from_txt(self, file_bytes: bytes) -> List[Dict]:
        """
        Extract text from a plain text or markdown file.
        Returns a single "page" since there are no page boundaries.
        """
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1")

        if not text.strip():
            return []

        return [{"page_number": 1, "text": text.strip()}]

    # ==================== CHUNKING ====================

    def chunk_text(
        self,
        pages: List[Dict],
        max_chunk_tokens: int = 500,
        overlap_tokens: int = 50
    ) -> List[Dict]:
        """
        Split extracted pages into overlapping chunks for embedding.

        Args:
            pages: List of {page_number, text}
            max_chunk_tokens: Approximate max tokens per chunk (~4 chars/token)
            overlap_tokens: Token overlap between consecutive chunks

        Returns:
            List of {chunk_index, content, page_number, section_title}
        """
        max_chars = max_chunk_tokens * 4
        overlap_chars = overlap_tokens * 4

        chunks = []
        chunk_index = 0

        for page in pages:
            text = page["text"]
            page_num = page["page_number"]

            # Split by paragraphs first
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

            current_chunk = ""
            current_section = None

            for para in paragraphs:
                # Detect section titles (lines that look like headings)
                lines = para.split("\n")
                if len(lines) == 1 and len(lines[0]) < 100 and lines[0].strip():
                    # Could be a heading
                    potential_title = lines[0].strip()
                    if potential_title.isupper() or potential_title.endswith(":"):
                        current_section = potential_title

                # Check if adding this paragraph would exceed chunk size
                if len(current_chunk) + len(para) > max_chars and current_chunk:
                    chunks.append({
                        "chunk_index": chunk_index,
                        "content": current_chunk.strip(),
                        "page_number": page_num,
                        "section_title": current_section
                    })
                    chunk_index += 1

                    # Overlap: keep last portion of current chunk
                    if len(current_chunk) > overlap_chars:
                        current_chunk = current_chunk[-overlap_chars:] + "\n\n" + para
                    else:
                        current_chunk = para
                else:
                    current_chunk = (current_chunk + "\n\n" + para).strip()

            # Don't forget the last chunk from this page
            if current_chunk.strip():
                chunks.append({
                    "chunk_index": chunk_index,
                    "content": current_chunk.strip(),
                    "page_number": page_num,
                    "section_title": current_section
                })
                chunk_index += 1

        return chunks

    # ==================== UPLOAD & PROCESS ====================

    async def upload_and_process(
        self,
        file_bytes: bytes,
        file_name: str,
        file_type: str,
        project_id: str
    ) -> Dict:
        """
        Full pipeline: extract text → chunk → embed → store in Supabase.

        Args:
            file_bytes: Raw file content
            file_name: Original filename
            file_type: 'pdf', 'txt', or 'md'
            project_id: Project to associate with

        Returns:
            Document metadata dict
        """
        document_id = str(uuid.uuid4())

        # 1. Create document record with 'processing' status
        doc_data = {
            "id": document_id,
            "project_id": project_id,
            "file_name": file_name,
            "file_type": file_type,
            "file_size_bytes": len(file_bytes),
            "status": "processing"
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{supabase_service.base_url}/rest/v1/knowledge_documents",
                headers=supabase_service.headers,
                json=doc_data,
                timeout=30.0
            )
            if response.status_code not in [200, 201]:
                raise Exception(f"Failed to create document record: {response.status_code} - {response.text}")

        try:
            # 2. Extract text
            print(f"📄 Extracting text from {file_name} ({file_type})...")
            if file_type == "pdf":
                pages = self.extract_text_from_pdf(file_bytes)
            elif file_type in ("txt", "md"):
                pages = self.extract_text_from_txt(file_bytes)
            else:
                raise ValueError(f"Unsupported file type: {file_type}")

            if not pages:
                raise ValueError("No text content found in file")

            page_count = len(pages)
            print(f"   Extracted {page_count} page(s)")

            # 3. Chunk the text
            chunks = self.chunk_text(pages)
            print(f"   Created {len(chunks)} chunks")

            # 4. Embed and store each chunk
            stored_count = 0
            for chunk in chunks:
                content = chunk["content"]
                content_hash = hashlib.sha256(content.encode()).hexdigest()

                # Generate embedding
                embedding = embedding_service.generate_embedding(content)
                if not embedding:
                    print(f"   ⚠️ Failed to embed chunk {chunk['chunk_index']}")
                    continue

                # Store in Supabase
                chunk_data = {
                    "id": str(uuid.uuid4()),
                    "document_id": document_id,
                    "chunk_index": chunk["chunk_index"],
                    "content": content,
                    "page_number": chunk.get("page_number"),
                    "section_title": chunk.get("section_title"),
                    "embedding": embedding,
                    "content_hash": content_hash
                }

                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        f"{supabase_service.base_url}/rest/v1/knowledge_chunks",
                        headers=supabase_service.headers,
                        json=chunk_data,
                        timeout=30.0
                    )
                    if resp.status_code in [200, 201]:
                        stored_count += 1
                    else:
                        print(f"   ❌ Failed to store chunk {chunk['chunk_index']}: {resp.text}")

            # 5. Update document status to 'ready'
            update_data = {
                "page_count": page_count,
                "chunk_count": stored_count,
                "status": "ready"
            }
            async with httpx.AsyncClient() as client:
                await client.patch(
                    f"{supabase_service.base_url}/rest/v1/knowledge_documents?id=eq.{document_id}",
                    headers=supabase_service.headers,
                    json=update_data,
                    timeout=30.0
                )

            print(f"✅ Document processed: {file_name} → {stored_count} chunks embedded")

            return {
                "id": document_id,
                "file_name": file_name,
                "file_type": file_type,
                "page_count": page_count,
                "chunk_count": stored_count,
                "status": "ready"
            }

        except Exception as e:
            # Mark document as error
            print(f"❌ Error processing {file_name}: {e}")
            async with httpx.AsyncClient() as client:
                await client.patch(
                    f"{supabase_service.base_url}/rest/v1/knowledge_documents?id=eq.{document_id}",
                    headers=supabase_service.headers,
                    json={"status": "error", "error_message": str(e)},
                    timeout=30.0
                )
            raise

    # ==================== DOCUMENT MANAGEMENT ====================

    async def list_documents(self, project_id: str) -> List[Dict]:
        """List all uploaded documents for a project."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{supabase_service.base_url}/rest/v1/knowledge_documents",
                    headers=supabase_service.headers,
                    params={
                        "project_id": f"eq.{project_id}",
                        "order": "created_at.desc"
                    },
                    timeout=30.0
                )
                if response.status_code == 200:
                    return response.json()
                return []
        except Exception as e:
            print(f"❌ Error listing documents: {e}")
            return []

    async def delete_document(self, document_id: str) -> bool:
        """Delete a document and all its chunks (CASCADE)."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{supabase_service.base_url}/rest/v1/knowledge_documents?id=eq.{document_id}",
                    headers=supabase_service.headers,
                    timeout=30.0
                )
                return response.status_code in [200, 204]
        except Exception as e:
            print(f"❌ Error deleting document: {e}")
            return False

    # ==================== RAG SEARCH ====================

    async def search_knowledge(
        self,
        query: str,
        project_id: str,
        top_k: int = 5
    ) -> List[Dict]:
        """
        Semantic search over uploaded knowledge chunks.

        Returns top-K chunks with similarity scores and source metadata.
        """
        # Generate query embedding
        query_embedding = embedding_service.generate_embedding(query)
        if not query_embedding:
            print("❌ Failed to generate query embedding")
            return []

        try:
            # Get all chunks for documents in this project
            async with httpx.AsyncClient() as client:
                # First get document IDs for this project
                docs_resp = await client.get(
                    f"{supabase_service.base_url}/rest/v1/knowledge_documents",
                    headers=supabase_service.headers,
                    params={
                        "project_id": f"eq.{project_id}",
                        "status": "eq.ready",
                        "select": "id,file_name"
                    },
                    timeout=30.0
                )

                if docs_resp.status_code != 200:
                    return []

                docs = docs_resp.json()
                if not docs:
                    return []

                doc_map = {d["id"]: d["file_name"] for d in docs}
                doc_ids = list(doc_map.keys())

                # Get chunks for these documents
                chunks_resp = await client.get(
                    f"{supabase_service.base_url}/rest/v1/knowledge_chunks",
                    headers=supabase_service.headers,
                    params={
                        "document_id": f"in.({','.join(doc_ids)})",
                        "select": "id,document_id,chunk_index,content,page_number,section_title,embedding"
                    },
                    timeout=60.0
                )

                if chunks_resp.status_code != 200:
                    return []

                chunks = chunks_resp.json()

            # Compute cosine similarity for each chunk
            import json
            results = []
            for chunk in chunks:
                emb = chunk.get("embedding")
                if not emb:
                    continue

                # Parse embedding if stored as string
                if isinstance(emb, str):
                    try:
                        emb = json.loads(emb)
                    except:
                        continue

                similarity = embedding_service.cosine_similarity(query_embedding, emb)

                results.append({
                    "chunk_id": chunk["id"],
                    "document_id": chunk["document_id"],
                    "file_name": doc_map.get(chunk["document_id"], "Unknown"),
                    "chunk_index": chunk["chunk_index"],
                    "content": chunk["content"],
                    "page_number": chunk.get("page_number"),
                    "section_title": chunk.get("section_title"),
                    "similarity": similarity
                })

            # Sort by similarity (highest first)
            results.sort(key=lambda x: x["similarity"], reverse=True)
            return results[:top_k]

        except Exception as e:
            print(f"❌ Error searching knowledge: {e}")
            return []

    def format_context_with_refs(self, search_results: List[Dict]) -> Tuple[str, List[Dict]]:
        """
        Format search results into context string + structured references.

        Returns:
            (context_string, references_list)
        """
        if not search_results:
            return "", []

        context = "## Relevant Content from Uploaded Notes:\n\n"
        references = []

        for i, result in enumerate(search_results, 1):
            file_name = result.get("file_name", "Unknown")
            page_num = result.get("page_number")
            section = result.get("section_title", "")
            content = result.get("content", "")
            similarity = result.get("similarity", 0)

            page_info = f" — Page {page_num}" if page_num else ""
            section_info = f" ({section})" if section else ""

            context += f"### [{i}] {file_name}{page_info}{section_info}\n"
            context += f"Relevance: {similarity:.0%}\n"
            context += f"```\n{content}\n```\n\n"

            references.append({
                "index": i,
                "file_name": file_name,
                "page_number": page_num,
                "section_title": section,
                "chunk_text": content[:300] + ("..." if len(content) > 300 else ""),
                "relevance": round(similarity, 3)
            })

        return context, references

    # ==================== CHAT WITH KNOWLEDGE ====================

    async def chat_with_knowledge(
        self,
        query: str,
        project_id: str,
        chat_history: List[Dict] = None,
        top_k: int = 5
    ) -> Dict:
        """
        Full RAG chat pipeline:
        1. Search knowledge base for relevant chunks
        2. Build prompt with context + citations
        3. Call Gemma (Ollama) to generate answer
        4. Return response with structured references

        Args:
            query: User's question
            project_id: Project ID
            chat_history: Previous messages [{role, content}, ...]
            top_k: Number of chunks to retrieve

        Returns:
            {response, references, chunks_used}
        """
        # 1. Search for relevant chunks
        search_results = await self.search_knowledge(query, project_id, top_k=top_k)

        # 2. Format context with references
        context, references = self.format_context_with_refs(search_results)

        # 3. Build the prompt
        prompt = self._build_chat_prompt(query, context, references, chat_history)

        # 4. Call Gemma via Ollama
        try:
            ollama_url = f"{settings.OLLAMA_BASE_URL}/api/generate"
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    ollama_url,
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "prompt": prompt,
                        "stream": False
                    }
                )

                if response.status_code == 200:
                    result = response.json()
                    ai_response = result.get("response", "")
                else:
                    ai_response = "I'm having trouble generating a response right now. Please try again."
                    print(f"❌ Ollama returned {response.status_code}: {response.text}")

        except Exception as e:
            print(f"❌ Error calling Ollama: {e}")
            ai_response = "The AI model is currently unavailable. Please ensure Ollama is running."

        return {
            "response": ai_response,
            "references": references,
            "chunks_used": len(search_results)
        }

    def _build_chat_prompt(
        self,
        query: str,
        context: str,
        references: List[Dict],
        chat_history: List[Dict] = None
    ) -> str:
        """Build a RAG-augmented prompt for the knowledge chat."""
        system = """You are an intelligent study assistant. The student has uploaded their notes and is asking questions about them.

RULES:
1. Answer based ONLY on the provided note excerpts below. If the answer isn't in the notes, say so.
2. When referencing information, cite the source using [1], [2], etc. matching the reference numbers.
3. Be clear, concise, and educational.
4. If the student asks about something related to code, explain the concept and mention which part of their notes covers it.
5. Format your response with clear structure (bullet points, bold for key terms).
6. At the end of your response, add a "📚 Study References" section listing which files and pages to review.

"""
        # Add chat history for context
        history_text = ""
        if chat_history:
            for msg in chat_history[-6:]:  # Last 6 messages for context
                role = msg.get("role", "user")
                content = msg.get("content", "")
                history_text += f"\n{'Student' if role == 'user' else 'Assistant'}: {content}\n"

        prompt = system

        if history_text:
            prompt += f"\n## Previous Conversation:\n{history_text}\n"

        if context:
            prompt += f"\n{context}\n"
        else:
            prompt += "\n[No relevant notes found for this query.]\n"

        prompt += f"\n## Student's Question:\n{query}\n"
        prompt += "\nProvide a helpful, cited response:"

        return prompt


# Global instance
knowledge_service = KnowledgeService()
