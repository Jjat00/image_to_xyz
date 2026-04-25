import { pipeline, env } from "@xenova/transformers";

// Configurar transformers.js para usar cache del navegador
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton para el pipeline de depth estimation
let depthPipeline: Awaited<ReturnType<typeof pipeline>> | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

// Callback para reportar progreso de descarga del modelo
type ProgressCallback = (progress: { status: string; progress?: number }) => void;
let progressCallback: ProgressCallback | null = null;

export const setProgressCallback = (callback: ProgressCallback | null) => {
  progressCallback = callback;
};

const initPipeline = async (): Promise<void> => {
  if (depthPipeline) return;

  if (isLoading && loadPromise) {
    await loadPromise;
    return;
  }

  isLoading = true;

  loadPromise = (async () => {
    try {
      progressCallback?.({ status: "Descargando modelo Depth Anything V2..." });

      // Usar el modelo small para mejor rendimiento en browser
      depthPipeline = await pipeline(
        "depth-estimation",
        "depth-anything/Depth-Anything-V2-Small",
        {
          progress_callback: (progress: { status: string; progress?: number }) => {
            progressCallback?.(progress);
          },
        }
      );

      progressCallback?.({ status: "Modelo cargado", progress: 100 });
    } catch (error) {
      console.error("Error inicializando pipeline:", error);
      isLoading = false;
      loadPromise = null;
      throw error;
    }
    isLoading = false;
  })();

  await loadPromise;
};

/**
 * Genera un mapa de profundidad usando Depth Anything V2
 * @param base64Image La imagen en base64 (sin prefijo data:)
 * @param mimeType El tipo MIME de la imagen
 * @returns El mapa de profundidad como base64 string (sin prefijo data:)
 */
export const generateDepthMap = async (
  base64Image: string,
  mimeType: string
): Promise<string> => {
  try {
    // Inicializar el pipeline si no está listo
    await initPipeline();

    if (!depthPipeline) {
      throw new Error("No se pudo inicializar el modelo de profundidad");
    }

    // Crear la URL de datos para la imagen
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

    // Ejecutar el modelo - pasamos directamente la URL
    const result = await depthPipeline(imageDataUrl);

    // El resultado contiene un objeto con 'depth' que es un RawImage
    const depthImage = result.depth;

    // Crear un canvas para convertir a base64
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No se pudo crear el contexto de canvas");
    }

    // Obtener dimensiones
    const width = depthImage.width;
    const height = depthImage.height;

    canvas.width = width;
    canvas.height = height;

    // Obtener los datos de profundidad
    const depthData = depthImage.data;
    const imageData = ctx.createImageData(width, height);

    // El modelo devuelve valores donde mayor = más lejos
    // Invertimos para que blanco = cerca (convención común)
    for (let i = 0; i < width * height; i++) {
      const value = 255 - depthData[i]; // Invertir
      const idx = i * 4;
      imageData.data[idx] = value; // R
      imageData.data[idx + 1] = value; // G
      imageData.data[idx + 2] = value; // B
      imageData.data[idx + 3] = 255; // A
    }

    ctx.putImageData(imageData, 0, 0);

    // Convertir a base64
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];

    return base64;
  } catch (error) {
    console.error("Error en Depth Anything V2:", error);
    throw error;
  }
};

// Verificar si el modelo está cargado
export const isModelLoaded = (): boolean => {
  return depthPipeline !== null;
};

// Precargar el modelo (opcional, para mejor UX)
export const preloadModel = async (): Promise<void> => {
  await initPipeline();
};
