import re

with open("app/api/endpoints/knowledge.py", "r") as f:
    content = f.read()

replacement = """                            if isinstance(msg, dict) and msg.get("type") == "context_update":
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
                                            
                                    instructions = f\"\"\"You are a dedicated study notes tutor. You help the user understand the material in their uploaded PDFs and notes. 

{doc_info}

ALWAYS use the search_notes tool to find relevant information BEFORE you answer questions about their notes. Be concise, educational, and cite your sources. If they ask a general question, search the notes first to see if it's covered in their materials.\"\"\"
                                    
                                    update_payload = {
                                        "type": "session.update",
                                        "session": {
                                            "type": "realtime",
                                            "instructions": instructions
                                        }
                                    }
                                    await openai_ws.send(json.dumps(update_payload))
                                    print("📤 Context injected into OpenAI session")
                                continue"""

content = re.sub(r'                            if isinstance\(msg, dict\) and msg\.get\("type"\) == "context_update":.*?continue', replacement, content, flags=re.DOTALL)

with open("app/api/endpoints/knowledge.py", "w") as f:
    f.write(content)
