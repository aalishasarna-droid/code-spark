import asyncio
import websockets
import json
import os

API_KEY = os.environ.get("OPENAI_API_KEY")
MODEL = "gpt-realtime-2.1"

async def test():
    uri = f"wss://api.openai.com/v1/realtime?model={MODEL}"
    headers = {"Authorization": f"Bearer {API_KEY}"}
    
    async with websockets.connect(uri, additional_headers=headers) as ws:
        await ws.send(json.dumps({
            "type": "response.create"
        }))
        
        await asyncio.sleep(0.5)
        
        await ws.send(json.dumps({
            "type": "response.cancel"
        }))
        
        for _ in range(5):
            msg = json.loads(await ws.recv())
            if msg["type"] == "error":
                print("Error:", msg)
            elif msg["type"] == "response.done":
                print("Response cancelled:", msg)

asyncio.run(test())
