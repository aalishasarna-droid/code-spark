import httpx
from app.core.config import settings
from typing import Optional, Dict, List
from datetime import datetime
import uuid

class FileService:
    """
    Service for managing files and projects
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
    
    # ==================== PROJECTS ====================
    
    async def create_project(self, name: str, description: str = "", user_id: Optional[str] = None) -> Optional[Dict]:
        """Create a new project"""
        if not self.is_available():
            return None
        
        try:
            project_id = str(uuid.uuid4())
            data = {
                "id": project_id,
                "user_id": user_id,
                "name": name,
                "description": description
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/rest/v1/projects",
                    headers=self.headers,
                    json=data,
                    timeout=10.0
                )
                
                if response.status_code in [200, 201]:
                    return response.json()[0] if response.json() else None
                return None
        except Exception as e:
            print(f"Error creating project: {e}")
            return None
    
    async def get_projects(self, user_id: Optional[str] = None, limit: int = 50) -> List[Dict]:
        """Get all projects for a user"""
        if not self.is_available():
            return []
        
        try:
            url = f"{self.base_url}/rest/v1/projects?order=updated_at.desc&limit={limit}"
            if user_id:
                url += f"&user_id=eq.{user_id}"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=self.headers, timeout=10.0)
                
                if response.status_code == 200:
                    return response.json()
                return []
        except Exception as e:
            print(f"Error getting projects: {e}")
            return []
    
    async def get_project(self, project_id: str) -> Optional[Dict]:
        """Get a specific project"""
        if not self.is_available():
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/rest/v1/projects?id=eq.{project_id}",
                    headers=self.headers,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data[0] if data else None
                return None
        except Exception as e:
            print(f"Error getting project: {e}")
            return None
    
    # ==================== FILES ====================
    
    async def create_file(
        self,
        project_id: str,
        name: str,
        path: str,
        language: str,
        content: str = "",
        user_id: Optional[str] = None,
        parent_folder: str = "/",
        is_folder: bool = False
    ) -> Optional[Dict]:
        """Create a new file or folder"""
        if not self.is_available():
            return None
        
        try:
            file_id = str(uuid.uuid4())
            data = {
                "id": file_id,
                "project_id": project_id,
                "user_id": user_id,
                "name": name,
                "path": path,
                "language": language if not is_folder else "folder",
                "content": content,
                "is_active": False,
                "parent_folder": parent_folder,
                "is_folder": is_folder
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/rest/v1/files",
                    headers=self.headers,
                    json=data,
                    timeout=10.0
                )
                
                if response.status_code in [200, 201]:
                    return response.json()[0] if response.json() else None
                else:
                    print(f"Error creating file: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Error creating file: {e}")
            return None
    
    async def get_project_files(self, project_id: str) -> List[Dict]:
        """Get all files in a project"""
        if not self.is_available():
            return []
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/rest/v1/files?project_id=eq.{project_id}&order=path.asc",
                    headers=self.headers,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    return response.json()
                return []
        except Exception as e:
            print(f"Error getting files: {e}")
            return []
    
    async def get_file(self, file_id: str) -> Optional[Dict]:
        """Get a specific file"""
        if not self.is_available():
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/rest/v1/files?id=eq.{file_id}",
                    headers=self.headers,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data[0] if data else None
                return None
        except Exception as e:
            print(f"Error getting file: {e}")
            return None
    
    async def update_file(self, file_id: str, content: str) -> bool:
        """Update file content and auto-generate embedding"""
        if not self.is_available():
            print("⚠️ Supabase not available for file update")
            return False
        
        print(f"🔄 Updating file {file_id}...")
        
        try:
            data = {"content": content}
            
            async with httpx.AsyncClient() as client:
                response = await client.patch(
                    f"{self.base_url}/rest/v1/files?id=eq.{file_id}",
                    headers=self.headers,
                    json=data,
                    timeout=10.0
                )
                
                if response.status_code in [200, 204]:
                    print(f"✅ File content updated in database")
                    
                    # Auto-generate embedding in background
                    print(f"🔍 Attempting to generate embedding...")
                    try:
                        from app.services.embedding_service import embedding_service
                        from app.services.supabase_service import supabase_service
                        
                        # Get file info
                        file_info = await self.get_file(file_id)
                        if file_info:
                            print(f"   File: {file_info.get('path', 'unknown')}")
                            print(f"   Language: {file_info.get('language', 'unknown')}")
                            print(f"   Is folder: {file_info.get('is_folder', False)}")
                            
                            if not file_info.get('is_folder', False):
                                # Generate embedding
                                print(f"🤖 Generating embedding...")
                                embedding = embedding_service.generate_code_embedding(
                                    code=content,
                                    language=file_info['language'],
                                    file_path=file_info['path']
                                )
                                
                                if embedding:
                                    print(f"✅ Embedding generated (dim: {len(embedding)})")
                                    
                                    # Compute content hash
                                    content_hash = embedding_service.compute_content_hash(content)
                                    print(f"   Content hash: {content_hash[:16]}...")
                                    
                                    # Save embedding (will update if exists)
                                    print(f"💾 Saving embedding to database...")
                                    result = await supabase_service.save_code_embedding(
                                        file_id=file_id,
                                        file_path=file_info['path'],
                                        language=file_info['language'],
                                        code_content=content,
                                        embedding=embedding,
                                        content_hash=content_hash
                                    )
                                    
                                    if result:
                                        print(f"✅ Auto-embedded: {file_info['path']}")
                                    else:
                                        print(f"❌ Failed to save embedding")
                                else:
                                    print(f"❌ Failed to generate embedding")
                            else:
                                print(f"⏭️  Skipped (folder)")
                        else:
                            print(f"❌ Could not get file info")
                    except Exception as e:
                        print(f"⚠️ Auto-embedding failed (non-critical): {e}")
                        import traceback
                        traceback.print_exc()
                    
                    return True
                else:
                    print(f"❌ Failed to update file: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Error updating file: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def delete_file(self, file_id: str) -> bool:
        """Delete a file"""
        if not self.is_available():
            return False
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{self.base_url}/rest/v1/files?id=eq.{file_id}",
                    headers=self.headers,
                    timeout=10.0
                )
                
                return response.status_code in [200, 204]
        except Exception as e:
            print(f"Error deleting file: {e}")
            return False
    
    async def set_active_file(self, project_id: str, file_id: str) -> bool:
        """Set a file as active (currently open)"""
        if not self.is_available():
            return False
        
        try:
            async with httpx.AsyncClient() as client:
                # Deactivate all files in project
                await client.patch(
                    f"{self.base_url}/rest/v1/files?project_id=eq.{project_id}",
                    headers=self.headers,
                    json={"is_active": False},
                    timeout=10.0
                )
                
                # Activate the selected file
                response = await client.patch(
                    f"{self.base_url}/rest/v1/files?id=eq.{file_id}",
                    headers=self.headers,
                    json={"is_active": True},
                    timeout=10.0
                )
                
                return response.status_code in [200, 204]
        except Exception as e:
            print(f"Error setting active file: {e}")
            return False
    
    # ==================== FILE VERSIONS ====================
    
    async def get_file_history(self, file_id: str, limit: int = 10) -> List[Dict]:
        """Get file version history"""
        if not self.is_available():
            return []
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/rest/v1/file_versions?file_id=eq.{file_id}&order=created_at.desc&limit={limit}",
                    headers=self.headers,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    return response.json()
                return []
        except Exception as e:
            print(f"Error getting file history: {e}")
            return []

# Global instance
file_service = FileService()
