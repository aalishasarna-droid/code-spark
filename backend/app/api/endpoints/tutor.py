from fastapi import APIRouter, HTTPException
from app.models.schemas import ContextPayload, TutorResponse
from app.services.tutor_agent import tutor_agent
from app.services.supabase_service import supabase_service
from app.services.rag_service import rag_service
from pydantic import BaseModel

router = APIRouter()

class AskTutorRequest(BaseModel):
    editor_state: dict
    user_question: str
    model_type: str = "ollama"  # "ollama" or "gemini"
    session_id: str = ""  # optional session tracking
    project_id: str = ""  # for RAG context
    
    model_config = {
        "protected_namespaces": ()
    }

@router.post("/ask", response_model=TutorResponse)
async def ask_tutor(request: AskTutorRequest):
    """
    Ask the Shadow Tutor for guidance with RAG context
    
    This endpoint receives the editor state, user question, and model type,
    then returns Socratic guidance from the selected LLM with relevant code context.
    
    Args:
        request: Contains editor_state, user_question, model_type, session_id, and project_id
    """
    print(f"📥 [tutor/ask] Query: '{request.user_question}' (model: {request.model_type})")
    try:
        from app.models.schemas import EditorState
        editor_state = EditorState(**request.editor_state)
        print(f"📄 [tutor/ask] File: {editor_state.file_path} ({len(editor_state.full_code)} chars)")
        
        # Get RAG context if project_id provided
        rag_context = ""
        if request.project_id:
            rag_context = await rag_service.get_rag_context(
                query=request.user_question,
                project_id=request.project_id,
                current_file_content=editor_state.full_code,
                current_file_path=editor_state.file_path
            )
            
            # Also search uploaded knowledge/notes for conceptual context
            try:
                from app.services.knowledge_service import knowledge_service
                knowledge_results = await knowledge_service.search_knowledge(
                    query=request.user_question,
                    project_id=request.project_id,
                    top_k=3
                )
                if knowledge_results:
                    knowledge_context, refs = knowledge_service.format_context_with_refs(knowledge_results)
                    rag_context += "\n\n📖 RELEVANT NOTES FROM UPLOADED FILES:\n" + knowledge_context
                    # Add reference hints
                    if refs:
                        ref_hints = "\n📚 Study References:\n"
                        for ref in refs:
                            page_info = f" — Page {ref['page_number']}" if ref.get('page_number') else ""
                            ref_hints += f"  • {ref['file_name']}{page_info} (relevance: {ref['relevance']:.0%})\n"
                        rag_context += ref_hints
            except Exception as e:
                print(f"⚠️ Knowledge search failed (non-fatal): {e}")
        
        # Save user message to database
        if request.session_id and supabase_service.is_available():
            await supabase_service.save_message(
                session_id=request.session_id,
                role="user",
                content=request.user_question,
                code_context=editor_state.full_code,
                execution_context=getattr(editor_state, 'last_execution', None)
            )
        
        # Get AI response with RAG context
        response = await tutor_agent.get_guidance(
            editor_state=editor_state,
            user_question=request.user_question,
            model_type=request.model_type,
            rag_context=rag_context
        )
        
        # Save AI response to database
        if request.session_id and supabase_service.is_available():
            await supabase_service.save_message(
                session_id=request.session_id,
                role="assistant",
                content=response.response,
                code_context=editor_state.full_code
            )
        
        print(f"✅ [tutor/ask] Completed response ({len(response.response)} chars)")
        return response
    except Exception as e:
        print(f"❌ [tutor/ask] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def tutor_health():
    """
    Check if the tutor service is healthy
    """
    return {
        "status": "healthy",
        "service": "tutor",
        "ollama_configured": True,
        "gemini_configured": tutor_agent.gemini_model is not None
    }

@router.get("/models")
async def available_models():
    """
    Get list of available models
    """
    models = []
    
    # Always include Ollama option
    models = [
        {
            "id": "ollama",
            "name": "Gemma 4 (Local)",
            "type": "local",
            "description": "Fast, private, runs on your machine"
        }
    ]
    
    # Include Gemini if configured
    if tutor_agent.gemini_model:
        models.append({
            "id": "gemini",
            "name": "Gemini 2.5 Flash",
            "type": "cloud",
            "description": "Powerful, fast, requires API key"
        })
    
    return {"models": models}

@router.post("/session/start")
async def start_session(language: str = "javascript", file_path: str = "main.js"):
    """
    Start a new tutor session
    """
    print(f"Creating new session with language={language}, file_path={file_path}")
    session_id = await supabase_service.create_session(
        user_id=None,
        language=language,
        file_path=file_path
    )
    print(f"Session created: {session_id}")
    return {
        "session_id": session_id,
        "status": "active" if session_id else "database_unavailable"
    }

@router.post("/session/end")
async def end_session(session_id: str):
    """
    End a tutor session
    """
    await supabase_service.end_session(session_id)
    return {"status": "completed"}

@router.post("/session/update-context")
async def update_session_context(request: dict):
    """
    Update session language and file path
    """
    session_id = request.get("session_id")
    language = request.get("language")
    file_path = request.get("file_path")
    
    print(f"Updating session {session_id}: language={language}, file_path={file_path}")
    await supabase_service.update_session_context(session_id, language, file_path)
    return {"status": "updated"}

@router.get("/session/{session_id}/messages")
async def get_session_messages(session_id: str):
    """
    Get all messages for a session
    """
    messages = await supabase_service.get_session_messages(session_id)
    return {"messages": messages}

@router.get("/session/{session_id}/history")
async def get_code_history(session_id: str):
    """
    Get code execution history for a session
    """
    history = await supabase_service.get_code_history(session_id)
    return {"history": history}

@router.post("/rag/index")
async def index_project(project_id: str):
    """
    Index all files in a project for RAG
    Generates embeddings for semantic search
    """
    result = await rag_service.index_project_files(project_id)
    return result

@router.post("/rag/search")
async def search_codebase(query: str, project_id: str, top_k: int = 3):
    """
    Search codebase for relevant code snippets
    """
    results = await rag_service.search_codebase(query, project_id, top_k)
    return {"results": results}
