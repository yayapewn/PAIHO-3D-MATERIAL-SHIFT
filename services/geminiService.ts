
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

/**
 * Generates a seamless texture pattern based on a text prompt.
 * Uses the Gemini 2.5 Flash Image model for texture generation.
 */
export const generateAiTexture = async (prompt: string): Promise<string> => {
  // Always use a new instance right before generating content as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Refine the prompt to ensure better texture results for 3D mapping
  const refinedPrompt = `Create a high-quality, seamless, flat texture pattern of: ${prompt}. Top-down view, even lighting, no perspective, fills the entire frame. Suitable for 3D mapping.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: refinedPrompt,
          },
        ],
      },
    });

    // Iterate through candidates and parts to find the generated image payload
    if (response.candidates && response.candidates[0]?.content?.parts) {
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
    throw new Error(error.message || "Failed to generate texture. Please try again later.");
  }
};
