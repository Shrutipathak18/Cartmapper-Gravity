"""
Audio service for speech recognition and text-to-speech.
"""

import io
import os
import tempfile
from typing import Optional, Tuple
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
        print(f"DEBUG: Transcribing audio. Byte length: {len(audio_bytes)}, Language: {language}")

        try:
            # Try to determine if we need conversion
            # Simple check for WAV header (RIFF)
            is_wav = audio_bytes.startswith(b'RIFF')
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
                        sf.write(wav_io, data, samplerate, format='WAV', subtype='PCM_16')
                        audio_bytes = wav_io.getvalue()
                        print(f"DEBUG: Audio converted to WAV via soundfile. New length: {len(audio_bytes)}")
                    except Exception as sf_err:
                        print(f"DEBUG: soundfile conversion failed: {sf_err}")
                        # If both fail, we'll try to process it anyway, but it's likely doomed.

            # Write to temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                f.write(audio_bytes)
                temp_path = f.name

            try:
                # Load audio file
                with sr.AudioFile(temp_path) as source:
                    audio = self.recognizer.record(source)

                # Get language code
                lang_code = self.get_sr_language(language)
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
        try:
            # Get TTS language code
            lang_code = self.get_tts_language(language)

            # Generate speech
            tts = gTTS(text=text, lang=lang_code, slow=False)

            # Save to buffer
            buffer = io.BytesIO()
            tts.write_to_fp(buffer)
            buffer.seek(0)

            return buffer.getvalue(), None

        except Exception as e:
            # Try fallback to English
            if language != "en":
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
