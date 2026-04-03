"""
Configuration module for CartMapper backend.
Uses Pydantic Settings for environment variable management.
"""

import os
import json
from functools import lru_cache
from typing import Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    APP_NAME: str = "CartMapper API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value):
        """Accept JSON array or comma-separated values from env."""
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []

            if raw.startswith("["):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        return parsed
                except json.JSONDecodeError:
                    pass

            return [origin.strip() for origin in raw.split(",") if origin.strip()]

        return value

    def cors_origins(self) -> list[str]:
        """Build normalized CORS origins including FRONTEND_URL."""
        combined = [*self.ALLOWED_ORIGINS, self.FRONTEND_URL]
        normalized: list[str] = []

        for origin in combined:
            if not origin:
                continue
            clean = str(origin).strip().strip('"').strip("'").rstrip("/")
            if clean and clean not in normalized:
                normalized.append(clean)

        return normalized
    
    # JWT Authentication
    JWT_SECRET_KEY: str = "your-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:5173/auth/callback"
    
    # Groq LLM
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    ENABLE_RAG: bool = False

    # Azure Speech (optional, recommended for Odia voice quality)
    AZURE_SPEECH_KEY: Optional[str] = None
    AZURE_SPEECH_REGION: Optional[str] = None
    AZURE_ODIA_VOICE: str = "or-IN-SubhasiniNeural"
    AZURE_USE_FOR_ODIA_ONLY: bool = True
    AZURE_TTS_OUTPUT_FORMAT: str = "audio-24khz-48kbitrate-mono-mp3"
    
    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    CHROMA_COLLECTION_NAME: str = "cartmapper-rag"

    # File Storage
    UPLOAD_DIR: str = "./uploads"
    QR_UPLOAD_DIR: str = "./uploads/qr"

    # HuggingFace Embeddings
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # Audio Settings
    AUDIO_UPLOAD_DIR: str = "./uploads/audio"
    MAX_AUDIO_SIZE_MB: int = 10
    
    # Document Settings
    DOCUMENT_UPLOAD_DIR: str = "./uploads/documents"
    MAX_DOCUMENT_SIZE_MB: int = 50
    
    # Translation
    DEFAULT_SOURCE_LANG: str = "auto"
    DEFAULT_TARGET_LANG: str = "en"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Create upload directories
settings = get_settings()
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.QR_UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.AUDIO_UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.DOCUMENT_UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
