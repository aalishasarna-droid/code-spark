"""
RAG (Retrieval-Augmented Generation) API Endpoints
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.rag_service import rag_service

router = APIRouter()

class IndexRequest(BaseModel):
    project_id: str

class SearchRequest(BaseModel):
    query: str
    project_id: str
    top_k: Optional[int] = 3

@router.post("/index")
async def index_project(request: IndexRequest):
    """
    Index all files in a project for semantic search
    
    This generates embeddings for all files and stores them in the database.
    Only files that changed will be re-embedded (smart caching).
    """
    try:
        result = await rag_service.index_project_files(request.project_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search")
async def search_codebase(request: SearchRequest):
    """
    Search codebase using semantic search
    
    Returns the most relevant code snippets based on the query.
    """
    try:
        results = await rag_service.search_codebase(
            query=request.query,
            project_id=request.project_id,
            top_k=request.top_k
        )
        return {
            "success": True,
            "results": results,
            "count": len(results)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def rag_health():
    """Check if RAG service is working"""
    from app.services.embedding_service import embedding_service
    from app.services.supabase_service import supabase_service
    
    return {
        "embedding_service": embedding_service.model is not None,
        "supabase_available": supabase_service.is_available()
    }
