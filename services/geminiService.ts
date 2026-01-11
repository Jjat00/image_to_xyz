import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a depth map from an RGB image using Gemini.
 * @param base64Image The source RGB image in base64 format (without data: prefix).
 * @param mimeType The mime type of the image (e.g., image/jpeg).
 * @returns The generated depth map as a base64 string.
 */
export const generateDepthMap = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash-image';
    
    // We construct a prompt that asks Gemini to act as a depth estimation model.
    // While specific depth estimation models exist, Gemini's multimodal capabilities 
    // allow it to "hallucinate" or estimate depth based on visual cues.
    const prompt = `
      Generate a high-contrast grayscale depth map for this image. 
      Rules:
      1. White pixels (255) represent objects closest to the camera.
      2. Black pixels (0) represent objects furthest away (background).
      3. Use the full grayscale range to show gradients of depth.
      4. Maintain the EXACT aspect ratio and composition of the original image.
      5. Output ONLY the image, no text.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            text: prompt
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          }
        ]
      }
    });

    // Check for image parts in the response
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
        const parts = candidates[0].content.parts;
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                return part.inlineData.data;
            }
        }
    }

    throw new Error("No image data found in Gemini response. The model might have refused the request.");

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
