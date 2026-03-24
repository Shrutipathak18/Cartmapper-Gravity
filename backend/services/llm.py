"""
LLM service wrapper for Groq.
"""

from typing import Optional
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from config import get_settings

settings = get_settings()


class LLMService:
    """Service wrapper for LLM operations."""
    
    def __init__(self):
        self._llm: Optional[ChatGroq] = None
    
    @property
    def llm(self) -> ChatGroq:
        """Get or initialize the LLM."""
        if self._llm is None:
            if not settings.GROQ_API_KEY:
                raise ValueError("GROQ_API_KEY not configured")
            
            self._llm = ChatGroq(
                temperature=0.2,
                model_name=settings.GROQ_MODEL,
                groq_api_key=settings.GROQ_API_KEY
            )
        
        return self._llm
    
    def generate(self, prompt: str, **kwargs) -> str:
        """Generate a response from a prompt."""
        try:
            template = ChatPromptTemplate.from_template(prompt)
            chain = template | self.llm | StrOutputParser()
            return chain.invoke(kwargs)
        except Exception as e:
            return f"LLM error: {str(e)}"
    
    def is_available(self) -> bool:
        """Check if LLM is available."""
        return bool(settings.GROQ_API_KEY)


# Singleton instance
llm_service = LLMService()
