
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

/**
 * 根據文字描述生成無縫紋理模式。
 * 使用 Gemini 2.5 Flash Image 模型。
 */
export const generateAiTexture = async (prompt: string): Promise<string> => {
  // 每次調用時初始化新的實例以確保使用最新配置
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // 優化提示詞，確保生成的圖像是平面、無縫且適合 3D 貼圖的
  const refinedPrompt = `IMAGE_GENERATION: A high-quality, perfectly seamless, flat 2D texture pattern of: ${prompt}. Top-down view, centered, filling the entire square frame. No shadows, no perspective, minimal lighting gradients. Suitable for professional 3D material mapping.`;

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

    // 遍歷所有 candidate 和 part 以尋找 inlineData (圖像數據)
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            const base64Data = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            return `data:${mimeType};base64,${base64Data}`;
          }
        }
      }
    }
    
    // 如果沒有找到圖像，檢查是否有文字反饋，可能有安全過濾或生成限制
    // 使用 response.text 屬性獲取文本
    let reason = "模型未返回圖像數據。";
    if (response.text) {
        reason += " 模型反饋: " + response.text;
    }
    
    throw new Error(reason);

  } catch (error: any) {
    console.error("Gemini 紋理生成錯誤:", error);
    throw new Error(error.message || "生成紋理失敗，請稍後再試。");
  }
};
