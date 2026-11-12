import httpx
from app.core.config import settings
from typing import Optional, Dict, List
from datetime import datetime
import uuid

class SupabaseService:
    """
    Service for interacting with Supabase database via REST API
    Handles: sessions, messages, code history, execution results
    """
    
    def __init__(self):
        self.base_url = settings.SUPABASE_URL
        self.api_key = settings.SUPABASE_KEY
        self.headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    
    def is_available(self) -> bool:
        """Check if Supabase is configured"""
        return bool(self.base_url and self.api_key and 
                   self.api_key != "your_anon_key_here")
    
    # ==================== CODE EMBEDDINGS (RAG) ====================
    
    async def save_code_embedding(
        self,
        file_id: str,
        file_path: str,
        language: str,
        code_content: str,
        embedding: List[float],
        content_hash: str
    ) -> Optional[str]:
        """Save or update code embedding for RAG (upsert)"""
        if not self.is_available():
            print("⚠️ Supabase not available")
            return None
        
        try:
            # Check if embedding already exists for this file
            async with httpx.AsyncClient() as client:
                check_response = await client.get(
                    f"{self.base_url}/rest/v1/code_embeddings",
                    headers=self.headers,
                    params={"file_id": f"eq.{file_id}"},
                    timeout=30.0
                )
                
                existing = check_response.json() if check_response.status_code == 200 else []
                
                if existing:
                    # Update existing embedding
                    embedding_id = existing[0]['id']
                    data = {
                        "file_path": file_path,
                        "language": language,
                        "code_content": code_content,
                        "embedding": embedding,
                        "content_hash": content_hash
                    }
                    
                    response = await client.patch(
                        f"{self.base_url}/rest/v1/code_embeddings?id=eq.{embedding_id}",
                        headers=self.headers,
                        json=data,
                        timeout=30.0
                    )
                    
                    if response.status_code in [200, 204]:
                        print(f"✅ Updated embedding for: {file_path}")
                        return embedding_id
                    else:
                        print(f"❌ Failed to update embedding: {response.status_code} - {response.text}")
                        return None
                else:
                    # Create new embedding
                    embedding_id = str(uuid.uuid4())
                    data = {
                        "id": embedding_id,
                        "file_id": file_id,
                        "file_path": file_path,
                        "language": language,
                        "code_content": code_content,
                        "embedding": embedding,
                        "content_hash": content_hash
                    }
                    
                    response = await client.post(
                        f"{self.base_url}/rest/v1/code_embeddings",
                        headers=self.headers,
                        json=data,
                        timeout=30.0
                    )
                    
                    if response.status_code in [200, 201]:
                        print(f"✅ Created embedding for: {file_path}")
                        return embedding_id
                    else:
                        print(f"❌ Failed to create embedding: {response.status_code} - {response.text}")
                        return None
                    
        except Exception as e:
            print(f"❌ Error saving embedding: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def get_project_embeddings(self, project_id: str) -> List[Dict]:
        """Get all embeddings for a project"""
        if not self.is_available():
            return []
        
        try:
            # First get all file IDs for this project
            async with httpx.AsyncClient() as client:
                files_response = await client.get(
                    f"{self.base_url}/rest/v1/files",
                    headers=self.headers,
                    params={"project_id": f"eq.{project_id}", "select": "id"},
                    timeout=30.0
                )
                
                if files_response.status_code != 200:
                    return []
                
                file_ids = [f['id'] for f in files_response.json()]
                
                if not file_ids:
                    return []
                
                # Get embeddings for these files
                embeddings_response = await client.get(
                    f"{self.base_url}/rest/v1/code_embeddings",
                    headers=self.headers,
                    params={"file_id": f"in.({','.join(file_ids)})"},
                    timeout=30.0
                )
                
                if embeddings_response.status_code == 200:
                    embeddings = embeddings_response.json()
                    
                    # Debug: Check embedding format
                    if embeddings and len(embeddings) > 0:
                        first_emb = embeddings[0].get('embedding')
                        if first_emb:
                            emb_type = type(first_emb).__name__
                            if isinstance(first_emb, str):
                                print(f"⚠️ Embeddings are stored as strings, need to parse")
                                # Parse string embeddings to arrays
                                import json
                                for emb in embeddings:
                                    if isinstance(emb.get('embedding'), str):
                                        try:
                                            emb['embedding'] = json.loads(emb['embedding'])
                                        except:
                                            print(f"❌ Failed to parse embedding for {emb.get('file_path')}")
                            elif isinstance(first_emb, list):
                                print(f"✅ Embeddings are already arrays (length: {len(first_emb)})")
                            else:
                                print(f"⚠️ Unknown embedding type: {emb_type}")
                    
                    return embeddings
                else:
                    return []
                    
        except Exception as e:
            print(f"Error getting project embeddings: {e}")
            return []
    
    # ==================== SESSIONS ====================
    
    async def create_session(self, user_id: Optional[str] = None, language: str = "javascript", file_path: str = "main.js") -> Optional[str]:
        """Create a new tutor session"""
        if not self.is_available():
            print("❌ Supabase not available - check SUPABASE_URL and SUPABASE_KEY")
            return None
        
        try:
            session_id = str(uuid.uuid4())
            data = {
                "id": session_id,
                "user_id": user_id,  # NULL for anonymous users
                "file_path": file_path,
                "language": language,
                "model_type": "gemini",
                "started_at": datetime.utcnow().isoformat(),
                "message_count": 0
            }
            
            print(f"Creating session with ID: {session_id}")
            print(f"URL: {self.base_url}/rest/v1/tutor_sessions")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/rest/v1/tutor_sessions",
                    headers=self.headers,
                    json=data,
                    timeout=10.0
                )
                
                print(f"Session creation response: {response.status_code}")
                print(f"Response body: {response.text}")
                
                if response.status_code in [200, 201]:
                    print(f"✅ Session created successfully: {session_id}")
                    return session_id
                else:
                    print(f"❌ Error creating session: {response.status_code} - {response.text}")
                    return None
        except Exception as e:
            print(f"❌ Exception creating session: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def end_session(self, session_id: str):
        """Mark session as ended"""
        if not self.is_available():
            return
        
        try:
            data = {
                "ended_at": datetime.utcnow().isoformat()
            }
            
            async with httpx.AsyncClient() as client:
                await client.patch(
                    f"{self.base_url}/rest/v1/tutor_sessions?id=eq.{session_id}",
                    headers=self.headers,
                    json=data,
                    timeout=10.0
                )
        except Exception as e:
            print(f"Error ending session: {e}")
    
    async def update_session_context(self, session_id: str, language: str, file_path: str):
        """Update session language and file path"""
        if not self.is_available():
            return
        
        try:
            data = {
                "language": language,
                "file_path": file_path
            }
            
            async with httpx.AsyncClient() as client:
                await client.patch(
                    f"{self.base_url}/rest/v1/tutor_sessions?id=eq.{session_id}",
                    headers=self.headers,
                    json=data,
                    timeout=10.0
                )
                print(f"✅ Session context updated: {language} - {file_path}")
        except Exception as e:
            print(f"Error updating session context: {e}")
    
    # ==================== MESSAGES ====================
    
    async def save_message(
        self,
        session_id: str,
        role: str,
        content: str,
        code_context: Optional[str] = None,
        execution_context: Optional[Dict] = None
    ) -> Optional[str]:
        """Save a chat message with context"""
        if not self.is_available():
            return None
        
        try:
            message_id = str(uuid.uuid4())
            data = {
                "id": message_id,
                "session_id": session_id,
                "role": role,
                "content": content,
                "code_context": code_context,
                "execution_context": execution_context,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            print(f"Attempting to save message...")
            print(f"Data: {data}")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/rest/v1/tutor_messages",
                    headers=self.headers,
                    json=data,
                    timeout=10.0
                )
                
                print(f"Message save response: {response.status_code}")
                print(f"Response body: {response.text}")
                
                if response.status_code in [200, 201]:
                    print(f"✅ Message saved successfully: {message_id}")
                    return message_id
                else:
                    print(f"❌ Error saving message: {response.status_code} - {response.text}")
                    return None
        except Exception as e:
            print(f"❌ Exception saving message: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def get_session_messages(self, session_id: str, limit: int = 50) -> List[Dict]:
        """Get all messages for a session"""
        if not self.is_available():
            return []
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/rest/v1/tutor_messages?session_id=eq.{session_id}&order=timestamp.asc&limit={limit}",
                    headers=self.headers,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    return response.json()
                return []
        except Exception as e:
            print(f"Error getting messages: {e}")
            return []
    
    # ==================== CODE HISTORY ====================
    
    async def save_code_snapshot(
        self,
        session_id: str,
        code: str,
        language: str,
        file_path: str,
        execution_output: Optional[str] = None,
        execution_error: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Optional[str]:
        """Save a code snapshot with execution results"""
        if not self.is_available():
            print("Supabase not available - check SUPABASE_URL and SUPABASE_KEY in .env")
            return None
        
        try:
            snapshot_id = str(uuid.uuid4())
            
            # Build errors array from execution_error
            errors = []
            if execution_error:
                errors.append(execution_error)
            
            data = {
                "id": snapshot_id,
                "user_id": user_id,
                "file_path": file_path,
                "language": language,
                "code_content": code,
                "errors": errors,
                "cursor_line": 1,
                "cursor_column": 1
            }
            
            print(f"Attempting to save code snapshot to Supabase...")
            print(f"URL: {self.base_url}/rest/v1/code_history")
            print(f"Data: {data}")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/rest/v1/code_history",
                    headers=self.headers,
                    json=data,
                    timeout=10.0
                )
                
                print(f"Response status: {response.status_code}")
                print(f"Response body: {response.text}")
                
                if response.status_code in [200, 201]:
                    print(f"✅ Code snapshot saved successfully: {snapshot_id}")
                    return snapshot_id
                else:
                    print(f"❌ Error saving code snapshot: {response.status_code} - {response.text}")
                    return None
        except Exception as e:
            print(f"❌ Exception saving code snapshot: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def get_code_history(
        self,
        session_id: str,
        limit: int = 20
    ) -> List[Dict]:
        """Get code history for a session"""
        if not self.is_available():
            return []
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/rest/v1/code_history?session_id=eq.{session_id}&order=timestamp.desc&limit={limit}",
                    headers=self.headers,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    return response.json()
                return []
        except Exception as e:
            print(f"Error getting code history: {e}")
            return []
    
    # ==================== COMMON ERRORS ====================
    
    async def find_similar_error(self, error_message: str, language: str) -> Optional[Dict]:
        """Find similar error patterns in database"""
        if not self.is_available():
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/rest/v1/common_errors?language=eq.{language}&limit=5",
                    headers=self.headers,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data[0] if data else None
                return None
        except Exception as e:
            print(f"Error finding similar error: {e}")
            return None
    
    async def log_error_pattern(
        self,
        error_type: str,
        error_message: str,
        language: str,
        code_snippet: str,
        hint: Optional[str] = None
    ):
        """Log a new error pattern"""
        if not self.is_available():
            return
        
        try:
            data = {
                "id": str(uuid.uuid4()),
                "error_type": error_type,
                "error_message": error_message,
                "language": language,
                "code_snippet": code_snippet,
                "hint": hint,
                "frequency": 1,
                "created_at": datetime.utcnow().isoformat()
            }
            
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self.base_url}/rest/v1/common_errors",
                    headers=self.headers,
                    json=data,
                    timeout=10.0
                )
        except Exception as e:
            print(f"Error logging error pattern: {e}")

# Global instance
supabase_service = SupabaseService()

