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
        # Full payload exactly like jarvis.py
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "type": "session",  # <---- THE BUGGY PROXY HACK
                "instructions": "Test"
            }
        }))
        
        while True:
            msg = json.loads(await ws.recv())
            if msg["type"] == "error":
                print("Error:", msg)
                break
            elif msg["type"] == "session.updated":
                print("Success! Session updated.")
                break

asyncio.run(test())
