"""
Translation service using Google Translate.
"""

from typing import Dict, Optional
import time
from deep_translator import GoogleTranslator

from config import get_settings

settings = get_settings()


# Language name to code mapping
LANGUAGE_MAP = {
    "english": "en",
    "hindi": "hi",
    "odia": "or",
    "bengali": "bn",
    "tamil": "ta",
    "en": "en",
    "hi": "hi",
    "or": "or",
    "bn": "bn",
    "ta": "ta",
}


class TranslationService:
    """Service for text translation using Google Translate."""
    
    def __init__(self):
        self.cache: Dict[str, str] = {}  # Simple translation cache
        self.max_retries = 3
    
    def _get_language_code(self, lang: str) -> str:
        """Convert language name to code."""
        return LANGUAGE_MAP.get(lang.lower(), lang.lower())
    
    def translate(
        self,
        text: str,
        source_lang: str = "auto",
        target_lang: str = "en"
    ) -> Dict:
        """
        Translate text from source to target language.
        Returns dict with translated_text, success, and error fields.
        """
        # Normalize language codes
        source_lang = self._get_language_code(source_lang)
        target_lang = self._get_language_code(target_lang)
        
        # Skip if same language
        if source_lang == target_lang:
            return {
                "translated_text": text,
                "original_text": text,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "success": True
            }
        
        # Check cache
        cache_key = f"{source_lang}:{target_lang}:{text}"
        if cache_key in self.cache:
            return {
                "translated_text": self.cache[cache_key],
                "original_text": text,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "success": True,
                "cached": True
            }
        
        # Try translation with retries
        for attempt in range(self.max_retries):
            try:
                translator = GoogleTranslator(
                    source=source_lang,
                    target=target_lang
                )
                
                translated = translator.translate(text)
                
                if translated:
                    # Cache successful translation
                    self.cache[cache_key] = translated
                    
                    return {
                        "translated_text": translated,
                        "original_text": text,
                        "source_lang": source_lang,
                        "target_lang": target_lang,
                        "success": True
                    }
                else:
                    if attempt == self.max_retries - 1:
                        return {
                            "translated_text": text,
                            "original_text": text,
                            "source_lang": source_lang,
                            "target_lang": target_lang,
                            "success": False,
                            "error": "Translation returned empty result"
                        }
                        
            except Exception as e:
                if attempt == self.max_retries - 1:
                    return {
                        "translated_text": text,
                        "original_text": text,
                        "source_lang": source_lang,
                        "target_lang": target_lang,
                        "success": False,
                        "error": str(e)
                    }
                
                # Wait before retry
                time.sleep(1)
        
        return {
            "translated_text": text,
            "original_text": text,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "success": False,
            "error": "Max retries exceeded"
        }
    
    def clear_cache(self):
        """Clear the translation cache."""
        self.cache.clear()
    
    def get_supported_languages(self):
        """Get list of supported languages."""
        return [
            {"code": "en", "name": "English"},
            {"code": "hi", "name": "Hindi"},
            {"code": "or", "name": "Odia"},
            {"code": "bn", "name": "Bengali"},
            {"code": "ta", "name": "Tamil"},
        ]


# Singleton instance
translation_service = TranslationService()
