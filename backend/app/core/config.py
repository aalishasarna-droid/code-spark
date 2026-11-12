from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # API Configuration
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # Ollama Configuration
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    
    # Gemini Configuration
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    
    # OpenAI Configuration
    OPENAI_API_KEY: str = ""
    
    # Supabase Configuration
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()
