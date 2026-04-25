/**
 * Servicio para generar mapas de profundidad usando el servidor local
 * Conecta a Depth-Anything-V2 API (FastAPI)
 */

const API_URL_STORAGE_KEY = "depth_server_url";

// Production: set VITE_DEPTH_API_URL in Vercel to the Railway URL.
// Dev: falls back to "/depth-api" which Vite proxies to localhost:8000.
const ENV_API_URL = import.meta.env.VITE_DEPTH_API_URL as string | undefined;
const DEFAULT_API_URL = ENV_API_URL || "/depth-api";

export const setServerUrl = (url: string): void => {
  localStorage.setItem(API_URL_STORAGE_KEY, url);
};

export const getServerUrl = (): string => {
  return localStorage.getItem(API_URL_STORAGE_KEY) || DEFAULT_API_URL;
};

export const resetServerUrl = (): void => {
  localStorage.removeItem(API_URL_STORAGE_KEY);
};

interface PredictResponse {
  depth_image: string;
  width: number;
  height: number;
}

/**
 * Verifica si el servidor está disponible
 */
export const checkServerHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${getServerUrl()}/`);
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Genera un mapa de profundidad usando el servidor local Depth-Anything-V2
 * @param base64Image La imagen en base64 (sin prefijo data:)
 * @param mimeType El tipo MIME de la imagen (no usado, pero mantenemos la firma)
 * @param encoder El encoder a usar (vits, vitb, vitl). Default: vitl
 * @returns El mapa de profundidad como base64 string (sin prefijo data:)
 */
export const generateDepthMapWithLocalServer = async (
  base64Image: string,
  _mimeType: string,
  encoder: string = "vitl"
): Promise<string> => {
  try {
    console.log("Local Server: Conectando al servidor...");

    const serverUrl = getServerUrl();

    const response = await fetch(`${serverUrl}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: base64Image,
        encoder: encoder,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Error del servidor: ${response.status}`
      );
    }

    const data: PredictResponse = await response.json();

    console.log(
      `Local Server: Imagen procesada (${data.width}x${data.height})`
    );

    return data.depth_image;
  } catch (error: any) {
    console.error("Error en Local Server Depth Service:", error);

    // Mejorar mensaje de error para conexión fallida
    if (
      error.message?.includes("Failed to fetch") ||
      error.message?.includes("NetworkError")
    ) {
      throw new Error(
        `No se puede conectar al servidor en ${getServerUrl()}. Asegúrate de que el servidor esté corriendo (python server.py)`
      );
    }

    throw error;
  }
};
