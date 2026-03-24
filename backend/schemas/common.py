"""
Common shared Pydantic schemas.
"""

from typing import Optional, Any
from pydantic import BaseModel


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Error response."""
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None


class TranslationRequest(BaseModel):
    """Request for text translation."""
    text: str
    source_lang: str = "auto"
    target_lang: str = "en"


class TranslationResponse(BaseModel):
    """Response with translated text."""
    original_text: str
    translated_text: str
    source_lang: str
    target_lang: str
    success: bool = True


class AudioTranscribeRequest(BaseModel):
    """Request for audio transcription."""
    language: str = "en"


class AudioTranscribeResponse(BaseModel):
    """Response with transcribed text."""
    text: str
    language: str
    confidence: Optional[float] = None


class TTSRequest(BaseModel):
    """Request for text-to-speech."""
    text: str
    language: str = "en"


class TTSResponse(BaseModel):
    """Response with audio data."""
    audio_base64: str
    format: str = "mp3"
    language: str


class QRDecodeRequest(BaseModel):
    """Request for QR code decoding."""
    pass  # Image sent as file


class QRDecodeResponse(BaseModel):
    """Response with decoded QR data."""
    data: str
    success: bool = True
    is_url: bool = False
    is_anchor: bool = False


class AnchorPayload(BaseModel):
    """Decoded anchor QR payload."""
    type: str = "anchor"
    shop_id: str
    anchor_id: str
    name: str
    x: int
    y: int
    v: int = 1


class QRAnchorValidation(BaseModel):
    """Response from anchor validation."""
    valid: bool
    payload: Optional[AnchorPayload] = None
    error: Optional[str] = None
