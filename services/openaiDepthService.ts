/**
 * Servicio para generar mapas de profundidad usando OpenAI GPT Image 1.5
 * Usa el endpoint de edición de imágenes para transformar la imagen original
 */

const OPENAI_API_KEY_STORAGE_KEY = "openai_depth_api_key";

export const setOpenAIApiKey = (key: string): void => {
  localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, key);
};

export const getOpenAIApiKey = (): string | null => {
  return localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
};

export const clearOpenAIApiKey = (): void => {
  localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
};

export const hasOpenAIApiKey = (): boolean => {
  return !!getOpenAIApiKey();
};

const DEPTH_MAP_PROMPT = `Create a depth map from this image. Convert the RGB image to a grayscale depth map where:
- White (255) represents the closest objects to the camera
- Black (0) represents the farthest objects
- Gray values represent intermediate distances
Maintain accurate spatial relationships and preserve all important depth cues from the original scene. The depth estimation should be physically realistic based on perspective, occlusion, and relative object sizes.`;

/**
 * Convierte base64 a Blob para enviar como FormData
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
 * Genera un mapa de profundidad usando OpenAI GPT Image 1.5
 * @param base64Image La imagen en base64 (sin prefijo data:)
 * @param mimeType El tipo MIME de la imagen
 * @returns El mapa de profundidad como base64 string (sin prefijo data:)
 */
export const generateDepthMapWithOpenAI = async (
  base64Image: string,
  mimeType: string
): Promise<string> => {
  const apiKey = getOpenAIApiKey();

  if (!apiKey) {
    throw new Error(
      "OpenAI API Key no configurada. Por favor, ingresa tu API Key en la configuración."
    );
  }

  // Verificar formato de API key
  if (!apiKey.startsWith("sk-")) {
    throw new Error(
      "API Key inválida. Debe comenzar con 'sk-'. Verifica tu API Key."
    );
  }

  console.log("OpenAI Service: Iniciando generación de depth map...");
  console.log("OpenAI Service: API Key length:", apiKey.length);

  try {
    // Convertir base64 a Blob
    const imageBlob = base64ToBlob(base64Image, mimeType);
    
    // Determinar extensión basada en mimeType
    const extension = mimeType.includes("png")
      ? "png"
      : mimeType.includes("webp")
      ? "webp"
      : "jpg";

    // Crear FormData para el request
    const formData = new FormData();
    formData.append("model", "gpt-image-1.5");
    // Usar 'image' sin corchetes para un solo archivo
    formData.append("image", imageBlob, `input.${extension}`);
    formData.append("prompt", DEPTH_MAP_PROMPT);
    formData.append("size", "1024x1024");
    formData.append("quality", "high");
    formData.append("n", "1");

    console.log("OpenAI Service: Enviando request a /v1/images/edits...");

    // Usar el endpoint de edición de imágenes
    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    console.log("OpenAI Service: Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI Service: Error response:", errorText);
      
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        // Si no es JSON, usar el texto del error
        if (errorText) {
          errorMessage = errorText;
        }
      }
      
      if (response.status === 401) {
        throw new Error(
          "Error de autenticación (401). Verifica que tu API Key sea válida y tenga acceso a gpt-image-1.5."
        );
      }
      
      throw new Error(`Error de OpenAI: ${errorMessage}`);
    }

    const data = await response.json();
    console.log("OpenAI Service: Respuesta recibida exitosamente");
    
    const generatedBase64 = data.data?.[0]?.b64_json;

    if (!generatedBase64) {
      console.error("OpenAI Service: Respuesta sin imagen:", data);
      throw new Error("No se recibió imagen del API de OpenAI");
    }

    // Convertir a escala de grises pura para asegurar consistencia
    const grayscaleBase64 = await convertToGrayscale(generatedBase64);

    return grayscaleBase64;
  } catch (error) {
    console.error("Error en OpenAI Depth Service:", error);
    throw error;
  }
};

/**
 * Convierte una imagen base64 a escala de grises
 */
const convertToGrayscale = async (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("No se pudo crear contexto de canvas"));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(
          0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        );
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      ctx.putImageData(imageData, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      resolve(dataUrl.split(",")[1]);
    };

    img.onerror = () =>
      reject(new Error("Error al cargar imagen para conversión"));
    img.src = `data:image/png;base64,${base64Image}`;
  });
};
