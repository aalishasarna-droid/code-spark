
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
                                continue
                            
                            if isinstance(msg, dict) and msg.get("type") == "input_audio_buffer.append":
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
                        
                        if msg_type in ["response.audio.delta", "response.audio_transcript.delta", "input_audio_buffer.speech_started", "response.audio_transcript.done"]:
                            if not session_context["is_executing_tool"]:
                                # Convert OpenAI's event names to what the frontend expects
                                frontend_type = msg_type
                                if msg_type == "response.audio.delta":
                                    frontend_type = "response.output_audio.delta"
                                elif msg_type == "response.audio_transcript.delta":
                                    frontend_type = "response.output_audio_transcript.delta"
                                elif msg_type == "response.audio_transcript.done":
                                    frontend_type = "response.output_audio_transcript.done"
                                
                                msg["type"] = frontend_type
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
