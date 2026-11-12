import re

with open("app/api/endpoints/knowledge.py", "r") as f:
    content = f.read()

# Add debug print for audio buffer append
content = content.replace('if isinstance(msg, dict) and msg.get("type") == "input_audio_buffer.append":', 
                          'if isinstance(msg, dict) and msg.get("type") == "input_audio_buffer.append":\n                                # print("🎵 [Audio chunk]")')

# Add debug print for openai messages
content = content.replace('msg_type = msg.get("type")', 
                          'msg_type = msg.get("type")\n                        print(f"📨 OpenAI: {msg_type}")')

with open("app/api/endpoints/knowledge.py", "w") as f:
    f.write(content)
