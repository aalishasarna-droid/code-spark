import asyncio
import websockets
import json
import os

API_KEY = os.environ.get("OPENAI_API_KEY")

async def test_model(model):
    uri = f"wss://api.openai.com/v1/realtime?model={model}"
    headers = {"Authorization": f"Bearer {API_KEY}"}
    
    try:
        async with websockets.connect(uri, additional_headers=headers) as ws:
            print(f"Connected to {model} WITHOUT beta header!")
            await asyncio.sleep(1)
    except Exception as e:
        print(f"Error connecting to {model}: {e}")

async def main():
    await test_model("gpt-realtime-2.1")
    await test_model("gpt-4o-realtime-preview-2024-10-01")

asyncio.run(main())
