"""
Audio service for speech recognition and text-to-speech.
"""

import html
import io
import os
import tempfile
from typing import Optional, Tuple

import httpx
import speech_recognition as sr
from gtts import gTTS

from config import get_settings

settings = get_settings()


# Language code mappings
LANGUAGE_CODES = {
    "en": {"sr": "en-US", "tts": "en"},
    "hi": {"sr": "hi-IN", "tts": "hi"},
    "or": {"sr": "or-IN", "tts": "or"},  # Odia
    "bn": {"sr": "bn-IN", "tts": "bn"},  # Bengali
    "ta": {"sr": "ta-IN", "tts": "ta"},  # Tamil
}


class AudioService:
    """Service for audio processing, speech recognition and TTS."""

    def __init__(self):
        self.recognizer = sr.Recognizer()

    def get_sr_language(self, lang: str) -> str:
        """Get speech recognition language code."""
        if lang in LANGUAGE_CODES:
            return LANGUAGE_CODES[lang]["sr"]
        return "en-US"

    def get_tts_language(self, lang: str) -> str:
        """Get TTS language code."""
        if lang in LANGUAGE_CODES:
            return LANGUAGE_CODES[lang]["tts"]
        return "en"

    def _normalize_language(self, language: str) -> str:
        return (language or "en").strip().lower()

    def _azure_ready(self) -> bool:
        return bool(settings.AZURE_SPEECH_KEY and settings.AZURE_SPEECH_REGION)

    def _use_azure_for_language(self, language: str) -> bool:
        normalized = self._normalize_language(language)
        if not self._azure_ready():
            return False

        # Odia is where we need better accent quality most.
        if settings.AZURE_USE_FOR_ODIA_ONLY:
            return normalized == "or"

        # Current implementation guarantees Azure voice profile only for Odia.
        return normalized == "or"

    def _strict_odia_mode(self, language: str) -> bool:
        normalized = self._normalize_language(language)
        return bool(settings.AZURE_STRICT_ODIA and normalized == "or")

    def _azure_stt_language(self, language: str) -> str:
        normalized = self._normalize_language(language)
        if normalized == "or":
            return "or-IN"
        return self.get_sr_language(normalized)

    def _azure_tts_voice(self, language: str) -> str:
        normalized = self._normalize_language(language)
        if normalized == "or":
            return settings.AZURE_ODIA_VOICE
        return ""

    def _transcribe_with_azure(
        self,
        audio_bytes: bytes,
        language: str,
    ) -> Tuple[Optional[str], Optional[str]]:
        """Transcribe WAV audio with Azure Speech REST API."""
        if not self._azure_ready():
            return None, "Azure Speech credentials are not configured"

        stt_language = self._azure_stt_language(language)
        endpoint = (
            f"https://{settings.AZURE_SPEECH_REGION}.stt.speech.microsoft.com"
            "/speech/recognition/conversation/cognitiveservices/v1"
        )

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    endpoint,
                    params={"language": stt_language, "format": "simple"},
                    headers={
                        "Ocp-Apim-Subscription-Key": settings.AZURE_SPEECH_KEY,
                        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
                        "Accept": "application/json",
                    },
                    content=audio_bytes,
                )

            if response.status_code != 200:
                detail = response.text[:200] if response.text else ""
                return None, f"Azure STT failed ({response.status_code}): {detail}"

            payload = response.json()
            text = str(payload.get("DisplayText", "")).strip()
            if text:
                return text, None

            status = str(payload.get("RecognitionStatus", "")).strip()
            if status.lower() == "nomatch":
                return None, "Could not understand the audio"

            return None, "Azure STT did not return recognized text"

        except Exception as e:
            return None, f"Azure STT error: {str(e)}"

    def _text_to_speech_with_azure(
        self,
        text: str,
        language: str,
    ) -> Tuple[Optional[bytes], Optional[str]]:
        """Generate speech with Azure Speech REST API."""
        if not self._azure_ready():
            return None, "Azure Speech credentials are not configured"

        voice_name = self._azure_tts_voice(language)
        locale = self._azure_stt_language(language)
        if not voice_name:
            return None, f"No Azure voice profile configured for language '{language}'"

        endpoint = f"https://{settings.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
        escaped_text = html.escape(text)
        ssml = (
            f"<speak version='1.0' xml:lang='{locale}'>"
            f"<voice name='{voice_name}'>{escaped_text}</voice>"
            f"</speak>"
        )

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    endpoint,
                    headers={
                        "Ocp-Apim-Subscription-Key": settings.AZURE_SPEECH_KEY,
                        "Content-Type": "application/ssml+xml",
                        "X-Microsoft-OutputFormat": settings.AZURE_TTS_OUTPUT_FORMAT,
                        "User-Agent": "cartmapper-audio",
                    },
                    content=ssml.encode("utf-8"),
                )

            if response.status_code != 200:
                detail = response.text[:200] if response.text else ""
                return None, f"Azure TTS failed ({response.status_code}): {detail}"

            return response.content, None

        except Exception as e:
            return None, f"Azure TTS error: {str(e)}"

    def transcribe_audio(
        self,
        audio_bytes: bytes,
        language: str = "en"
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Transcribe audio to text.
        Supports various formats via pydub if it's installed.
        Returns (transcribed_text, error_message).
        """
        temp_path = None
        normalized_lang = self._normalize_language(language)
        print(f"DEBUG: Transcribing audio. Byte length: {len(audio_bytes)}, Language: {normalized_lang}")

        try:
            # Try to determine if we need conversion
            # Simple check for WAV header (RIFF)
            is_wav = audio_bytes.startswith(b"RIFF")
            print(f"DEBUG: Is standard WAV? {is_wav}")

            # If not WAV, try to convert
            if not is_wav:
                print(f"DEBUG: Not a WAV file (starts with {audio_bytes[:4]}). Attempting conversion...")

                # Try pydub first
                try:
                    from pydub import AudioSegment

                    audio_segment = AudioSegment.from_file(io.BytesIO(audio_bytes))
                    wav_io = io.BytesIO()
                    audio_segment.export(wav_io, format="wav")
                    audio_bytes = wav_io.getvalue()
                    print(f"DEBUG: Audio converted to WAV via pydub. New length: {len(audio_bytes)}")
                except Exception as pydub_err:
                    print(f"DEBUG: pydub conversion failed: {pydub_err}. Trying soundfile fallback...")

                    # Fallback to soundfile which might handle some formats without ffmpeg
                    try:
                        import soundfile as sf

                        data, samplerate = sf.read(io.BytesIO(audio_bytes))
                        wav_io = io.BytesIO()
                        sf.write(wav_io, data, samplerate, format="WAV", subtype="PCM_16")
                        audio_bytes = wav_io.getvalue()
                        print(f"DEBUG: Audio converted to WAV via soundfile. New length: {len(audio_bytes)}")
                    except Exception as sf_err:
                        print(f"DEBUG: soundfile conversion failed: {sf_err}")
                        # If both fail, we'll try to process it anyway, but it's likely doomed.

            if self._use_azure_for_language(normalized_lang):
                azure_text, azure_error = self._transcribe_with_azure(audio_bytes, normalized_lang)
                if azure_text:
                    print("DEBUG: Azure STT transcription successful")
                    return azure_text, None
                print(f"DEBUG: Azure STT failed, falling back to Google recognizer: {azure_error}")
                if self._strict_odia_mode(normalized_lang):
                    return None, (
                        "Odia Azure speech recognition failed. "
                        f"Reason: {azure_error}"
                    )
            elif self._strict_odia_mode(normalized_lang):
                return None, (
                    "Odia speech recognition is set to Azure-only mode. "
                    "Please configure AZURE_SPEECH_KEY and AZURE_SPEECH_REGION."
                )

            # Write to temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                f.write(audio_bytes)
                temp_path = f.name

            try:
                # Load audio file
                with sr.AudioFile(temp_path) as source:
                    audio = self.recognizer.record(source)

                # Get language code
                lang_code = self.get_sr_language(normalized_lang)
                print(f"DEBUG: Using SR language code: {lang_code}")

                # Transcribe using Google
                try:
                    text = self.recognizer.recognize_google(audio, language=lang_code)
                    print(f"DEBUG: Transcription successful: {text}")
                    return text, None
                except sr.UnknownValueError:
                    print("DEBUG: Speech recognition could not understand audio")
                    return None, "Could not understand the audio"
                except sr.RequestError as e:
                    print(f"DEBUG: Speech recognition service error: {e}")
                    return None, f"Speech recognition service error: {str(e)}"

            finally:
                # Clean up temp file
                if temp_path and os.path.exists(temp_path):
                    os.remove(temp_path)

        except Exception as e:
            print(f"DEBUG: Critical audio processing error: {e}")
            return None, f"Audio processing error: {str(e)}"

    def text_to_speech(
        self,
        text: str,
        language: str = "en"
    ) -> Tuple[Optional[bytes], Optional[str]]:
        """
        Convert text to speech.
        Returns (audio_bytes, error_message).
        """
        normalized_lang = self._normalize_language(language)

        if self._use_azure_for_language(normalized_lang):
            azure_audio, azure_error = self._text_to_speech_with_azure(text, normalized_lang)
            if azure_audio:
                return azure_audio, None
            print(f"DEBUG: Azure TTS failed, falling back to gTTS: {azure_error}")
            if self._strict_odia_mode(normalized_lang):
                return None, (
                    "Odia voice is set to Azure-only mode and Azure TTS failed. "
                    f"Reason: {azure_error}"
                )
        elif self._strict_odia_mode(normalized_lang):
            return None, (
                "Odia voice is set to Azure-only mode. "
                "Please configure AZURE_SPEECH_KEY and AZURE_SPEECH_REGION."
            )

        try:
            # Get TTS language code
            lang_code = self.get_tts_language(normalized_lang)

            # Generate speech
            tts = gTTS(text=text, lang=lang_code, slow=False)

            # Save to buffer
            buffer = io.BytesIO()
            tts.write_to_fp(buffer)
            buffer.seek(0)

            return buffer.getvalue(), None

        except Exception as e:
            # Try fallback to English
            if normalized_lang != "en":
                try:
                    tts = gTTS(text=text, lang="en", slow=False)
                    buffer = io.BytesIO()
                    tts.write_to_fp(buffer)
                    buffer.seek(0)
                    return buffer.getvalue(), f"Fallback to English: {str(e)}"
                except Exception as e2:
                    return None, f"TTS failed: {str(e2)}"

            return None, f"TTS error: {str(e)}"


# Singleton instance
audio_service = AudioService()
