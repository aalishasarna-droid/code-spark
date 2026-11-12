"""
Smart Assistant API Endpoints
AI-powered code editing, error fixing, and file creation.
"""
from fastapi import APIRouter, HTTPException
from app.models.schemas import AgentRequest, CodeEdit, AgentApplyRequest
from app.services.agent_service import agent_service

router = APIRouter()


@router.post("/fix-error", response_model=CodeEdit)
async def fix_error(request: AgentRequest):
    """
    Analyze a code execution error and propose a fix.
    
    The Smart Assistant reads the code, analyzes the error output,
    and returns a CodeEdit with the proposed fix.
    The fix is NOT applied until the user calls /apply.
    """
    try:
        if not request.error_output:
            raise HTTPException(status_code=400, detail="No error_output provided")
        
        result = await agent_service.fix_error(request)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Agent fix-error failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/edit", response_model=CodeEdit)
async def edit_code(request: AgentRequest):
    """
    Edit code based on a natural language instruction.
    
    Example instructions:
    - "Add error handling to the fetch call"
    - "Refactor this into smaller functions"
    - "Add input validation"
    
    Returns a CodeEdit with proposed changes. NOT applied until /apply is called.
    """
    try:
        if not request.instruction:
            raise HTTPException(status_code=400, detail="No instruction provided")
        
        result = await agent_service.edit_code(request)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Agent edit failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=CodeEdit)
async def create_file(request: AgentRequest):
    """
    Generate code for a new file based on instruction.
    
    Returns a CodeEdit with the generated code. NOT applied until /apply is called.
    """
    try:
        if not request.instruction:
            raise HTTPException(status_code=400, detail="No instruction provided")
        
        result = await agent_service.create_file_content(request)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Agent create failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/apply")
async def apply_edit(request: AgentApplyRequest):
    """
    Apply a proposed code edit to the file.
    
    This writes the new content to Supabase. The database trigger
    automatically saves the previous version to file_versions table.
    """
    try:
        if not request.file_id:
            raise HTTPException(status_code=400, detail="No file_id provided")
        
        success = await agent_service.apply_edit(request.file_id, request.new_content)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to apply edit")
        
        return {
            "status": "applied",
            "file_id": request.file_id,
            "message": "Edit applied successfully. Previous version saved automatically."
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Agent apply failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def agent_status():
    """
    Check Smart Assistant health and available backends.
    """
    import httpx
    
    ollama_available = False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{agent_service.ollama_url.replace('/api/generate', '')}/api/tags")
            ollama_available = response.status_code == 200
    except Exception:
        ollama_available = False
    
    return {
        "status": "healthy",
        "service": "smart_assistant",
        "ollama_available": ollama_available,
        "ollama_model": agent_service.ollama_model,
        "gemini_available": agent_service.gemini_model is not None,
    }
