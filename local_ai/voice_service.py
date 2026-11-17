"""Local-only voice companion for ADEMI MIND.

The service binds only to 127.0.0.1 (configured by the launcher). It keeps
recordings in memory until a short-lived decoding file is needed, then removes
that file immediately after transcription.
"""

from __future__ import annotations

import asyncio
import math
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

VOICE_IDS = {
    "svetlana": "ru-RU-SvetlanaNeural",
    "dmitry": "ru-RU-DmitryNeural",
}
SUPPORTED_LANGUAGES = {"RU", "KG", "EN"}
WHISPER_LANGUAGE_CODES = {"RU": "ru", "KG": "ky", "EN": "en"}
MAX_TTS_CHARS = 6_000
MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_AUDIO_SECONDS = 60
TTS_TIMEOUT_SECONDS = 30

_whisper_model: Any | None = None


class TranscriptionModelUnavailable(RuntimeError):
    """Raised when the local Whisper runtime or model cannot be loaded."""


class AudioDecodeUnavailable(RuntimeError):
    """Raised when an uploaded recording cannot be inspected or decoded."""


class SpeechRequest(BaseModel):
    text: object
    voice: object


def normalize_language(value: object) -> str:
    return value if value in SUPPORTED_LANGUAGES else "RU"


def validate_speech_request(text: object, voice: object) -> tuple[str, str]:
    if not isinstance(text, str):
        raise ValueError("invalid speech text")

    normalized_text = text.strip()
    if not normalized_text or len(normalized_text) > MAX_TTS_CHARS:
        raise ValueError("invalid speech text")

    if not isinstance(voice, str) or voice not in VOICE_IDS:
        raise ValueError("invalid voice")

    return normalized_text, VOICE_IDS[voice]


async def collect_edge_audio(text: str, voice_id: str) -> bytes:
    import edge_tts

    audio = bytearray()
    communicate = edge_tts.Communicate(text, voice=voice_id, rate="-6%")
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio":
            audio.extend(chunk["data"])

    if not audio:
        raise RuntimeError("empty voice provider response")

    return bytes(audio)


def get_whisper_model() -> Any:
    global _whisper_model

    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel

            _whisper_model = WhisperModel("small", device="cpu", compute_type="int8")
        except Exception as error:  # Model files or a local runtime may be unavailable.
            raise TranscriptionModelUnavailable("transcription model unavailable") from error

    return _whisper_model


def decoder_available() -> bool:
    """Whether the required FFmpeg probe binary is available on this machine."""

    return shutil.which("ffprobe") is not None


def audio_duration_seconds(audio_path: Path) -> float:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(audio_path),
            ],
            capture_output=True,
            check=True,
            text=True,
            timeout=5,
        )
        duration = float(result.stdout.strip())
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        raise AudioDecodeUnavailable("audio decode unavailable") from error

    if not math.isfinite(duration) or duration < 0:
        raise AudioDecodeUnavailable("audio decode unavailable")

    return duration


def upload_suffix(upload: UploadFile) -> str:
    candidate = Path(upload.filename or "").suffix.lower()
    return candidate if candidate in {".webm", ".ogg", ".wav", ".mp3", ".m4a"} else ".webm"


def create_app() -> FastAPI:
    app = FastAPI(title="ADEMI MIND Local Voice", docs_url=None, redoc_url=None)

    @app.get("/health")
    async def health() -> dict[str, object]:
        return {
            "status": "ok",
            "sttModel": "small",
            "sttLoaded": _whisper_model is not None,
            "decoderAvailable": decoder_available(),
        }

    @app.post("/v1/audio/speech")
    async def synthesize(request: SpeechRequest) -> Response:
        try:
            text, voice_id = validate_speech_request(request.text, request.voice)
        except ValueError as error:
            raise HTTPException(status_code=422, detail="Invalid speech request") from error

        try:
            audio = await asyncio.wait_for(
                collect_edge_audio(text, voice_id),
                timeout=TTS_TIMEOUT_SECONDS,
            )
        except (asyncio.TimeoutError, Exception) as error:
            raise HTTPException(status_code=502, detail="Voice provider unavailable") from error

        return Response(
            content=audio,
            media_type="audio/mpeg",
            headers={"Cache-Control": "no-store"},
        )

    @app.post("/v1/audio/transcribe")
    async def transcribe(
        audio: UploadFile = File(...),
        language: str = Form("RU"),
    ) -> dict[str, str]:
        if audio.content_type and not audio.content_type.startswith("audio/"):
            raise HTTPException(status_code=422, detail="Invalid audio upload")

        payload = await audio.read(MAX_AUDIO_BYTES + 1)
        if not payload:
            raise HTTPException(status_code=422, detail="Invalid audio upload")
        if len(payload) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="Audio upload is too large")

        selected_language = normalize_language(language)
        audio_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                prefix="ademi-audio-",
                suffix=upload_suffix(audio),
                delete=False,
            ) as temporary_audio:
                temporary_audio.write(payload)
                audio_path = Path(temporary_audio.name)

            if audio_duration_seconds(audio_path) > MAX_AUDIO_SECONDS:
                raise HTTPException(status_code=422, detail="Audio recording is too long")

            model = get_whisper_model()
            segments, _ = model.transcribe(
                str(audio_path),
                language=WHISPER_LANGUAGE_CODES[selected_language],
                beam_size=5,
                vad_filter=True,
            )
            transcript = "".join(segment.text for segment in segments).strip()
            return {"text": transcript, "language": selected_language}
        except HTTPException:
            raise
        except TranscriptionModelUnavailable as error:
            raise HTTPException(status_code=503, detail="Transcription model unavailable") from error
        except AudioDecodeUnavailable as error:
            raise HTTPException(status_code=502, detail="Audio processing unavailable") from error
        except Exception as error:
            raise HTTPException(status_code=502, detail="Audio processing unavailable") from error
        finally:
            if audio_path is not None:
                audio_path.unlink(missing_ok=True)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8091)
