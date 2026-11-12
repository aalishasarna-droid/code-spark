import json

EDITH_TOOLS = [
    {
        "type": "function",
        "name": "edit_code",
        "description": "Edit code in a project file based on a user instruction. Use this when the user asks you to modify, change, add, or refactor code in a specific file.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "The file path to edit (e.g. 'main.js', 'utils.py')"
                },
                "instruction": {
                    "type": "string",
                    "description": "What to change in the code (e.g. 'add error handling', 'fix the syntax error', 'add a hello world log')"
                }
            },
            "required": ["file_path", "instruction"]
        }
    }
]

print(json.dumps(EDITH_TOOLS, indent=2))
