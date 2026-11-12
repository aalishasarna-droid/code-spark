"""
RAG (Retrieval-Augmented Generation) Service
Retrieves relevant code context for AI responses
"""
from typing import List, Dict, Optional
from app.services.embedding_service import embedding_service
from app.services.supabase_service import supabase_service
from app.services.file_service import file_service

class RAGService:
    """
    Service for Retrieval-Augmented Generation
    Finds relevant code context for user queries
    """
    
    async def index_project_files(self, project_id: str) -> Dict:
        """
        Generate and store embeddings for all files in a project
        Smart indexing: Only re-embeds files that changed
        
        Args:
            project_id: Project ID
            
        Returns:
            Status dict with counts
        """
        try:
            # Get all files in project
            files = await file_service.get_project_files(project_id)
            
            indexed_count = 0
            skipped_count = 0
            updated_count = 0
            error_count = 0
            
            # Get existing embeddings
            existing_embeddings = {}
            if supabase_service.is_available():
                embeddings = await supabase_service.get_project_embeddings(project_id)
                for emb in embeddings:
                    existing_embeddings[emb['file_id']] = emb.get('content_hash')
            
            for file in files:
                # Skip folders
                if file.get('is_folder', False):
                    skipped_count += 1
                    continue
                
                # Skip empty files
                if not file.get('content'):
                    skipped_count += 1
                    continue
                
                try:
                    # Check if file already has embedding with same content
                    content_hash = embedding_service.compute_content_hash(file['content'])
                    
                    if file['id'] in existing_embeddings:
                        if existing_embeddings[file['id']] == content_hash:
                            # Content unchanged, skip
                            skipped_count += 1
                            print(f"⏭️  Skipped (unchanged): {file['path']}")
                            continue
                        else:
                            # Content changed, will update
                            print(f"🔄 Updating: {file['path']}")
                    
                    # Generate embedding
                    embedding = embedding_service.generate_code_embedding(
                        code=file['content'],
                        language=file['language'],
                        file_path=file['path']
                    )
                    
                    if embedding and supabase_service.is_available():
                        # Store in database
                        await supabase_service.save_code_embedding(
                            file_id=file['id'],
                            file_path=file['path'],
                            language=file['language'],
                            code_content=file['content'],
                            embedding=embedding,
                            content_hash=content_hash
                        )
                        
                        if file['id'] in existing_embeddings:
                            updated_count += 1
                            print(f"✅ Updated: {file['path']}")
                        else:
                            indexed_count += 1
                            print(f"✅ Indexed: {file['path']}")
                    else:
                        error_count += 1
                        
                except Exception as e:
                    print(f"Error indexing file {file['path']}: {e}")
                    error_count += 1
            
            return {
                'success': True,
                'indexed': indexed_count,
                'updated': updated_count,
                'skipped': skipped_count,
                'errors': error_count,
                'total': len(files)
            }
            
        except Exception as e:
            print(f"Error indexing project: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def search_codebase(
        self, 
        query: str, 
        project_id: str,
        top_k: int = 3
    ) -> List[Dict]:
        """
        Search codebase for relevant code snippets
        
        Args:
            query: User's question
            project_id: Project ID to search in
            top_k: Number of results
            
        Returns:
            List of relevant code snippets with context
        """
        try:
            # Generate embedding for query
            query_embedding = embedding_service.generate_embedding(query)
            
            if not query_embedding:
                print("Failed to generate query embedding")
                return []
            
            # Get all embeddings for this project
            if not supabase_service.is_available():
                print("Supabase not available")
                return []
            
            embeddings = await supabase_service.get_project_embeddings(project_id)
            
            if not embeddings:
                print(f"No embeddings found for project {project_id}")
                return []
            
            # Search for similar code
            results = embedding_service.search_similar_code(
                query_embedding=query_embedding,
                code_embeddings=embeddings,
                top_k=top_k
            )
            
            return results
            
        except Exception as e:
            print(f"Error searching codebase: {e}")
            return []
    
    def format_context_for_ai(self, search_results: List[Dict]) -> str:
        """
        Format search results into context for AI
        
        Args:
            search_results: Results from search_codebase
            
        Returns:
            Formatted context string
        """
        if not search_results:
            return ""
        
        context = "## Relevant Code from Codebase:\n\n"
        
        for i, result in enumerate(search_results, 1):
            similarity = result.get('similarity', 0)
            file_path = result.get('file_path', 'unknown')
            language = result.get('language', 'unknown')
            code = result.get('code_content', '')
            
            context += f"### {i}. {file_path} (relevance: {similarity:.2%})\n"
            context += f"Language: {language}\n"
            context += f"```{language}\n{code}\n```\n\n"
        
        return context
    
    async def get_rag_context(
        self,
        query: str,
        project_id: str,
        current_file_content: Optional[str] = None,
        current_file_path: Optional[str] = None
    ) -> str:
        """
        Get complete RAG context for AI query
        
        Args:
            query: User's question
            project_id: Project ID
            current_file_content: Content of currently open file
            current_file_path: Path of currently open file
            
        Returns:
            Formatted context string
        """
        context_parts = []
        
        # Add current file context
        if current_file_content and current_file_path:
            context_parts.append(f"## Current File: {current_file_path}\n```\n{current_file_content}\n```\n")
        
        # Search codebase for relevant files
        search_results = await self.search_codebase(query, project_id, top_k=3)
        
        if search_results:
            context_parts.append(self.format_context_for_ai(search_results))
        
        return "\n".join(context_parts)

# Global instance
rag_service = RAGService()
