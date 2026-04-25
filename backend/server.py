"""
Servidor FastAPI para Depth-Anything-V2
Expone el modelo de estimación de profundidad como API REST
"""

import base64
import io
from contextlib import asynccontextmanager

import cv2
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

from depth_anything_v2.dpt import DepthAnythingV2

# Configuración del dispositivo
DEVICE = 'cuda' if torch.cuda.is_available(
) else 'mps' if torch.backends.mps.is_available() else 'cpu'

# Configuraciones de los modelos disponibles
MODEL_CONFIGS = {
    'vits': {'encoder': 'vits', 'features': 64, 'out_channels': [48, 96, 192, 384]},
    'vitb': {'encoder': 'vitb', 'features': 128, 'out_channels': [96, 192, 384, 768]},
    'vitl': {'encoder': 'vitl', 'features': 256, 'out_channels': [256, 512, 1024, 1024]},
}

# Modelo global (singleton)
model = None
current_encoder = None


def load_model(encoder: str = 'vitl'):
    """Carga el modelo de profundidad"""
    global model, current_encoder

    if model is not None and current_encoder == encoder:
        return model

    print(f"Cargando modelo Depth-Anything-V2 con encoder {encoder}...")

    if encoder not in MODEL_CONFIGS:
        raise ValueError(
            f"Encoder '{encoder}' no disponible. Opciones: {list(MODEL_CONFIGS.keys())}")

    model = DepthAnythingV2(**MODEL_CONFIGS[encoder])
    model.load_state_dict(torch.load(
        f'checkpoints/depth_anything_v2_{encoder}.pth',
        map_location='cpu'
    ))
    model = model.to(DEVICE).eval()
    current_encoder = encoder

    print(f"Modelo cargado exitosamente en {DEVICE}")
    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Carga el modelo al iniciar el servidor"""
    load_model('vitl')
    yield


# Crear aplicación FastAPI
app = FastAPI(
    title="Depth-Anything-V2 API",
    description="API para generar mapas de profundidad a partir de imágenes",
    version="1.0.0",
    lifespan=lifespan
)

# Configurar CORS para permitir conexiones desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    """Esquema de solicitud para predicción"""
    image: str  # Imagen en base64
    encoder: str = 'vitl'  # Encoder a usar (vits, vitb, vitl)


class PredictResponse(BaseModel):
    """Esquema de respuesta de predicción"""
    depth_image: str  # Mapa de profundidad en base64 (PNG)
    width: int
    height: int


@app.get("/")
async def root():
    """Endpoint de salud"""
    return {
        "status": "ok",
        "model": "Depth-Anything-V2",
        "device": DEVICE,
        "encoder": current_encoder
    }


@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """
    Genera un mapa de profundidad a partir de una imagen.

    - **image**: Imagen codificada en base64 (sin prefijo data:)
    - **encoder**: Encoder a usar (vits, vitb, vitl). Default: vitl
    """
    global model

    try:
        # Cargar modelo si es necesario
        if request.encoder != current_encoder:
            load_model(request.encoder)

        # Decodificar imagen base64
        image_data = base64.b64decode(request.image)

        # Convertir a numpy array usando PIL
        pil_image = Image.open(io.BytesIO(image_data))

        # Convertir a RGB si es necesario
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')

        # Convertir a numpy array en formato BGR (como espera cv2)
        rgb_array = np.array(pil_image)
        bgr_array = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)

        # Ejecutar inferencia
        depth = model.infer_image(bgr_array)

        # Normalizar a rango 0-255
        depth_normalized = (depth - depth.min()) / \
            (depth.max() - depth.min()) * 255.0
        depth_uint8 = depth_normalized.astype(np.uint8)

        # Convertir a imagen PNG en base64
        depth_pil = Image.fromarray(depth_uint8, mode='L')
        buffer = io.BytesIO()
        depth_pil.save(buffer, format='PNG')
        depth_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        return PredictResponse(
            depth_image=depth_base64,
            width=depth_uint8.shape[1],
            height=depth_uint8.shape[0]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
