from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class EditorState(BaseModel):
    file_path: str
    language: str
    full_code: str
    cursor_line: int
    cursor_column: int
    selected_text: str = ""
    errors: List[str] = []

class ContextPayload(BaseModel):
    editor_state: EditorState
    user_question: str

class TutorResponse(BaseModel):
    response: str
    hints: List[str] = []
    related_concepts: List[str] = []

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: Optional[datetime] = None

# ==================== SMART ASSISTANT MODELS ====================

class AgentRequest(BaseModel):
    """Request for the Smart Assistant agent"""
    project_id: str
    file_id: str = ""
    file_path: str = ""
    instruction: str = ""  # User instruction like "add error handling"
    error_output: str = ""  # Error from code execution
    code_content: str = ""  # Current code in the file
    language: str = "javascript"
    model_type: str = "ollama"  # "ollama" or "gemini"
    
    model_config = {
        "protected_namespaces": ()
    }

class CodeEdit(BaseModel):
    """A proposed code edit from the Smart Assistant"""
    file_id: str
    file_path: str
    original_content: str
    proposed_content: str
    explanation: str
    edit_type: str = "fix"  # "fix", "edit", "create"
    language: str = "javascript"

class AgentApplyRequest(BaseModel):
    """Request to apply a proposed edit"""
    file_id: str
    new_content: str

