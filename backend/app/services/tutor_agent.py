import httpx
import re
from app.core.config import settings
from app.models.schemas import EditorState, TutorResponse

# Optional: Gemini support (not required for Ollama-only mode)
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("ℹ️ google-generativeai not installed. Gemini model unavailable. Using Ollama only.")

class TutorAgent:
    """
    Shadow Tutor Agent - Provides Socratic guidance without giving direct answers
    Supports both Ollama (local) and Gemini (cloud) models
    """
    
    def __init__(self):
        self.ollama_url = f"{settings.OLLAMA_BASE_URL}/api/generate"
        self.ollama_model = settings.OLLAMA_MODEL
        
        # Configure Gemini if API key is provided AND package is installed
        if GEMINI_AVAILABLE and settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_gemini_api_key_here":
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.gemini_model = genai.GenerativeModel(settings.GEMINI_MODEL)
        else:
            self.gemini_model = None
        
    def build_context(self, editor_state: EditorState, user_question: str, rag_context: str = "") -> str:
        """
        Build context from editor state for the LLM
        """
        context = f"""You are a Socratic Tutor helping a student learn to code.

Current File: {editor_state.file_path}
Language: {editor_state.language}
Cursor Position: Line {editor_state.cursor_line}, Column {editor_state.cursor_column}

Code:
```{editor_state.language}
{editor_state.full_code}
```

"""
        if editor_state.selected_text:
            context += f"\nSelected Text:\n```\n{editor_state.selected_text}\n```\n"
            
        if editor_state.errors:
            context += f"\n⚠️ Errors Detected:\n" + "\n".join(f"- {err}" for err in editor_state.errors) + "\n"
        
        # Add execution results if available - PROMINENTLY
        last_execution = getattr(editor_state, 'last_execution', None)
        if last_execution:
            context += f"\n{'='*50}\n"
            context += f"📊 EXECUTION RESULTS (Student just ran this code):\n"
            context += f"{'='*50}\n"
            if last_execution.get('output'):
                context += f"✅ Output:\n{last_execution['output']}\n"
            if last_execution.get('error'):
                context += f"❌ Error:\n{last_execution['error']}\n"
            context += f"Executed at: {last_execution.get('timestamp', 'unknown')}\n"
            context += f"{'='*50}\n"
        
        # Add RAG context if available
        if rag_context:
            context += f"\n{'='*50}\n"
            context += f"📚 RELEVANT CODE FROM PROJECT:\n"
            context += f"{'='*50}\n"
            context += rag_context
            context += f"{'='*50}\n"
            
        context += f"\n💬 Student Question: {user_question}\n"
        
        # Add guidance based on question type
        if "correct" in user_question.lower() or "right" in user_question.lower():
            context += "\n[Student is asking if their code/output is correct - acknowledge if it is, then ask them to explain]\n"
        elif "how" in user_question.lower() or "why" in user_question.lower():
            context += "\n[Student wants to understand - explain the concept, then ask a follow-up question]\n"
        elif "error" in user_question.lower() or "wrong" in user_question.lower():
            context += "\n[Student has an error - point it out gently, give a hint, suggest what to review]\n"
        elif "where" in user_question.lower() and ("defined" in user_question.lower() or "function" in user_question.lower()):
            context += "\n[Student is asking about code location - use the RAG context to show where things are defined]\n"
        
        return context
    
    def build_prompt(self, context: str) -> str:
        """
        Build the Socratic tutor prompt
        """
        system_prompt = """You are a supportive Socratic Tutor helping students learn to code.

PERSONALITY:
- Encouraging and positive
- Acknowledge correct work first
- Guide through questions, not lectures
- Celebrate progress and effort

RULES:
1. If code is correct: Say "Yes, that's correct!" then ask them to explain WHY it works
2. If code has errors: Point out the error gently, then guide them to fix it
3. Use questions to deepen understanding, not to test
4. Keep responses under 100 words
5. Be warm and supportive

RESPONSE PATTERN:
✅ Correct code: "Great job! Your output is correct. Can you explain how [specific part] works?"
❌ Error: "I see an issue on line X. What do you think [variable/function] should be doing here?"
❓ Question: "Good question! Let's think about [concept]. What happens when...?"

HELPFUL FEATURES:
- Suggest reviewing specific concepts when stuck
- Offer hints before full explanations
- Connect to real-world examples
- Encourage experimentation

Remember: You're a supportive guide, not a strict examiner. Build confidence while teaching!
"""
        
        instruction = (
            "INSTRUCTION FOR SOCRATIC TUTOR:\n"
            "- Speak directly to the student as their supportive coding tutor.\n"
            "- Do NOT include internal planning bullets, role summaries, or draft labels.\n"
            "- Output ONLY your direct, warm response to the student:"
        )
        return f"{system_prompt}\n\n{context}\n\n{instruction}"
    
    def _clean_tutor_response(self, text: str) -> str:
        """Strip any thinking tags or planning preamble from reasoning models"""
        if not text:
            return ""
        # Remove <think>...</think> if present
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
        # If model outputs draft markers like "*Draft 1*:" or "Draft:", take text after the last draft
        draft_match = re.search(r'(?:\*+Draft\s*\d*\*+:?|Draft\s*\d*:?)\s*(.*)', text, flags=re.DOTALL | re.IGNORECASE)
        if draft_match:
            text = draft_match.group(1).strip()
        # If starts with bulleted internal prompt echo like "* Role:" or "* Personality:"
        lines = text.split('\n')
        cleaned_lines = []
        skipping_preamble = True
        for line in lines:
            stripped = line.strip()
            if skipping_preamble and (
                stripped.startswith('*   Role:') or stripped.startswith('* Role:') or
                stripped.startswith('*   Personality:') or stripped.startswith('* Personality:') or
                stripped.startswith('*   Rules:') or stripped.startswith('* Rules:') or
                stripped.startswith('*   Scenario:') or stripped.startswith('* Scenario:') or
                stripped.startswith('*   Code:') or stripped.startswith('* Code:') or
                stripped.startswith('*   Student Question:') or stripped.startswith('* Student Question:')
            ):
                continue
            skipping_preamble = False
            cleaned_lines.append(line)
        cleaned = '\n'.join(cleaned_lines).strip()
        return cleaned if cleaned else text.strip()
    
    async def get_guidance(self, editor_state: EditorState, user_question: str, model_type: str = "ollama", rag_context: str = "") -> TutorResponse:
        """
        Get Socratic guidance from the selected LLM with RAG context
        
        Args:
            editor_state: Current editor state
            user_question: Student's question
            model_type: "ollama" or "gemini"
            rag_context: Retrieved code context from RAG
        """
        try:
            context = self.build_context(editor_state, user_question, rag_context)
            prompt = self.build_prompt(context)
            
            if model_type == "gemini":
                return await self._get_gemini_response(prompt)
            else:
                return await self._get_ollama_response(prompt)
                    
        except Exception as e:
            err_type = type(e).__name__
            err_msg = str(e) if str(e) else "Timeout or connection error"
            print(f"❌ Error calling LLM [{err_type}]: {err_msg}")
            return self._get_fallback_response(user_question)
    
    async def _get_ollama_response(self, prompt: str) -> TutorResponse:
        """
        Get response from Ollama (local LLM) with support for thinking tokens and reasonable token budget
        """
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                self.ollama_url,
                json={
                    "model": self.ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "num_predict": 350,
                        "temperature": 0.7,
                    }
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                ai_response = (result.get("response") or "").strip()
                
                # If the reasoning model placed the content in thinking or response is empty
                if not ai_response:
                    thinking = (result.get("thinking") or "").strip()
                    if thinking:
                        ai_response = thinking
                
                # Clean planning/reasoning preamble if present
                ai_response = self._clean_tutor_response(ai_response)
                
                # If still empty, use a graceful fallback
                if not ai_response:
                    ai_response = "I examined your code! What specific question or line would you like to explore together?"
                
                return TutorResponse(
                    response=ai_response,
                    hints=[],
                    related_concepts=[]
                )
            else:
                raise Exception(f"Ollama returned status {response.status_code}: {response.text}")
    
    async def _get_gemini_response(self, prompt: str) -> TutorResponse:
        """
        Get response from Gemini (cloud LLM)
        """
        if not self.gemini_model:
            raise Exception("Gemini API key not configured")
        
        # Gemini API is synchronous, but we'll wrap it for consistency
        response = self.gemini_model.generate_content(prompt)
        
        return TutorResponse(
            response=response.text,
            hints=[],
            related_concepts=[]
        )
    
    def _get_fallback_response(self, question: str) -> TutorResponse:
        """
        Provide a fallback response when LLM is unavailable
        """
        return TutorResponse(
            response="I'm having trouble connecting to the AI tutor right now. While we wait, here are some things you can try:\n\n1. Check if your code runs without errors\n2. Test with different inputs\n3. Add print statements to see what's happening\n4. Break down the problem into smaller steps\n\nWhat specific part would you like help understanding?",
            hints=[
                "Try running your code to see the output",
                "Think about what each line does step by step",
                "Test with simple examples first"
            ],
            related_concepts=[]
        )

tutor_agent = TutorAgent()
