"""
Embedding service for RAG (Retrieval-Augmented Generation)
Generates embeddings for code files and enables semantic search
Uses sentence-transformers (all-MiniLM-L6-v2) - no Ollama required!
"""
from typing import List, Dict, Optional
import hashlib

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    print("⚠️ sentence-transformers not installed. Install with: pip install sentence-transformers")

class EmbeddingService:
    """
    Service to generate embeddings for code and perform semantic search
    Uses sentence-transformers library (no Ollama needed!)
    """
    
    def __init__(self):
        self.embedding_dimension = 384  # all-MiniLM-L6-v2 dimension
        self.model = None
        
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                # Load the model (downloads automatically on first use)
                print("Loading embedding model: all-MiniLM-L6-v2...")
                self.model = SentenceTransformer('all-MiniLM-L6-v2')
                print("✅ Embedding model loaded successfully!")
            except Exception as e:
                print(f"❌ Failed to load embedding model: {e}")
                self.model = None
    
    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """
        Generate embedding vector for text using sentence-transformers
        
        Args:
            text: Text to embed
            
        Returns:
            List of floats representing the embedding vector
        """
        if not self.model:
            print("Embedding model not available")
            return None
        
        try:
            # Generate embedding
            embedding = self.model.encode(text, convert_to_numpy=True)
            return embedding.tolist()
                
        except Exception as e:
            print(f"Error generating embedding: {e}")
            return None
    
    def generate_code_embedding(self, code: str, language: str, file_path: str) -> Optional[List[float]]:
        """
        Generate embedding for code with context
        
        Args:
            code: Source code
            language: Programming language
            file_path: File path for context
            
        Returns:
            Embedding vector
        """
        # Create rich context for better embeddings
        context = f"""
File: {file_path}
Language: {language}

Code:
{code}
"""
        return self.generate_embedding(context)
    
    def chunk_code(self, code: str, max_chunk_size: int = 500) -> List[str]:
        """
        Split code into chunks for embedding
        Large files are split into smaller chunks
        
        Args:
            code: Source code
            max_chunk_size: Maximum lines per chunk
            
        Returns:
            List of code chunks
        """
        lines = code.split('\n')
        
        if len(lines) <= max_chunk_size:
            return [code]
        
        chunks = []
        current_chunk = []
        
        for line in lines:
            current_chunk.append(line)
            
            if len(current_chunk) >= max_chunk_size:
                chunks.append('\n'.join(current_chunk))
                current_chunk = []
        
        # Add remaining lines
        if current_chunk:
            chunks.append('\n'.join(current_chunk))
        
        return chunks
    
    def compute_content_hash(self, content: str) -> str:
        """
        Compute hash of content to detect changes
        
        Args:
            content: Content to hash
            
        Returns:
            SHA256 hash
        """
        return hashlib.sha256(content.encode()).hexdigest()
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            Similarity score (0-1)
        """
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = sum(a * a for a in vec1) ** 0.5
        magnitude2 = sum(b * b for b in vec2) ** 0.5
        
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        
        return dot_product / (magnitude1 * magnitude2)
    
    def search_similar_code(
        self, 
        query_embedding: List[float], 
        code_embeddings: List[Dict],
        top_k: int = 3
    ) -> List[Dict]:
        """
        Find most similar code snippets using cosine similarity
        
        Args:
            query_embedding: Query vector
            code_embeddings: List of {embedding, file_path, code, ...}
            top_k: Number of results to return
            
        Returns:
            Top K most similar code snippets with scores
        """
        results = []
        
        for item in code_embeddings:
            if 'embedding' not in item or not item['embedding']:
                continue
            
            similarity = self.cosine_similarity(query_embedding, item['embedding'])
            
            results.append({
                **item,
                'similarity': similarity
            })
        
        # Sort by similarity (highest first)
        results.sort(key=lambda x: x['similarity'], reverse=True)
        
        return results[:top_k]

# Global instance
embedding_service = EmbeddingService()
