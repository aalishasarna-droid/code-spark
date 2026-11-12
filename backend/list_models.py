import urllib.request
import json
import os

API_KEY = os.environ.get("OPENAI_API_KEY")
req = urllib.request.Request(
    "https://api.openai.com/v1/models",
    headers={"Authorization": f"Bearer {API_KEY}"}
)

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        realtime_models = [m['id'] for m in data['data'] if 'realtime' in m['id']]
        print("Realtime Models found:")
        for m in realtime_models:
            print("-", m)
except Exception as e:
    print(f"Error: {e}")

