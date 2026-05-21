import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from faster_whisper import WhisperModel


MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
DEFAULT_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "es")
MAX_BYTES = int(os.getenv("VOICE_AUDIO_MAX_BYTES", str(25 * 1024 * 1024)))

app = FastAPI(title="Agents Voice Transcriber", version="0.1.0")
model: Optional[WhisperModel] = None


def get_model() -> WhisperModel:
    global model
    if model is None:
        model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)
    return model


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": MODEL_NAME,
        "device": DEVICE,
        "computeType": COMPUTE_TYPE,
        "language": DEFAULT_LANGUAGE,
    }


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...), language: str = Form(default="")):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Archivo vacio.")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"Audio demasiado grande: {len(data)} bytes.")
    first_bytes = data[:256].lstrip().lower()
    if first_bytes.startswith(b"<!doctype html") or first_bytes.startswith(b"<html"):
        raise HTTPException(status_code=422, detail="El archivo recibido parece HTML, no audio.")

    suffix = Path(file.filename or "audio.m4a").suffix or ".audio"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        lang = (language or DEFAULT_LANGUAGE or "").strip()
        try:
            segments, info = get_model().transcribe(
                tmp_path,
                language=None if lang.lower() in {"", "auto"} else lang,
                vad_filter=True,
            )
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"No se pudo decodificar el audio: {type(exc).__name__}") from exc
        text = " ".join(segment.text.strip() for segment in segments if segment.text and segment.text.strip()).strip()
        return {
            "ok": True,
            "text": text,
            "engine": "voice_transcriber/faster-whisper",
            "model": MODEL_NAME,
            "language": info.language,
            "duration": info.duration,
        }
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

