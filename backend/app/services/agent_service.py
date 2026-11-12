"""
Smart Assistant Agent Service
AI-powered code editing agent that can read, write, and fix code in project files.
All changes are synced to Supabase database with automatic version history.
"""
import httpx
import json
import re
from typing import Optional, Dict, List
from app.core.config import settings
from app.models.schemas import CodeEdit, AgentRequest
from app.services.file_service import file_service

# Optional: Gemini support
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class AgentService:
    """
    Smart Assistant - AI agent that can edit code, fix errors, and create files.
    Uses Ollama (local) or Gemini (cloud) as the LLM backend.
    All edits are saved to Supabase with automatic version history.
    """
    
    def __init__(self):
        self.ollama_url = f"{settings.OLLAMA_BASE_URL}/api/generate"
        self.ollama_model = settings.OLLAMA_MODEL
        
        # Configure Gemini if available
        self.gemini_model = None
        if GEMINI_AVAILABLE and settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_gemini_api_key_here":
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self.gemini_model = genai.GenerativeModel(settings.GEMINI_MODEL)
            except Exception as e:
                print(f"⚠️ Failed to configure Gemini for agent: {e}")
    
    def _build_fix_prompt(self, code: str, error: str, language: str, file_path: str, project_files: List[Dict] = None) -> str:
        """Build a prompt for error fixing"""
        prompt = f"""You are an expert coding assistant. Fix the error in the following code.

RULES:
1. Return ONLY the complete fixed code — no explanations, no markdown, no code fences
2. Keep all existing comments and structure intact
3. Only change what's needed to fix the error
4. Do NOT add markdown formatting like ```javascript or ``` around the code

File: {file_path}
Language: {language}

Current Code:
{code}

Error Output:
{error}
"""
        # Add other project files for context
        if project_files:
            prompt += "\n--- Other Project Files (for reference) ---\n"
            for f in project_files[:5]:  # Limit to 5 files for context window
                if f.get('path') != file_path and not f.get('is_folder', False) and f.get('content'):
                    prompt += f"\n// {f['path']}\n{f['content'][:500]}\n"
        
        prompt += "\nReturn ONLY the complete fixed code with no markdown formatting:"
        return prompt
    
    def _build_edit_prompt(self, code: str, instruction: str, language: str, file_path: str, project_files: List[Dict] = None) -> str:
        """Build a prompt for code editing"""
        prompt = f"""You are an expert coding assistant. Edit the following code based on the user's instruction.

RULES:
1. Return ONLY the complete modified code — no explanations, no markdown, no code fences
2. Apply the requested change while maintaining code quality
3. Keep all unrelated code intact
4. Do NOT add markdown formatting like ```javascript or ``` around the code

File: {file_path}
Language: {language}

Current Code:
{code}

User Instruction: {instruction}
"""
        if project_files:
            prompt += "\n--- Other Project Files (for reference) ---\n"
            for f in project_files[:5]:
                if f.get('path') != file_path and not f.get('is_folder', False) and f.get('content'):
                    prompt += f"\n// {f['path']}\n{f['content'][:500]}\n"
        
        prompt += "\nReturn ONLY the complete modified code with no markdown formatting:"
        return prompt
    
    def _build_create_prompt(self, instruction: str, language: str, file_path: str, project_files: List[Dict] = None) -> str:
        """Build a prompt for creating new code"""
        prompt = f"""You are an expert coding assistant. Create code for a new file based on the instruction.

RULES:
1. Return ONLY the code — no explanations, no markdown, no code fences
2. Write clean, well-commented, production-quality code
3. Follow best practices for {language}
4. Do NOT add markdown formatting like ```javascript or ``` around the code

File to create: {file_path}
Language: {language}

Instruction: {instruction}
"""
        if project_files:
            prompt += "\n--- Existing Project Files (for context) ---\n"
            for f in project_files[:5]:
                if not f.get('is_folder', False) and f.get('content'):
                    prompt += f"\n// {f['path']}\n{f['content'][:500]}\n"
        
        prompt += "\nReturn ONLY the code for the new file with no markdown formatting:"
        return prompt
    
    def _clean_llm_response(self, response: str) -> str:
        """Clean LLM response — strip markdown code fences if present"""
        text = response.strip()
        
        # Remove markdown code fences like ```javascript ... ``` or ```python ... ```
        # Match opening fence with optional language specifier
        text = re.sub(r'^```[\w]*\s*\n?', '', text)
        # Match closing fence
        text = re.sub(r'\n?```\s*$', '', text)
        
        return text.strip()
    
    async def _call_ollama(self, prompt: str) -> str:
        """Call Ollama LLM"""
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                self.ollama_url,
                json={
                    "model": self.ollama_model,
                    "prompt": prompt,
                    "stream": False
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                return self._clean_llm_response(result.get("response", ""))
            else:
                raise Exception(f"Ollama returned status {response.status_code}: {response.text}")
    
    async def _call_gemini(self, prompt: str) -> str:
        """Call Gemini LLM"""
        if not self.gemini_model:
            raise Exception("Gemini not configured")
        
        response = self.gemini_model.generate_content(prompt)
        return self._clean_llm_response(response.text)
    
    async def _call_llm(self, prompt: str, model_type: str = "ollama") -> str:
        """Call the selected LLM"""
        if model_type == "gemini" and self.gemini_model:
            return await self._call_gemini(prompt)
        else:
            return await self._call_ollama(prompt)
    
    def _identify_error_file(self, error_output: str, project_files: List[Dict], current_file_path: str) -> Optional[Dict]:
        """
        Parse the error output to identify which project file actually contains the error.
        Returns the file dict if found, or None if it's the current file.
        """
        if not project_files or not error_output:
            return None
        
        # Extract the erroring code snippet from the error output
        # Node.js errors look like:
        #   const diff = sub(7, 7
        #                       ^
        #   SyntaxError: missing ) after argument list
        # Python errors show the line content too
        
        error_lines = error_output.strip().split('\n')
        code_snippets = []
        for line in error_lines:
            stripped = line.strip()
            # Skip stack trace lines, error type lines, and pointer lines
            if stripped and not stripped.startswith('at ') and \
               not stripped.startswith('^') and \
               not stripped.startswith('/tmp/') and \
               not stripped.startswith('node:') and \
               not stripped.startswith('Node.js') and \
               'Error:' not in stripped and \
               'Traceback' not in stripped and \
               'File "' not in stripped and \
               len(stripped) > 3:
                code_snippets.append(stripped)
        
        print(f"🔍 Smart Assistant: Searching for error source in {len(project_files)} files")
        print(f"   Code snippets from error: {code_snippets[:3]}")
        
        # Search each project file for matching code snippets
        for snippet in code_snippets:
            for pf in project_files:
                if pf.get('is_folder', False) or not pf.get('content'):
                    continue
                file_path = pf.get('path', '')
                content = pf.get('content', '')
                
                # Check if this snippet exists in this file (but not the currently open file)
                if snippet in content and file_path != current_file_path:
                    print(f"   ✅ Found error source in: {file_path} (snippet: '{snippet[:40]}...')")
                    return pf
        
        # Fallback: check if error mentions a specific filename
        for pf in project_files:
            if pf.get('is_folder', False):
                continue
            file_name = pf.get('name', '')
            file_path = pf.get('path', '')
            if file_name and file_name in error_output and file_path != current_file_path:
                print(f"   ✅ Found error file by name mention: {file_path}")
                return pf
        
        print(f"   ℹ️ Error appears to be in the current file: {current_file_path}")
        return None

    async def fix_error(self, request: AgentRequest) -> CodeEdit:
        """
        Analyze an error and propose a fix.
        Returns a CodeEdit with the proposed changes.
        Intelligently detects which file actually has the error.
        """
        print(f"🔧 Smart Assistant: Fixing error (reported from {request.file_path})")
        
        # Get project files for context
        project_files = []
        if request.project_id:
            project_files = await file_service.get_project_files(request.project_id)
        
        # Detect which file actually has the error
        target_file_id = request.file_id
        target_file_path = request.file_path
        target_language = request.language
        
        error_file = self._identify_error_file(
            request.error_output, project_files, request.file_path
        )
        
        if error_file:
            # Error is in a DIFFERENT file than the one currently open
            target_file_id = error_file.get('id', request.file_id)
            target_file_path = error_file.get('path', request.file_path)
            target_language = error_file.get('language', request.language)
            code = error_file.get('content', '')
            print(f"🔧 Smart Assistant: Actual error is in {target_file_path}, not {request.file_path}")
        else:
            # Error is in the currently open file
            code = request.code_content
            if not code and request.file_id:
                file_data = await file_service.get_file(request.file_id)
                if file_data:
                    code = file_data.get('content', '')
        
        if not code:
            raise Exception("No code content provided or found")
        
        print(f"🔧 Smart Assistant: Fixing {target_file_path}")
        
        # Build prompt and call LLM
        prompt = self._build_fix_prompt(
            code=code,
            error=request.error_output,
            language=target_language,
            file_path=target_file_path,
            project_files=project_files
        )
        
        proposed_code = await self._call_llm(prompt, request.model_type)
        
        # Build explanation — mention which file was fixed
        file_note = ""
        if error_file:
            file_note = f" (in {target_file_path}, not the currently open file)"
        
        explanation_prompt = f"""In 1-2 sentences, explain what was wrong and what you fixed{file_note}.
Error was: {request.error_output[:200]}
Be concise."""
        
        try:
            explanation = await self._call_llm(explanation_prompt, request.model_type)
        except Exception:
            explanation = f"Fixed the error in {target_file_path}."
        
        return CodeEdit(
            file_id=target_file_id,
            file_path=target_file_path,
            original_content=code,
            proposed_content=proposed_code,
            explanation=explanation,
            edit_type="fix",
            language=target_language
        )
    
    async def edit_code(self, request: AgentRequest) -> CodeEdit:
        """
        Edit code based on a user instruction.
        Returns a CodeEdit with the proposed changes.
        """
        print(f"✏️ Smart Assistant: Editing {request.file_path} — '{request.instruction}'")
        
        # Get project files for context
        project_files = []
        if request.project_id:
            project_files = await file_service.get_project_files(request.project_id)
        
        code = request.code_content
        if not code and request.file_id:
            file_data = await file_service.get_file(request.file_id)
            if file_data:
                code = file_data.get('content', '')
        
        if not code:
            code = ""  # Allow empty for new content
        
        prompt = self._build_edit_prompt(
            code=code,
            instruction=request.instruction,
            language=request.language,
            file_path=request.file_path,
            project_files=project_files
        )
        
        proposed_code = await self._call_llm(prompt, request.model_type)
        
        return CodeEdit(
            file_id=request.file_id,
            file_path=request.file_path,
            original_content=code,
            proposed_content=proposed_code,
            explanation=f"Applied edit: {request.instruction}",
            edit_type="edit",
            language=request.language
        )
    
    async def create_file_content(self, request: AgentRequest) -> CodeEdit:
        """
        Generate code for a new file based on instruction.
        """
        print(f"📝 Smart Assistant: Creating {request.file_path}")
        
        project_files = []
        if request.project_id:
            project_files = await file_service.get_project_files(request.project_id)
        
        prompt = self._build_create_prompt(
            instruction=request.instruction,
            language=request.language,
            file_path=request.file_path,
            project_files=project_files
        )
        
        proposed_code = await self._call_llm(prompt, request.model_type)
        
        return CodeEdit(
            file_id=request.file_id,
            file_path=request.file_path,
            original_content="",
            proposed_content=proposed_code,
            explanation=f"Created new file: {request.instruction}",
            edit_type="create",
            language=request.language
        )
    
    async def apply_edit(self, file_id: str, new_content: str) -> bool:
        """
        Apply a proposed edit to the database.
        The Supabase trigger automatically creates a version backup.
        """
        print(f"💾 Smart Assistant: Applying edit to file {file_id}")
        
        success = await file_service.update_file(file_id, new_content)
        
        if success:
            print(f"✅ Edit applied and saved to database")
        else:
            print(f"❌ Failed to apply edit")
        
        return success


# Global instance
agent_service = AgentService()
