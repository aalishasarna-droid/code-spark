from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.terminal_service import terminal_service
from app.services.file_service import file_service

router = APIRouter()

# ==================== REQUEST MODELS ====================

class CreateTerminalRequest(BaseModel):
    project_id: str

class ExecuteCommandRequest(BaseModel):
    command: str

class NpmInstallRequest(BaseModel):
    package: Optional[str] = None

class NpmRunRequest(BaseModel):
    script: str

# ==================== TERMINAL ENDPOINTS ====================

@router.post("/create")
async def create_terminal(request: CreateTerminalRequest):
    """Create a new terminal session"""
    session_id = terminal_service.create_session(request.project_id)
    
    # Sync project files to workspace
    files = await file_service.get_project_files(request.project_id)
    files_dict = {}
    for f in files:
        if not f.get('is_folder', False):
            files_dict[f['path']] = f['content']
    
    terminal_service.sync_files_to_workspace(session_id, files_dict)
    
    return {
        "session_id": session_id,
        "status": "created"
    }

@router.post("/{session_id}/execute")
async def execute_command(session_id: str, request: ExecuteCommandRequest):
    """Execute a command in the terminal"""
    result = await terminal_service.execute_command(session_id, request.command)
    return result

@router.get("/{session_id}/history")
async def get_history(session_id: str):
    """Get command history"""
    history = terminal_service.get_history(session_id)
    return {"history": history}

@router.delete("/{session_id}")
async def close_terminal(session_id: str):
    """Close a terminal session"""
    terminal_service.close_session(session_id)
    return {"status": "closed"}

# ==================== NPM SHORTCUTS ====================

@router.post("/{session_id}/npm/install")
async def npm_install(session_id: str, request: NpmInstallRequest):
    """Run npm install"""
    result = await terminal_service.npm_install(session_id, request.package)
    return result

@router.post("/{session_id}/npm/run")
async def npm_run(session_id: str, request: NpmRunRequest):
    """Run npm script"""
    result = await terminal_service.npm_run(session_id, request.script)
    return result

# ==================== COMMON COMMANDS ====================

@router.post("/{session_id}/init/node")
async def init_node_project(session_id: str):
    """Initialize a Node.js project"""
    result = await terminal_service.execute_command(session_id, "npm init -y")
    return result

@router.post("/{session_id}/init/react")
async def init_react_project(session_id: str, project_name: str = "my-app"):
    """Initialize a React project"""
    result = await terminal_service.execute_command(
        session_id,
        f"npx create-react-app {project_name}"
    )
    return result

@router.post("/{session_id}/init/vite")
async def init_vite_project(session_id: str, project_name: str = "my-app"):
    """Initialize a Vite project"""
    result = await terminal_service.execute_command(
        session_id,
        f"npm create vite@latest {project_name} -- --template react"
    )
    return result
