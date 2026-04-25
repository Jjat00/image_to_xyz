/**
 * Servicio para generar mapas de profundidad usando Gradio Client
 * Conecta a Hugging Face Spaces - Depth Anything V2
 */

import { Client } from "@gradio/client";

const HF_TOKEN_STORAGE_KEY = "huggingface_token";

export const setHuggingFaceToken = (token: string): void => {
  localStorage.setItem(HF_TOKEN_STORAGE_KEY, token);
};

export const getHuggingFaceToken = (): string | null => {
  return localStorage.getItem(HF_TOKEN_STORAGE_KEY);
};

export const clearHuggingFaceToken = (): void => {
  localStorage.removeItem(HF_TOKEN_STORAGE_KEY);
};

export const hasHuggingFaceToken = (): boolean => {
  return !!getHuggingFaceToken();
};

/**
 * Convierte base64 a Blob
 */
const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

/**
 * Genera un mapa de profundidad usando Hugging Face Spaces (Gradio)
 * @param base64Image La imagen en base64 (sin prefijo data:)
 * @param mimeType El tipo MIME de la imagen
 * @returns El mapa de profundidad como base64 string (sin prefijo data:)
 */
export const generateDepthMapWithGradio = async (
  base64Image: string,
  mimeType: string
): Promise<string> => {
  try {
    console.log("Gradio Service: Conectando a Hugging Face Space...");

    // Obtener token de HuggingFace si está disponible
    const hfToken = getHuggingFaceToken();

    // Conectar al Space de Depth Anything V2
    // Nota: El token se pasa en las opciones si está disponible
    const connectionOptions: any = {};
    if (hfToken) {
      connectionOptions.hf_token = hfToken;
    }

    const client = await Client.connect(
      "depth-anything/Depth-Anything-V2",
      connectionOptions
    );

    console.log("Gradio Service: Conectado. Procesando imagen...");

    // Convertir base64 a Blob
    const imageBlob = base64ToBlob(base64Image, mimeType);

    // Ejecutar la predicción
    const result = await client.predict("/on_submit", {
      image: imageBlob,
    });

    console.log("Gradio Service: Resultado recibido:", result.data);

    // El resultado tiene 3 elementos:
    // [0]: ImageSlider component
    // [1]: Grayscale depth map (File) - ESTO ES LO QUE NECESITAMOS
    // [2]: 16-bit raw output
    const data = result.data as any[];

    if (!data || data.length < 2) {
      throw new Error("No se recibió resultado del modelo");
    }

    // Obtener el mapa de profundidad en escala de grises (elemento [1])
    const grayscaleDepthMap = data[1];

    let depthImageUrl: string;

    if (typeof grayscaleDepthMap === "string") {
      depthImageUrl = grayscaleDepthMap;
    } else if (grayscaleDepthMap?.url) {
      depthImageUrl = grayscaleDepthMap.url;
    } else if (grayscaleDepthMap?.path) {
      // Si es un path relativo, construir la URL completa
      depthImageUrl = `https://depth-anything-depth-anything-v2.hf.space/file=${grayscaleDepthMap.path}`;
    } else {
      console.error("Gradio Service: Formato de respuesta inesperado:", data);
      throw new Error("Formato de respuesta inesperado del modelo");
    }

    console.log("Gradio Service: URL de imagen de profundidad:", depthImageUrl);

    // Descargar la imagen de profundidad y convertirla a base64
    const depthResponse = await fetch(depthImageUrl);
    if (!depthResponse.ok) {
      throw new Error("Error al descargar la imagen de profundidad");
    }

    const depthBlob = await depthResponse.blob();
    const base64Result = await blobToBase64(depthBlob);

    console.log("Gradio Service: Imagen procesada exitosamente");

    return base64Result;
  } catch (error: any) {
    console.error("Error en Gradio Depth Service:", error);

    // Mejorar mensaje de error para cuota agotada
    if (
      error.message?.includes("ZeroGPU") ||
      error.message?.includes("quota")
    ) {
      throw new Error(
        "Cuota de Hugging Face agotada. Agrega tu token de HF (gratis) para obtener más cuota, o usa la opción Local."
      );
    }

    throw error;
  }
};

/**
 * Convierte un Blob a base64
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Remover el prefijo data:image/...;base64,
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = () =>
      reject(new Error("Error al convertir blob a base64"));
    reader.readAsDataURL(blob);
  });
};
