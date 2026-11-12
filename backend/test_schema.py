import asyncio
import websockets
import json
import os

API_KEY = os.environ.get("OPENAI_API_KEY")
MODEL = "gpt-4o-realtime-preview-2024-12-17" # Try GA model directly

async def test():
    uri = f"wss://api.openai.com/v1/realtime?model={MODEL}"
    headers = {"Authorization": f"Bearer {API_KEY}", "OpenAI-Beta": "realtime=v1"}
    
    async with websockets.connect(uri, additional_headers=headers) as ws:
        # Send FLAT format
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "tools": [{
                    "type": "function",
                    "name": "test_flat",
                    "description": "A flat tool",
                    "parameters": {"type": "object", "properties": {}}
                }]
            }
        }))
        
        # Send NESTED format
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "tools": [{
                    "type": "function",
                    "function": {
                        "name": "test_nested",
                        "description": "A nested tool",
                        "parameters": {"type": "object", "properties": {}}
                    }
                }]
            }
        }))
        
        for _ in range(5):
            msg = json.loads(await ws.recv())
            if msg.get("type") == "session.updated":
                print("Session updated tools:")
                tools = msg.get("session", {}).get("tools", [])
                for t in tools:
                    print(t)
                
asyncio.run(test())
