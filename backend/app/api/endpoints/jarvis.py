import os
import json
import asyncio
import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.config import settings
from app.services.file_service import file_service
from app.services.rag_service import rag_service
from app.services.agent_service import agent_service
from app.services.knowledge_service import knowledge_service
from app.models.schemas import AgentRequest

router = APIRouter()

MODEL = "gpt-realtime-2.1"

# Track which projects have been indexed in this session
_indexed_projects = set()

# ==================== TOOL DEFINITIONS ====================
# These are registered with OpenAI so E D I T H can call them via voice

EDITH_TOOLS = [
    {
        "type": "function",
        "name": "edit_code_in_file",
        "description": "Edit code in a project file based on a user instruction. Use this when the user asks you to modify, change, add, or refactor code in a specific file.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "The file path to edit (e.g. 'main.js', 'utils.py')"
                },
                "instruction": {
                    "type": "string",
                    "description": "What to change in the code (e.g. 'add error handling', 'fix the syntax error', 'add a hello world log')"
                }
            },
            "required": ["file_path", "instruction"]
        }
    },
    {
        "type": "function",
        "name": "fix_code_in_file",
        "description": "Analyze and fix an error in the code. Use this when the user asks you to fix, debug, or resolve an error.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "The file that has the error (e.g. 'new.js', 'main.py')"
                }
            },
            "required": ["file_path"]
        }
    },
    {
        "type": "function",
        "name": "create_file",
        "description": "Create a new file with generated code. Use this when the user asks you to create a new file.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "The path/name of the new file to create (e.g. 'utils.js')"
                },
                "description": {
                    "type": "string",
                    "description": "What the file should contain (e.g. 'a function to calculate fibonacci')"
                }
            },
            "required": ["file_path", "description"]
        }
    },
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



async def ensure_project_indexed(project_id: str):
    """Ensure project embeddings are up to date (runs once per session)"""
    if project_id in _indexed_projects:
        return
    
    try:
        print(f"🔍 Checking if project {project_id} needs indexing...")
        # Index in background (non-blocking)
        asyncio.create_task(rag_service.index_project_files(project_id))
        _indexed_projects.add(project_id)
        print(f"✅ Project indexing started in background")
    except Exception as e:
        print(f"⚠️ Failed to start indexing: {e}")


async def handle_tool_call(tool_name: str, tool_args: dict, project_id: str, 
                           current_file_path: str, current_code: str, 
                           current_error: str, client_ws: WebSocket) -> str:
    """
    Execute a tool call from E D I T H and return the result.
    Also sends a code_edit message to the frontend WebSocket.
    """
    print(f"🔧 E D I T H Tool Call: {tool_name}({json.dumps(tool_args)})")
    
    try:
        file_path = tool_args.get("file_path", current_file_path)
        
        # Find the file in the project
        target_file_id = ""
        target_content = ""
        target_language = "javascript"
        
        if project_id:
            project_files = await file_service.get_project_files(project_id)
            for pf in project_files:
                if pf.get('is_folder', False):
                    continue
                # Match by name or path
                if pf.get('path') == file_path or pf.get('name') == file_path:
                    target_file_id = pf.get('id', '')
                    target_content = pf.get('content', '')
                    target_language = pf.get('language', 'javascript')
                    file_path = pf.get('path', file_path)
                    break
        
        # If file not found in project, use current editor content
        if not target_content and file_path == current_file_path:
            target_content = current_code
        
        if tool_name == "edit_code_in_file":
            instruction = tool_args.get("instruction", "")
            request = AgentRequest(
                project_id=project_id,
                file_id=target_file_id,
                file_path=file_path,
                instruction=instruction,
                code_content=target_content,
                language=target_language,
                model_type="ollama"
            )
            edit = await agent_service.edit_code(request)
            
            # Send code_edit to frontend
            await client_ws.send_text(json.dumps({
                "type": "code_edit",
                "edit": {
                    "file_id": edit.file_id,
                    "file_path": edit.file_path,
                    "original_content": edit.original_content,
                    "proposed_content": edit.proposed_content,
                    "explanation": edit.explanation,
                    "edit_type": edit.edit_type,
                    "language": edit.language
                }
            }))
            
            return f"I've proposed an edit to {file_path}. The changes are shown in the diff view for the user to review and accept. Edit: {edit.explanation}"
        
        elif tool_name == "fix_code_in_file":
            error_desc = tool_args.get("error_description", current_error or "Fix the error")
            request = AgentRequest(
                project_id=project_id,
                file_id=target_file_id,
                file_path=file_path,
                error_output=error_desc,
                code_content=target_content,
                language=target_language,
                model_type="ollama"
            )
            edit = await agent_service.fix_error(request)
            
            # Send code_edit to frontend
            await client_ws.send_text(json.dumps({
                "type": "code_edit",
                "edit": {
                    "file_id": edit.file_id,
                    "file_path": edit.file_path,
                    "original_content": edit.original_content,
                    "proposed_content": edit.proposed_content,
                    "explanation": edit.explanation,
                    "edit_type": edit.edit_type,
                    "language": edit.language
                }
            }))
            
            return f"I've proposed a fix for {edit.file_path}. The changes are shown in the diff view. Fix: {edit.explanation}"
        
        elif tool_name == "create_file":
            description = tool_args.get("description", "Create this file")
            request = AgentRequest(
                project_id=project_id,
                file_id="",
                file_path=file_path,
                instruction=description,
                code_content="",
                language=target_language,
                model_type="ollama"
            )
            edit = await agent_service.create_file_content(request)
            
            # Send code_edit to frontend
            await client_ws.send_text(json.dumps({
                "type": "code_edit",
                "edit": {
                    "file_id": edit.file_id,
                    "file_path": edit.file_path,
                    "original_content": "",
                    "proposed_content": edit.proposed_content,
                    "explanation": edit.explanation,
                    "edit_type": "create",
                    "language": edit.language
                }
            }))
            
            return f"I've generated code for {file_path}. The content is shown in the diff view for review."
            
        elif tool_name == "search_notes":
            query = tool_args.get("query", "")
            if not query:
                return "Query cannot be empty."
            
            print(f"📚 Searching notes for: {query}")
            results = await knowledge_service.search_knowledge(
                query=query,
                project_id=project_id,
                top_k=3
            )
            
            if not results:
                return f"No relevant information found in the notes for '{query}'."
                
            context, _ = knowledge_service.format_context_with_refs(results)
            return f"Found relevant notes:\n\n{context}\n\nUse this context to answer the user's question, and cite the file names and pages."
        
        else:
            return f"Unknown tool: {tool_name}"
    
    except Exception as e:
        print(f"❌ Tool call failed: {e}")
        import traceback
        traceback.print_exc()
        return f"Sorry, I encountered an error while trying to {tool_name}: {str(e)}"


@router.websocket("/ws")
async def realtime_audio_endpoint(client_ws: WebSocket):
    await client_ws.accept()
    print(f"✅ Client WebSocket accepted")
    
    OPENAI_API_KEY = settings.OPENAI_API_KEY
    if not OPENAI_API_KEY:
        print("❌ OPENAI_API_KEY is not set.")
        await client_ws.close(code=1008, reason="OpenAI API Key not configured")
        return
    
    if OPENAI_API_KEY == "your_openai_api_key_here":
        print("❌ OPENAI_API_KEY is still the placeholder value")
        await client_ws.close(code=1008, reason="OpenAI API Key not configured")
        return
    
    print(f"✅ OpenAI API Key found (length: {len(OPENAI_API_KEY)})")

    url = f"wss://api.openai.com/v1/realtime?model={MODEL}"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    # Shared state for the current session context
    session_context = {
        "code": "",
        "file_path": "",
        "output": "",
        "error": "",
        "project_id": "",
        "is_executing_tool": False
    }
    
    try:
        print(f"🔌 Connecting to OpenAI Realtime API...")
        async with websockets.connect(url, additional_headers=headers) as openai_ws:
            print(f"✅ Connected to OpenAI Realtime API")
            
            # Initial session config with tools
            context_payload = {
                "type": "session.update",
                "session": {
                    "type": "realtime",
                    "instructions": "You are E D I T H, an advanced AI coding assistant. You have full context of the user's IDE, code, errors, and project files. You can explain code, answer questions, edit code files, AND search their uploaded notes. Be concise, professional, and helpful. When the user asks you to search their notes, explain a concept from their notes, or edit/fix code, use the available tools.",
                    "voice": "ash", 
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                    "tools": EDITH_TOOLS,
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
            print(f"📤 Sent initial session config with tools to OpenAI")

            # Track pending function calls
            pending_function_calls = {}

            async def receive_from_client():
                try:
                    while True:
                        data = await client_ws.receive_text()
                        
                        # Check if data is a custom context update message
                        try:
                            msg = json.loads(data)
                            if isinstance(msg, dict) and msg.get("type") == "context_update":
                                print("📥 Received context_update from frontend")
                                
                                # Send session update to OpenAI
                                ctx = msg.get("context", {})
                                code = ctx.get("code", "")
                                file_path = ctx.get("filePath", "")
                                output = ctx.get("output", "")
                                error = ctx.get("error", "")
                                project_id = ctx.get("projectId", "")
                                
                                # Update shared context
                                session_context["code"] = code
                                session_context["file_path"] = file_path
                                session_context["output"] = output
                                session_context["error"] = error
                                session_context["project_id"] = project_id
                                
                                print(f"   File: {file_path}")
                                print(f"   Code length: {len(code)}")
                                print(f"   Has output: {bool(output)}")
                                print(f"   Has error: {bool(error)}")
                                print(f"   Project ID: {project_id}")
                                
                                # Ensure project is indexed for RAG (runs once per session)
                                if project_id:
                                    await ensure_project_indexed(project_id)
                                
                                # Build smart context using RAG
                                project_context = ""
                                
                                if project_id:
                                    try:
                                        print(f"🔍 Using RAG to find relevant files...")
                                        
                                        # Build a query from the current context
                                        query_parts = []
                                        
                                        if error:
                                            query_parts.append(f"error: {error[:200]}")
                                        
                                        if code:
                                            query_parts.append(code[:500])
                                        
                                        if file_path:
                                            query_parts.append(f"file: {file_path}")
                                        
                                        query = " ".join(query_parts)
                                        
                                        # Use RAG to find top 3 most relevant files
                                        relevant_files = await rag_service.search_codebase(
                                            query=query,
                                            project_id=project_id,
                                            top_k=3
                                        )
                                        
                                        if relevant_files:
                                            print(f"   Found {len(relevant_files)} relevant files via RAG")
                                            
                                            useful_files = [f for f in relevant_files if f.get('similarity', 0) > 0.1]
                                            
                                            if useful_files:
                                                project_context = "--- RELEVANT PROJECT FILES (semantic search) ---\n"
                                                
                                                for idx, file_data in enumerate(useful_files, 1):
                                                    similarity = file_data.get('similarity', 0)
                                                    path = file_data.get('file_path', 'unknown')
                                                    content = file_data.get('code_content', '')
                                                    language = file_data.get('language', 'unknown')
                                                    
                                                    if path == file_path:
                                                        continue
                                                    
                                                    print(f"   {idx}. {path} (relevance: {similarity:.1%})")
                                                    
                                                    project_context += f"\n### File {idx}: {path} (relevance: {similarity:.0%})\n"
                                                    project_context += f"Language: {language}\n"
                                                    
                                                    if len(content) > 2000:
                                                        content = content[:2000] + "\n... (truncated for brevity)"
                                                    
                                                    project_context += f"```{language}\n{content}\n```\n"
                                            else:
                                                print(f"   ⚠️ All files have low relevance (< 10%), skipping RAG context")
                                                project_context = ""
                                        else:
                                            print(f"   No relevant files found via RAG, using simple context")
                                            project_context = ""
                                                
                                    except Exception as e:
                                        print(f"❌ Error in RAG search: {e}")
                                        import traceback
                                        traceback.print_exc()
                                
                                instructions = f"""You are E D I T H, an advanced AI coding assistant in Coding Canvas IDE.

RULES:
1. Only reference code that is explicitly shown below.
2. If you don't see specific code, say "I don't see that in the current context".
3. Be precise about file names and line numbers.

{project_context if project_context else "--- NO ADDITIONAL PROJECT FILES AVAILABLE ---\n"}

--- CURRENTLY ACTIVE FILE: {file_path} ---
```
{code if code else "(No code in current file)"}
```

--- EXECUTION RESULTS ---
Output: {output if output else "(No output yet)"}
Error: {error if error else "(No errors)"}

CRITICAL TOOL INSTRUCTIONS (YOU MUST OBEY THESE):
- YOU HAVE FULL CAPABILITY TO EDIT FILES! Do NOT claim you cannot edit or fix code.
- You are a backend programmatic agent. You must interact with the system by triggering actions in your speech.
- NEVER WRITE OR SPEAK RAW CODE! You are strictly forbidden from outputting code in your verbal response.
- If the user asks you to fix an error, you MUST say exactly this phrase in your response: "I am executing the fix command."
- If the user asks you to edit code, you MUST say exactly this phrase in your response: "I am executing the edit command."
- Example response for editing: "Got it! I am executing the edit command. I will add the console log."
- Example response for fixing: "I see the issue. I am executing the fix command."

Your task: Help the user understand their code, fix errors, and edit files. When asked to make changes, YOU MUST use the exact trigger phrases "I am executing the fix command." or "I am executing the edit command."."""
                                
                                print(f"✅ Sending updated context to OpenAI (instructions length: {len(instructions)})")
                                
                                update_payload = {
                                    "type": "session.update",
                                    "session": {
                                        "type": "realtime",
                                        "instructions": instructions
                                    }
                                }
                                
                                try:
                                    await openai_ws.send(json.dumps(update_payload))
                                    print(f"📤 Context update sent to OpenAI successfully")
                                    
                                    # To guarantee the model sees the context mid-conversation, 
                                    # inject a system message if the file changed or a new error appeared.
                                    # We don't do this on every keystroke to avoid bloating the history.
                                    file_changed = session_context.get("last_file_path") != file_path
                                    new_error = bool(error) and session_context.get("last_error") != error
                                    
                                    if file_changed or new_error:
                                        msg_text = f"The user's context just updated.\nCurrently viewing: {file_path}\n"
                                        if error:
                                            msg_text += f"There is an execution error:\n{error}\n"
                                        msg_text += f"Current code:\n{code[:1000]}\n"
                                        msg_text += f"REMINDER: DO NOT SPEAK CODE! If asked to fix or edit, YOU MUST CALL TOOLS (fix_code_in_file, edit_code_in_file) IMMEDIATELY."
                                        
                                        sys_msg = {
                                            "type": "conversation.item.create",
                                            "item": {
                                                "type": "message",
                                                "role": "system",
                                                "content": [
                                                    {
                                                        "type": "input_text",
                                                        "text": msg_text
                                                    }
                                                ]
                                            }
                                        }
                                        await openai_ws.send(json.dumps(sys_msg))
                                        print("📤 Injected system message with new context into conversation history")
                                        
                                        # Update trackers
                                        session_context["last_file_path"] = file_path
                                        session_context["last_error"] = error
                                        
                                except Exception as send_error:
                                    print(f"❌ Failed to send context update: {send_error}")
                                
                                continue
                        except json.JSONDecodeError:
                            pass
                        
                        # Otherwise forward raw data to OpenAI
                        await openai_ws.send(data)
                except WebSocketDisconnect:
                    pass
                except websockets.exceptions.ConnectionClosed:
                    pass

            async def receive_from_openai():
                try:
                    while True:
                        message = await openai_ws.recv()
                        try:
                            msg_data = json.loads(message)
                            msg_type = msg_data.get('type', 'unknown')
                            
                            # Log important messages
                            if msg_type == 'error':
                                print(f"❌ OpenAI Error: {json.dumps(msg_data, indent=2)}")
                            elif msg_type not in ['response.output_audio.delta', 'input_audio_buffer.speech_started', 'input_audio_buffer.committed']:
                                print(f"📨 OpenAI: {msg_type}")
                                if msg_type == 'response.done':
                                    print(f"   [DEBUG] response.done details: {json.dumps(msg_data, indent=2)[:500]}...")
                                if msg_type in ['session.created', 'session.updated']:
                                    print(f"   Details: {json.dumps(msg_data, indent=2)}")
                                    # Print tool names specifically to verify
                                    session = msg_data.get('session', {})
                                    tools = session.get('tools', [])
                                    tool_names = [t.get('name') for t in tools]
                                    print(f"   🛠️ REGISTERED TOOLS: {tool_names}")
                            
                            # ==================== HANDLE FUNCTION CALLS ====================
                            if msg_type == "response.function_call_arguments.done":
                                call_id = msg_data.get("call_id", "")
                                fn_name = msg_data.get("name", "")
                                fn_args_str = msg_data.get("arguments", "{}")
                                
                                print(f"🔧 E D I T H: Function call received — {fn_name}({fn_args_str})")
                                
                                try:
                                    fn_args = json.loads(fn_args_str)
                                except json.JSONDecodeError:
                                    fn_args = {}
                                
                                # Execute the tool
                                result = await handle_tool_call(
                                    tool_name=fn_name,
                                    tool_args=fn_args,
                                    project_id=session_context["project_id"],
                                    current_file_path=session_context["file_path"],
                                    current_code=session_context["code"],
                                    current_error=session_context["error"],
                                    client_ws=client_ws
                                )
                                
                                print(f"✅ Tool result: {result[:100]}...")
                                
                                # Send function call output back to OpenAI
                                fn_output_msg = {
                                    "type": "conversation.item.create",
                                    "item": {
                                        "type": "function_call_output",
                                        "call_id": call_id,
                                        "output": result
                                    }
                                }
                                await openai_ws.send(json.dumps(fn_output_msg))
                                print(f"📤 Sent function output to OpenAI")
                                
                                # Tell OpenAI to respond with audio after receiving the tool result
                                await openai_ws.send(json.dumps({
                                    "type": "response.create"
                                }))
                                print(f"📤 Requested audio response from OpenAI")
                                
                                # Don't forward function_call events to frontend
                                # (they'd confuse the audio player)
                                continue
                            
                            # Skip forwarding internal function call messages
                            if msg_type in [
                                "response.function_call_arguments.delta",
                                "response.output_item.added",
                            ]:
                                # Check if it's a function call item — don't forward
                                item = msg_data.get("item", {})
                                if item.get("type") == "function_call":
                                    continue
                            
                            if msg_type == "response.output_audio_transcript.done":
                                transcript = msg_data.get("transcript", "")
                                print(f"🗣️  E D I T H: {transcript}")
                        except json.JSONDecodeError:
                            pass
                        except Exception as parse_err:
                            print(f"⚠️ Error parsing OpenAI message: {parse_err}")
                        
                        # Forward everything else to frontend (audio, transcripts, etc.)
                        await client_ws.send_text(message)
                except websockets.exceptions.ConnectionClosed:
                    print(f"⚠️ OpenAI WebSocket closed")
                    pass
                except Exception as e:
                    print(f"❌ Error in receive_from_openai: {e}")

            await asyncio.gather(
                receive_from_client(),
                receive_from_openai()
            )

    except Exception as e:
        print(f"Failed to connect to OpenAI Realtime API: {e}")
        try:
            await client_ws.close()
        except:
            pass
