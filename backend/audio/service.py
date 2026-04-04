"""
Audio service for speech recognition and text-to-speech.
"""

import io
import os
import re
import tempfile
from typing import Optional, Tuple
import speech_recognition as sr
from deep_translator import GoogleTranslator
from gtts import gTTS

from config import get_settings

try:
    import edge_tts
except Exception:
    edge_tts = None

settings = get_settings()


# Language code mappings
LANGUAGE_CODES = {
    "en": {"sr": "en-US", "tts": "en"},
    "hi": {"sr": "hi-IN", "tts": "hi", "tts_tld": "co.in"},
    "or": {"sr": "or-IN", "tts": "or", "tts_tld": "co.in"},  # Odia
    "bn": {"sr": "bn-IN", "tts": "bn", "tts_tld": "co.in"},  # Bengali
    "ta": {"sr": "ta-IN", "tts": "ta", "tts_tld": "co.in"},  # Tamil
}
ODIA_SCRIPT_PATTERN = re.compile(r"[\u0B00-\u0B7F]")
EDGE_VOICE_LOCALES = {
    "en": "en-US",
    "hi": "hi-IN",
    "or": "or-IN",
    "bn": "bn-IN",
    "ta": "ta-IN",
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

    def get_tts_tld(self, lang: str) -> Optional[str]:
        """Get gTTS top-level domain (accent hint) for a language."""
        if lang in LANGUAGE_CODES:
            return LANGUAGE_CODES[lang].get("tts_tld")
        return None

    @staticmethod
    def _clean_tts_text(text: str) -> str:
        """Normalize spacing and punctuation that can harm speech rhythm."""
        normalized = (
            text.replace("|", ", ")
            .replace("\n", " ")
            .replace("\r", " ")
            .strip()
        )
        return " ".join(normalized.split())

    def _prepare_odia_text(self, text: str) -> str:
        """
        Ensure Odia TTS receives Odia script whenever possible.
        If incoming text is mostly non-Odia, auto-translate to Odia.
        """
        if not text:
            return text

        if ODIA_SCRIPT_PATTERN.search(text):
            return text

        try:
            translated = GoogleTranslator(source="auto", target="or").translate(text)
            if translated:
                return translated
        except Exception as exc:
            print(f"DEBUG: Odia pre-translation failed: {exc}")

        return text

    async def _synthesize_with_edge(
        self,
        text: str,
        language: str
    ) -> Optional[bytes]:
        """
        Synthesize speech with Edge neural voices.
        Returns audio bytes or None when unsupported/unavailable.
        """
        if edge_tts is None:
            return None

        locale = EDGE_VOICE_LOCALES.get(language)
        if not locale:
            return None

        try:
            voices = await edge_tts.list_voices()
            matching = [
                voice for voice in voices
                if voice.get("Locale", "").lower() == locale.lower()
            ]
            if not matching:
                return None

            # Prefer neural voice, then female, then first match.
            preferred = next(
                (
                    v for v in matching
                    if "neural" in v.get("ShortName", "").lower()
                    and v.get("Gender", "").lower() == "female"
                ),
                None,
            ) or next(
                (v for v in matching if "neural" in v.get("ShortName", "").lower()),
                None,
            ) or matching[0]

            voice_name = preferred.get("ShortName")
            if not voice_name:
                return None

            communicate = edge_tts.Communicate(text=text, voice=voice_name, rate="+0%")
            chunks = []
            async for event in communicate.stream():
                if event.get("type") == "audio" and event.get("data"):
                    chunks.append(event["data"])

            if not chunks:
                return None

            return b"".join(chunks)
        except Exception as exc:
            print(f"DEBUG: Edge TTS failed for {language}: {exc}")
            return None

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

    async def text_to_speech(
        self,
        text: str,
        language: str = "en"
    ) -> Tuple[Optional[bytes], Optional[str]]:
        """
        Convert text to speech.
        Returns (audio_bytes, error_message).
        """
        clean_text = ""
        try:
            clean_text = self._clean_tts_text(text or "")
            if not clean_text:
                return None, "No text provided for TTS"

            if language == "or":
                clean_text = self._prepare_odia_text(clean_text)
                # Prefer neural Odia voice when available.
                edge_audio = await self._synthesize_with_edge(clean_text, language)
                if edge_audio:
                    return edge_audio, None

            # Get TTS language code
            lang_code = self.get_tts_language(language)
            tld = self.get_tts_tld(language)

            # Generate speech
            try:
                tts_kwargs = {"text": clean_text, "lang": lang_code, "slow": False}
                if tld:
                    tts_kwargs["tld"] = tld
                tts = gTTS(**tts_kwargs)
            except Exception:
                # Some environments reject specific TLDs; retry without it.
                tts = gTTS(text=clean_text, lang=lang_code, slow=False)

            # Save to buffer
            buffer = io.BytesIO()
            tts.write_to_fp(buffer)
            buffer.seek(0)

            return buffer.getvalue(), None

        except Exception as e:
            # Try fallback to English
            if language != "en":
                try:
                    tts = gTTS(text=clean_text, lang="en", slow=False)
                    buffer = io.BytesIO()
                    tts.write_to_fp(buffer)
                    buffer.seek(0)
                    return buffer.getvalue(), f"Fallback to English: {str(e)}"
                except Exception as e2:
                    return None, f"TTS failed: {str(e2)}"

            return None, f"TTS error: {str(e)}"


# Singleton instance
audio_service = AudioService()
