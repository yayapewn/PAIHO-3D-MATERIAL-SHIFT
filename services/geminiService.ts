import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Generates a seamless texture pattern based on a text prompt.
 */
export const generateAiTexture = async (prompt: string): Promise<string> => {
  const ai = getClient();
  
  // Refine the prompt to ensure better texture results
  const refinedPrompt = `Create a high-quality, seamless, flat texture pattern of: ${prompt}. Top-down view, even lighting, no perspective, fills the entire frame. Suitable for 3D mapping.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: refinedPrompt,
          },
        ],
      },
    });

    // Iterate to find the image part
    if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64Data = part.inlineData.data;
                const mimeType = part.inlineData.mimeType || 'image/png';
                return `data:${mimeType};base64,${base64Data}`;
            }
        }
    }
    
    throw new Error("No image data returned from Gemini.");

  } catch (error: any) {
    console.error("Gemini Texture Generation Error:", error);
    throw new Error(error.message || "Failed to generate texture.");
  }
};
