"""
Audio router for speech recognition and text-to-speech.
"""

import base64
from fastapi import APIRouter, HTTPException, status, UploadFile, File
from fastapi.responses import Response

from audio.service import audio_service
from schemas.common import (
    AudioTranscribeResponse,
    TTSRequest,
    TTSResponse
)

router = APIRouter()


@router.post("/transcribe", response_model=AudioTranscribeResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = "en"
):
    """
    Transcribe audio file to text.
    Supports languages: en, hi, or, bn, ta
    """
    try:
        content = await file.read()
        
        text, error = audio_service.transcribe_audio(content, language)
        
        if error and not text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error
            )
        
        return AudioTranscribeResponse(
            text=text or "",
            language=language,
            confidence=None  # Google doesn't return confidence for basic API
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}"
        )


@router.post("/tts")
async def text_to_speech(request: TTSRequest):
    """
    Convert text to speech audio.
    Returns MP3 audio file.
    """
    try:
        audio_bytes, error = audio_service.text_to_speech(
            request.text,
            request.language
        )
        
        if not audio_bytes:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error or "TTS generation failed"
            )
        
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "attachment; filename=speech.mp3"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"TTS failed: {str(e)}"
        )


@router.post("/tts-base64", response_model=TTSResponse)
async def text_to_speech_base64(request: TTSRequest):
    """
    Convert text to speech and return as base64.
    """
    try:
        audio_bytes, error = audio_service.text_to_speech(
            request.text,
            request.language
        )
        
        if not audio_bytes:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error or "TTS generation failed"
            )
        
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        
        return TTSResponse(
            audio_base64=audio_base64,
            format="mp3",
            language=request.language
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"TTS failed: {str(e)}"
        )


@router.get("/languages")
async def get_supported_languages():
    """
    Get list of supported languages for audio processing.
    """
    return {
        "languages": [
            {"code": "en", "name": "English"},
            {"code": "hi", "name": "Hindi"},
            {"code": "or", "name": "Odia"},
            {"code": "bn", "name": "Bengali"},
            {"code": "ta", "name": "Tamil"},
        ]
    }
