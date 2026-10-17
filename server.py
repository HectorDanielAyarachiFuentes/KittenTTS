import os
import time
import uuid
import json
import threading
import soundfile as sf
import numpy as np
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import torch

# Optimizar rendimiento de CPU con todos los núcleos disponibles
if hasattr(torch, "set_num_threads"):
    cpu_cores = os.cpu_count() or 8
    torch.set_num_threads(cpu_cores)
    print(f"[KittenTTS] PyTorch configurado para usar {cpu_cores} hilos de CPU.")

from kittenml import KittenTTS

# Carpetas del proyecto
BASE_DIR = Path(__file__).resolve().parent
AUDIO_DIR = BASE_DIR / "generated_audio"
AUDIO_DIR.mkdir(exist_ok=True)
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
WEB_DIR = BASE_DIR / "web"
WEB_DIR.mkdir(exist_ok=True)

app = FastAPI(title="KittenTTS Studio API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Bloqueo para evitar colisiones de inferencia en CPU/RAM
model_lock = threading.Lock()
loaded_models = {}

ONNX_MODEL_ID = "KittenML/kitten-tts-mini-0.8"
KITTEN2_MODEL_ID = "KittenML/kitten-tts-2"

ONNX_VOICES = [
    {"id": "Bruno", "name": "Bruno (Masculino - Español / Multilingüe)"},
    {"id": "Bella", "name": "Bella (Femenino - Español / Multilingüe)"},
    {"id": "Jasper", "name": "Jasper (Masculino - Español / Multilingüe)"},
    {"id": "Luna", "name": "Luna (Femenino - Español / Multilingüe)"},
    {"id": "Hugo", "name": "Hugo (Masculino - Español / Multilingüe)"},
    {"id": "Rosie", "name": "Rosie (Femenino - Español / Multilingüe)"},
    {"id": "Leo", "name": "Leo (Masculino - Español / Multilingüe)"},
    {"id": "Kiki", "name": "Kiki (Femenino - Español / Multilingüe)"},
]

KITTEN2_VOICES = {
    "Español y Multilingüe": ["Spanish", "English (Bruno)", "German", "French", "Italian", "Portuguese", "Russian", "Chinese", "Hindi", "Arabic"],
    "Voces Femeninas": ["Bella", "Luna", "Rosie", "Kiki", "Willow", "Dolores", "Saoirse", "Claire", "Raven", "Diana", "Maeve", "Edith", "Grace", "Iris", "Serena", "Eleanor", "Martha", "Sable", "Victoria"],
    "Voces Masculinas": ["Bruno", "Jasper", "Hugo", "Leo", "Matthew", "Elliot", "Victor", "Dante", "Alfred", "Marcus", "Herbert", "Laurence", "Walter", "Miles", "Reginald", "Frank", "Julian", "Otis", "Vincent"]
}

EMOTIONS = [
    {"tag": "[joyful]", "label": "Alegre", "icon": "😊"},
    {"tag": "[excited]", "label": "Emocionado", "icon": "🤩"},
    {"tag": "[tender]", "label": "Cariñoso", "icon": "🥰"},
    {"tag": "[contemplative]", "label": "Pensativo", "icon": "🤔"},
    {"tag": "[surprised]", "label": "Sorprendido", "icon": "😲"},
    {"tag": "[nervous]", "label": "Nervioso", "icon": "😰"},
    {"tag": "[sad]", "label": "Triste", "icon": "😢"},
    {"tag": "[angry]", "label": "Enojado", "icon": "😠"},
    {"tag": "[stern]", "label": "Severo", "icon": "🤨"},
    {"tag": "[mundane]", "label": "Neutro", "icon": "😐"},
]

VOCAL_EVENTS = [
    {"tag": "<laugh>", "label": "Risa", "icon": "😂"},
    {"tag": "<gasp>", "label": "Jadear", "icon": "😮"},
    {"tag": "<sigh>", "label": "Suspiro", "icon": "😮‍💨"},
    {"tag": "<giggle>", "label": "Risita", "icon": "🤭"},
    {"tag": "<pause>", "label": "Pausa", "icon": "⏸️"},
    {"tag": "<um>", "label": "Duda (um)", "icon": "🤐"},
    {"tag": "<growl>", "label": "Gruñido", "icon": "😤"},
    {"tag": "<gulp>", "label": "Tragar saliva", "icon": "😨"},
    {"tag": "<sob>", "label": "Sollozo", "icon": "😭"},
    {"tag": "<scoff>", "label": "Burlar", "icon": "😏"},
]

def get_onnx_model():
    if "onnx" not in loaded_models:
        print("[KittenTTS] Cargando modelo ligero ONNX...")
        loaded_models["onnx"] = KittenTTS(ONNX_MODEL_ID)
    return loaded_models["onnx"]

def get_kitten2_model():
    if "kitten2" not in loaded_models:
        print("[KittenTTS] Cargando modelo KittenTTS 2 (emb4 + student_w4)...")
        loaded_models["kitten2"] = KittenTTS(
            KITTEN2_MODEL_ID,
            weights="emb4",
            decoder="student_w4",
            device="cpu"
        )
    return loaded_models["kitten2"]


@app.get("/api/info")
def get_info():
    return {
        "status": "ready",
        "onnx_voices": ONNX_VOICES,
        "kitten2_voices": KITTEN2_VOICES,
        "emotions": EMOTIONS,
        "vocal_events": VOCAL_EVENTS,
        "loaded_models": list(loaded_models.keys())
    }


@app.post("/api/generate")
def generate_speech(
    text: str = Form(...),
    model_type: str = Form("onnx"),
    voice: str = Form("Bruno"),
    language: str = Form("es"),
    preset: str = Form("stable"),
    speed: float = Form(1.0)
):
    if not text.strip():
        raise HTTPException(status_code=400, detail="El texto no puede estar vacío.")

    text = text.strip()
    voice_to_use = "Bruno" if voice == "English (Bruno)" else voice

    t0 = time.time()
    try:
        with model_lock:
            if model_type.lower() == "onnx":
                model = get_onnx_model()
                import phonemizer
                
                # Configurar pronunciación en español nativo
                if language.lower() in ("es", "spanish", "español"):
                    if not hasattr(model.model, "_phonemizer_es"):
                        model.model._phonemizer_es = phonemizer.backend.EspeakBackend(
                            language="es", preserve_punctuation=True, with_stress=True
                        )
                    model.model.phonemizer = model.model._phonemizer_es
                    clean_text = False
                else:
                    if not hasattr(model.model, "_phonemizer_en"):
                        model.model._phonemizer_en = phonemizer.backend.EspeakBackend(
                            language="en-us", preserve_punctuation=True, with_stress=True
                        )
                    model.model.phonemizer = model.model._phonemizer_en
                    clean_text = True

                speed_val = max(0.5, min(2.0, float(speed)))
                audio = model.model.generate(text, voice=voice_to_use, speed=speed_val, clean_text=clean_text)
                sample_rate = 24000
            else:
                model = get_kitten2_model()
                is_non_en = voice_to_use in ["Spanish", "German", "French", "Italian", "Portuguese", "Russian", "Chinese", "Hindi", "Arabic"] or language.lower() in ("es", "spanish")
                # Calcular presupuesto óptimo de tokens para que no se quede decodificando de más en CPU
                budget = max(100, min(500, int(len(text) * 2.8)))
                audio = model.generate(
                    text,
                    voice=voice_to_use,
                    preset=preset,
                    max_new_tokens=budget,
                    normalize=not is_non_en
                )
                sample_rate = model.sample_rate

        filename = f"tts_{uuid.uuid4().hex[:10]}.wav"
        out_path = AUDIO_DIR / filename
        sf.write(str(out_path), audio, sample_rate)

        duration = len(audio) / sample_rate
        elapsed = time.time() - t0

        return {
            "status": "success",
            "filename": filename,
            "url": f"/audio/{filename}",
            "duration": round(duration, 2),
            "sample_rate": sample_rate,
            "generation_time": round(elapsed, 2),
            "model_type": model_type,
            "voice": voice
        }
    except Exception as e:
        print(f"[Error generate] {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clone")
async def clone_voice(
    text: str = Form(...),
    reference_audio: UploadFile = File(...),
    reference_text: Optional[str] = Form(None)
):
    if not text.strip():
        raise HTTPException(status_code=400, detail="El texto a generar no puede estar vacío.")

    t0 = time.time()
    temp_ref_path = UPLOADS_DIR / f"ref_{uuid.uuid4().hex[:8]}_{reference_audio.filename}"
    try:
        # Guardar audio de referencia
        with open(temp_ref_path, "wb") as f:
            content = await reference_audio.read()
            f.write(content)

        with model_lock:
            model = get_kitten2_model()
            budget = max(100, min(500, int(len(text.strip()) * 2.8)))
            kwargs = {
                "reference": str(temp_ref_path),
                "normalize": False,
                "max_new_tokens": budget
            }
            if reference_text and reference_text.strip():
                kwargs["reference_text"] = reference_text.strip()

            audio = model.generate(text.strip(), **kwargs)
            sample_rate = model.sample_rate

        filename = f"cloned_{uuid.uuid4().hex[:10]}.wav"
        out_path = AUDIO_DIR / filename
        sf.write(str(out_path), audio, sample_rate)

        duration = len(audio) / sample_rate
        elapsed = time.time() - t0

        return {
            "status": "success",
            "filename": filename,
            "url": f"/audio/{filename}",
            "duration": round(duration, 2),
            "sample_rate": sample_rate,
            "generation_time": round(elapsed, 2),
            "model_type": "kitten2_clone"
        }
    except Exception as e:
        print(f"[Error clone] {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_ref_path.exists():
            try:
                temp_ref_path.unlink()
            except Exception:
                pass


@app.get("/audio/{filename}")
def get_audio(filename: str):
    file_path = AUDIO_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Archivo de audio no encontrado.")
    return FileResponse(path=file_path, media_type="audio/wav", filename=filename)


# Montar archivos estáticos del frontend
app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="static")

if __name__ == "__main__":
    print("Iniciando KittenTTS Studio en http://127.0.0.1:7860 ...")
    uvicorn.run("server:app", host="127.0.0.1", port=7860, reload=False)
