import asyncio
import websockets
import json
import os

API_KEY = os.environ.get("OPENAI_API_KEY")
MODEL = "gpt-realtime-2.1"

async def test():
    uri = f"wss://api.openai.com/v1/realtime?model={MODEL}"
    headers = {"Authorization": f"Bearer {API_KEY}", "OpenAI-Beta": "realtime=v1"}
    
    async with websockets.connect(uri, additional_headers=headers) as ws:
        print("Connected with model: " + MODEL)
        await asyncio.sleep(1)

asyncio.run(test())
