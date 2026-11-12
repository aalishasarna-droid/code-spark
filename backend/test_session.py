import asyncio
import websockets
import json
import os

API_KEY = os.environ.get("OPENAI_API_KEY")
MODEL = "gpt-4o-realtime-preview-2024-10-01"

async def test():
    uri = f"wss://api.openai.com/v1/realtime?model={MODEL}"
    headers = {"Authorization": f"Bearer {API_KEY}"}
    
    async with websockets.connect(uri, additional_headers=headers) as ws:
        # 1. Register tools
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "tools": [{"type": "function", "name": "test_tool", "description": "test", "parameters": {"type": "object", "properties": {}}}]
            }
        }))
        
        msg = json.loads(await ws.recv())
        if msg["type"] == "session.updated":
            print("Tools after first update:", [t["name"] for t in msg["session"].get("tools", [])])
            
        # 2. Update ONLY instructions
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "instructions": "Be a helpful assistant."
            }
        }))
        
        msg = json.loads(await ws.recv())
        if msg["type"] == "session.updated":
            print("Tools after second update:", [t["name"] for t in msg["session"].get("tools", [])])

asyncio.run(test())
