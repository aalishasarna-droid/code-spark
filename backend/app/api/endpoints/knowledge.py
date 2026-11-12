"""
Knowledge Hub API Endpoints
File upload, document management, semantic search, and RAG-powered chat.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import json
import asyncio
import websockets
from app.core.config import settings
from typing import Optional, List, Dict
from app.services.knowledge_service import knowledge_service

router = APIRouter()

# Max file size: 20MB
MAX_FILE_SIZE = 20 * 1024 * 1024

ALLOWED_EXTENSIONS = {"pdf", "txt", "md"}


def get_file_type(filename: str) -> str:
    """Extract file extension and validate."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: .{ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    return ext


# ==================== UPLOAD ====================

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    project_id: str = Form(default="00000000-0000-0000-0000-000000000001")
):
    """
    Upload a document (PDF, TXT, MD) for knowledge extraction.
    
    The file is parsed, chunked, embedded, and stored in Supabase.
    Returns the document metadata with processing status.
    """
    # Validate file type
    file_type = get_file_type(file.filename)

    # Read file content
    file_bytes = await file.read()

    # Validate file size
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB."
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    try:
        result = await knowledge_service.upload_and_process(
            file_bytes=file_bytes,
            file_name=file.filename,
            file_type=file_type,
            project_id=project_id
        )
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


# ==================== DOCUMENT MANAGEMENT ====================

@router.get("/documents")
async def list_documents(project_id: str = "00000000-0000-0000-0000-000000000001"):
    """List all uploaded documents for a project."""
    try:
        documents = await knowledge_service.list_documents(project_id)
        return {
            "success": True,
            "documents": documents,
            "count": len(documents)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a document and all its embedded chunks."""
    success = await knowledge_service.delete_document(document_id)
    if success:
        return {"success": True, "message": "Document deleted successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete document")


# ==================== SEARCH ====================

class SearchRequest(BaseModel):
    query: str
    project_id: str = "00000000-0000-0000-0000-000000000001"
    top_k: Optional[int] = 5


@router.post("/search")
async def search_knowledge(request: SearchRequest):
    """
    Semantic search over uploaded documents.
    Returns the most relevant chunks with source metadata.
    """
    try:
        results = await knowledge_service.search_knowledge(
            query=request.query,
            project_id=request.project_id,
            top_k=request.top_k
        )

        # Remove embeddings from response (too large)
        for r in results:
            r.pop("embedding", None)

        return {
            "success": True,
            "results": results,
            "count": len(results)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CHAT ====================

class ChatRequest(BaseModel):
    query: str
    project_id: str = "00000000-0000-0000-0000-000000000001"
    chat_history: Optional[List[Dict]] = None
    top_k: Optional[int] = 5


@router.post("/chat")
async def chat_with_knowledge(request: ChatRequest):
    """
    Chat with your uploaded notes using RAG.
    
    Returns an AI-generated response with cited references
    back to the source documents (file name, page number, relevant text).
    """
    try:
        result = await knowledge_service.chat_with_knowledge(
            query=request.query,
            project_id=request.project_id,
            chat_history=request.chat_history,
            top_k=request.top_k
        )
        return {
            "success": True,
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== HEALTH ====================

@router.get("/health")
async def knowledge_health():
    """Check if the Knowledge Hub service is operational."""
    from app.services.embedding_service import embedding_service
    from app.services.supabase_service import supabase_service

    pdf_support = False
    try:
        import fitz
        pdf_support = True
    except ImportError:
        pass

    return {
        "embedding_model_loaded": embedding_service.model is not None,
        "supabase_available": supabase_service.is_available(),
        "pdf_support": pdf_support,
        "max_file_size_mb": MAX_FILE_SIZE // (1024 * 1024),
        "allowed_types": list(ALLOWED_EXTENSIONS)
    }

# ==================== VOICE CHAT (REALTIME API) ====================

KNOWLEDGE_TOOLS = [
    {
        "type": "function",
        "name": "search_notes",
        "description": "Search the user's uploaded study notes and PDFs. Use this whenever the user asks a question about their notes, concepts, or course material.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to look for in the notes (e.g. 'what is SVM?')"
                }
            },
            "required": ["query"]
        }
    }
]

@router.websocket("/ws")
async def knowledge_voice_endpoint(client_ws: WebSocket):
    await client_ws.accept()
    print(f"✅ Knowledge Voice Client WebSocket accepted")
    
    OPENAI_API_KEY = settings.OPENAI_API_KEY
    if not OPENAI_API_KEY or OPENAI_API_KEY == "your_openai_api_key_here":
        print("❌ OPENAI_API_KEY is not set.")
        await client_ws.close(code=1008, reason="OpenAI API Key not configured")
        return
    
    MODEL = "gpt-realtime-2.1"
    url = f"wss://api.openai.com/v1/realtime?model={MODEL}"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    # State
    session_context = {
        "project_id": "00000000-0000-0000-0000-000000000001",
        "is_executing_tool": False
    }
    
    try:
        async with websockets.connect(url, additional_headers=headers) as openai_ws:
            print(f"✅ Connected to OpenAI Realtime API for Knowledge Hub")
            
            # Initial session config with tools
            context_payload = {
                "type": "session.update",
                "session": {
                    "type": "realtime",
                    "instructions": "You are a dedicated study notes tutor. You help the user understand the material in their uploaded PDFs and notes. ALWAYS use the search_notes tool to find relevant information BEFORE you answer questions about their notes. Be concise, educational, and cite your sources.",
                    "voice": "ash", 
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                    "tools": KNOWLEDGE_TOOLS,
                    "tool_choice": "auto",
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": 0.8,
                        "prefix_padding_ms": 300,
                        "silence_duration_ms": 1000
                    }
                }
            }
            await openai_ws.send(json.dumps(context_payload))
            print(f"📤 Sent initial session config to OpenAI")

            pending_function_calls = {}

            async def receive_from_client():
                try:
                    while True:
                        data = await client_ws.receive_text()
                        
                        try:
                            msg = json.loads(data)
                            if isinstance(msg, dict) and msg.get("type") == "context_update":
                                print("📥 Received context_update for Knowledge Hub")
                                project_id = msg.get("context", {}).get("projectId", "")
                                if project_id:
                                    session_context["project_id"] = project_id
                                    
                                    # Fetch documents to inject context!
                                    docs = await knowledge_service.list_documents(project_id)
                                    doc_info = "No documents uploaded yet."
                                    if docs:
                                        doc_info = "User has uploaded the following notes:\\n"
                                        for d in docs:
                                            doc_info += f"- {d['file_name']} ({d['file_type']}, {d['chunk_count']} chunks)\\n"
                                            
                                    instructions = f"""You are a dedicated study notes tutor. You help the user understand the material in their uploaded PDFs and notes. 

{doc_info}

ALWAYS use the search_notes tool to find relevant information BEFORE you answer questions about their notes. Be concise, educational, and cite your sources. If they ask a general question, search the notes first to see if it's covered in their materials."""
                                    
                                    update_payload = {
                                        "type": "session.update",
                                        "session": {
                                            "type": "realtime",
                                            "instructions": instructions
                                        }
                                    }
                                    await openai_ws.send(json.dumps(update_payload))
                                    print("📤 Context injected into OpenAI session")
                                continue
                            
                            if isinstance(msg, dict) and msg.get("type") == "input_audio_buffer.append":
                                # print("🎵 [Audio chunk]")
                                if session_context["is_executing_tool"]:
                                    continue
                            
                            # Forward other JSON messages to OpenAI
                            await openai_ws.send(data)
                            
                        except json.JSONDecodeError:
                            print("⚠️ Warning: Received non-JSON data from client")
                            
                except WebSocketDisconnect:
                    print("❌ Client WebSocket disconnected")
                except Exception as e:
                    print(f"❌ Error in receive_from_client: {e}")

            async def receive_from_openai():
                try:
                    while True:
                        data = await openai_ws.recv()
                        msg = json.loads(data)
                        
                        msg_type = msg.get("type")
                        print(f"📨 OpenAI: {msg_type}")
                        
                        if msg_type in ["response.output_audio.delta", "response.output_audio_transcript.delta", "input_audio_buffer.speech_started", "response.output_audio_transcript.done"]:
                            if not session_context["is_executing_tool"]:
                                await client_ws.send_text(json.dumps(msg))
                                
                        elif msg_type == "response.function_call_arguments.done":
                            call_id = msg.get("call_id")
                            name = msg.get("name")
                            args_str = msg.get("arguments", "{}")
                            
                            print(f"🛠️ Tool call received: {name}")
                            session_context["is_executing_tool"] = True
                            
                            try:
                                args = json.loads(args_str)
                            except:
                                args = {}
                                
                            pending_function_calls[call_id] = {
                                "name": name,
                                "args": args
                            }
                            
                            # Execute the tool
                            if name == "search_notes":
                                query = args.get("query", "")
                                if not query:
                                    result = "Query cannot be empty."
                                else:
                                    print(f"📚 Searching notes for: {query}")
                                    results = await knowledge_service.search_knowledge(
                                        query=query,
                                        project_id=session_context["project_id"],
                                        top_k=3
                                    )
                                    if not results:
                                        result = f"No relevant information found in the notes for '{query}'."
                                    else:
                                        context, _ = knowledge_service.format_context_with_refs(results)
                                        result = f"Found relevant notes:\n\n{context}\n\nUse this context to answer the user's question, and cite the file names and pages."
                            else:
                                result = f"Unknown tool: {name}"
                                
                            # Send tool result back to OpenAI
                            tool_response = {
                                "type": "conversation.item.create",
                                "item": {
                                    "type": "function_call_output",
                                    "call_id": call_id,
                                    "output": result
                                }
                            }
                            await openai_ws.send(json.dumps(tool_response))
                            print(f"📤 Sent tool output to OpenAI")
                            
                            # Trigger response generation
                            await openai_ws.send(json.dumps({"type": "response.create"}))
                            session_context["is_executing_tool"] = False
                            
                except websockets.exceptions.ConnectionClosed:
                    print("❌ OpenAI WebSocket closed")
                except Exception as e:
                    print(f"❌ Error in receive_from_openai: {e}")

            # Run both listeners concurrently
            await asyncio.gather(
                receive_from_client(),
                receive_from_openai()
            )
            
    except Exception as e:
        print(f"❌ Failed to connect to OpenAI: {e}")
        await client_ws.close(code=1011, reason="Failed to connect to OpenAI API")
