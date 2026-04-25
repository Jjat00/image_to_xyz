"""
Servidor FastAPI para Depth-Anything-V2.
Expone el modelo de estimación de profundidad como API REST.

Variables de entorno soportadas:
- PORT             puerto a escuchar (default 8000). Railway/Render lo inyectan.
- MODEL_ENCODER    vits | vitb | vitl (default vits — más liviano para CPU/cloud)
- CORS_ORIGINS     lista separada por comas. Default "*".
"""

import base64
import io
import os
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path

import cv2
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

from depth_anything_v2.dpt import DepthAnythingV2

DEVICE = (
    'cuda' if torch.cuda.is_available()
    else 'mps' if torch.backends.mps.is_available()
    else 'cpu'
)

MODEL_CONFIGS = {
    'vits': {'encoder': 'vits', 'features': 64,  'out_channels': [48, 96, 192, 384]},
    'vitb': {'encoder': 'vitb', 'features': 128, 'out_channels': [96, 192, 384, 768]},
    'vitl': {'encoder': 'vitl', 'features': 256, 'out_channels': [256, 512, 1024, 1024]},
}

CHECKPOINT_URLS = {
    'vits': "https://huggingface.co/depth-anything/Depth-Anything-V2-Small/resolve/main/depth_anything_v2_vits.pth",
    'vitb': "https://huggingface.co/depth-anything/Depth-Anything-V2-Base/resolve/main/depth_anything_v2_vitb.pth",
    'vitl': "https://huggingface.co/depth-anything/Depth-Anything-V2-Large/resolve/main/depth_anything_v2_vitl.pth",
}

CHECKPOINTS_DIR = Path(__file__).parent / "checkpoints"
DEFAULT_ENCODER = os.getenv("MODEL_ENCODER", "vits")

model = None
current_encoder = None


def ensure_checkpoint(encoder: str) -> Path:
    """Descarga el checkpoint si no existe localmente."""
    if encoder not in CHECKPOINT_URLS:
        raise ValueError(f"Encoder '{encoder}' no soportado")

    path = CHECKPOINTS_DIR / f"depth_anything_v2_{encoder}.pth"
    if path.exists():
        return path

    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    url = CHECKPOINT_URLS[encoder]
    print(f"Checkpoint no encontrado en {path}. Descargando desde {url}…")
    tmp = path.with_suffix(".pth.part")
    urllib.request.urlretrieve(url, tmp)
    tmp.rename(path)
    print(f"Descarga completa: {path} ({path.stat().st_size / 1e6:.1f} MB)")
    return path


def load_model(encoder: str = DEFAULT_ENCODER):
    global model, current_encoder

    if model is not None and current_encoder == encoder:
        return model

    if encoder not in MODEL_CONFIGS:
        raise ValueError(
            f"Encoder '{encoder}' no disponible. Opciones: {list(MODEL_CONFIGS.keys())}"
        )

    checkpoint_path = ensure_checkpoint(encoder)

    print(f"Cargando modelo Depth-Anything-V2 ({encoder}) en {DEVICE}…")
    m = DepthAnythingV2(**MODEL_CONFIGS[encoder])
    m.load_state_dict(torch.load(checkpoint_path, map_location='cpu'))
    m = m.to(DEVICE).eval()

    model = m
    current_encoder = encoder
    print(f"Modelo cargado en {DEVICE}")
    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model(DEFAULT_ENCODER)
    yield


app = FastAPI(
    title="Depth-Anything-V2 API",
    description="API para generar mapas de profundidad a partir de imágenes",
    version="1.0.0",
    lifespan=lifespan,
)

cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    image: str  # base64 sin prefijo data:
    encoder: str = DEFAULT_ENCODER


class PredictResponse(BaseModel):
    depth_image: str
    width: int
    height: int


@app.get("/")
async def root():
    return {
        "status": "ok",
        "model": "Depth-Anything-V2",
        "device": DEVICE,
        "encoder": current_encoder,
        "default_encoder": DEFAULT_ENCODER,
    }


@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    global model
    try:
        if request.encoder != current_encoder:
            load_model(request.encoder)

        image_data = base64.b64decode(request.image)
        pil_image = Image.open(io.BytesIO(image_data))
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')

        rgb_array = np.array(pil_image)
        bgr_array = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)

        depth = model.infer_image(bgr_array)
        depth_normalized = (depth - depth.min()) / (depth.max() - depth.min()) * 255.0
        depth_uint8 = depth_normalized.astype(np.uint8)

        depth_pil = Image.fromarray(depth_uint8, mode='L')
        buffer = io.BytesIO()
        depth_pil.save(buffer, format='PNG')
        depth_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        return PredictResponse(
            depth_image=depth_base64,
            width=depth_uint8.shape[1],
            height=depth_uint8.shape[0],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
