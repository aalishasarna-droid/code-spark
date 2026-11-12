from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.services.file_service import file_service

router = APIRouter()

# ==================== REQUEST MODELS ====================

class CreateProjectRequest(BaseModel):
    name: str
    description: str = ""

class CreateFileRequest(BaseModel):
    project_id: str
    name: str
    path: str
    language: str
    content: str = ""
    parent_folder: str = "/"
    is_folder: bool = False

class UpdateFileRequest(BaseModel):
    content: str

# ==================== PROJECTS ====================

@router.post("/projects")
async def create_project(request: CreateProjectRequest):
    """Create a new project"""
    project = await file_service.create_project(
        name=request.name,
        description=request.description
    )
    
    if not project:
        raise HTTPException(status_code=500, detail="Failed to create project")
    
    return project

@router.get("/projects")
async def get_projects(limit: int = 50):
    """Get all projects"""
    projects = await file_service.get_projects(limit=limit)
    return {"projects": projects}

@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    """Get a specific project"""
    project = await file_service.get_project(project_id)
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return project

@router.get("/projects/{project_id}/files")
async def get_project_files(project_id: str):
    """Get all files in a project"""
    files = await file_service.get_project_files(project_id)
    return {"files": files}

# ==================== FILES ====================

@router.post("/files")
async def create_file(request: CreateFileRequest):
    """Create a new file or folder"""
    file = await file_service.create_file(
        project_id=request.project_id,
        name=request.name,
        path=request.path,
        language=request.language,
        content=request.content,
        parent_folder=request.parent_folder,
        is_folder=request.is_folder
    )
    
    if not file:
        raise HTTPException(status_code=500, detail="Failed to create file")
    
    return file

@router.get("/files/{file_id}")
async def get_file(file_id: str):
    """Get a specific file"""
    file = await file_service.get_file(file_id)
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    return file

@router.patch("/files/{file_id}")
async def update_file(file_id: str, request: UpdateFileRequest):
    """Update file content and auto-generate embedding"""
    print(f"📝 Updating file: {file_id}")
    print(f"   Content length: {len(request.content)}")
    
    success = await file_service.update_file(file_id, request.content)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update file")
    
    print(f"✅ File updated successfully: {file_id}")
    return {"status": "updated", "file_id": file_id}

@router.delete("/files/{file_id}")
async def delete_file(file_id: str):
    """Delete a file"""
    success = await file_service.delete_file(file_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete file")
    
    return {"status": "deleted", "file_id": file_id}

@router.post("/files/{file_id}/activate")
async def activate_file(file_id: str, project_id: str):
    """Set a file as active (currently open)"""
    success = await file_service.set_active_file(project_id, file_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to activate file")
    
    return {"status": "activated", "file_id": file_id}

# ==================== FILE HISTORY ====================

@router.get("/files/{file_id}/history")
async def get_file_history(file_id: str, limit: int = 10):
    """Get file version history"""
    history = await file_service.get_file_history(file_id, limit)
    return {"history": history}
