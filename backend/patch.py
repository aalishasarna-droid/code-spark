import re

with open('app/api/endpoints/jarvis.py', 'r') as f:
    content = f.read()

# Replace the logging of session.updated
old_log = """                                if msg_type in ['session.created', 'session.updated']:
                                    print(f"   Details: {json.dumps(msg_data, indent=2)}")"""

new_log = """                                if msg_type in ['session.created', 'session.updated']:
                                    print(f"   Details: {json.dumps(msg_data, indent=2)}")
                                    # Print tool names specifically to verify
                                    session = msg_data.get('session', {})
                                    tools = session.get('tools', [])
                                    tool_names = [t.get('name') for t in tools]
                                    print(f"   🛠️ REGISTERED TOOLS: {tool_names}")"""

content = content.replace(old_log, new_log)

with open('app/api/endpoints/jarvis.py', 'w') as f:
    f.write(content)

