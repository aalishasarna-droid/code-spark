import asyncio
import websockets
import json

async def test_ws():
    uri = 'ws://localhost:8000/api/v1/jarvis/ws'
    try:
        async with websockets.connect(uri) as ws:
            print('Connected to E D I T H WS')
            # Wait for backend to send session.update to OpenAI and get response
            await asyncio.sleep(2)
            
            # Send context update like frontend
            await ws.send(json.dumps({
                "type": "context_update",
                "context": {
                    "code": "print('hello')",
                    "filePath": "test.py",
                    "output": "",
                    "error": ""
                }
            }))
            
            await asyncio.sleep(2)
            print('Done')
    except Exception as e:
        print(f'Error: {e}')

asyncio.run(test_ws())
