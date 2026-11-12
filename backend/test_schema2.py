import asyncio
import websockets
import json
import os

API_KEY = os.environ.get("OPENAI_API_KEY")
MODEL = "gpt-4o-realtime-preview-2024-12-17"

async def test():
    uri = f"wss://api.openai.com/v1/realtime?model={MODEL}"
    headers = {"Authorization": f"Bearer {API_KEY}", "OpenAI-Beta": "realtime=v1"}
    
    try:
        async with websockets.connect(uri, additional_headers=headers) as ws:
            print("Connected with model: " + MODEL)
            # Send ONLY NESTED format
            await ws.send(json.dumps({
                "type": "session.update",
                "session": {
                    "tools": [{
                        "type": "function",
                        "name": "test_nested",
                        "description": "A nested tool",
                        "parameters": {"type": "object", "properties": {}}
                    }]
                }
            }))
            await asyncio.sleep(1)
            print("Successfully sent nested tools!")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test())
