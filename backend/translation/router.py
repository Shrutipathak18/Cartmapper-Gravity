"""
Translation router.
"""

from fastapi import APIRouter

from translation.service import translation_service
from schemas.common import TranslationRequest, TranslationResponse

router = APIRouter()


@router.post("", response_model=TranslationResponse)
async def translate_text(request: TranslationRequest):
    """
    Translate text from source to target language.
    Supports: en, hi, or, bn, ta
    Use 'auto' for automatic source language detection.
    """
    result = translation_service.translate(
        text=request.text,
        source_lang=request.source_lang,
        target_lang=request.target_lang
    )
    
    return TranslationResponse(
        original_text=result["original_text"],
        translated_text=result["translated_text"],
        source_lang=result["source_lang"],
        target_lang=result["target_lang"],
        success=result["success"]
    )


@router.get("/languages")
async def get_languages():
    """
    Get list of supported languages.
    """
    return {
        "languages": translation_service.get_supported_languages()
    }


@router.post("/clear-cache")
async def clear_cache():
    """
    Clear the translation cache.
    """
    translation_service.clear_cache()
    return {"message": "Translation cache cleared"}
