export interface EditorState {
  file_path: string
  language: string
  full_code: string
  cursor_line: number
  cursor_column: number
  selected_text: string
  errors: string[]
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
}

export interface ContextPayload extends EditorState {
  user_question: string
}

// ==================== SMART ASSISTANT TYPES ====================

export interface CodeEdit {
  file_id: string
  file_path: string
  original_content: string
  proposed_content: string
  explanation: string
  edit_type: 'fix' | 'edit' | 'create'
  language: string
}

export interface AgentRequest {
  project_id: string
  file_id?: string
  file_path?: string
  instruction?: string
  error_output?: string
  code_content?: string
  language?: string
  model_type?: string
}
