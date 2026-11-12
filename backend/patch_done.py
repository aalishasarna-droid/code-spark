import re

with open('app/api/endpoints/jarvis.py', 'r') as f:
    content = f.read()

# Replace the logging of response.done
old_log = """                            elif msg_type not in ['response.output_audio.delta', 'input_audio_buffer.speech_started', 'input_audio_buffer.committed']:
                                print(f"📨 OpenAI: {msg_type}")
                                if msg_type in ['session.created', 'session.updated']:"""

new_log = """                            elif msg_type not in ['response.output_audio.delta', 'input_audio_buffer.speech_started', 'input_audio_buffer.committed']:
                                print(f"📨 OpenAI: {msg_type}")
                                if msg_type == 'response.done':
                                    print(f"   [DEBUG] response.done details: {json.dumps(msg_data, indent=2)[:500]}...")
                                if msg_type in ['session.created', 'session.updated']:"""

content = content.replace(old_log, new_log)

with open('app/api/endpoints/jarvis.py', 'w') as f:
    f.write(content)

