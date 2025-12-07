import { GoogleGenAI } from "@google/genai";
import { ThemeSchema, VisualTheme, InteractionMode } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelId = "gemini-2.5-flash"; 

export const generateThemeFromGesture = async (
  handCount: number,
  movementIntensity: number, 
  spread: number 
): Promise<VisualTheme | null> => {
  
  const prompt = `
    Act as a Generative Art Director for a high-end sci-fi installation.
    Input Data:
    - Hands: ${handCount}
    - Kinetic Energy: ${movementIntensity.toFixed(2)} (0=Still, 1=Violent)
    - Structural Openness: ${spread.toFixed(2)} (0=Closed, 1=Open)

    Map this to a visual theme that feels like "Deep Space", "Dark Matter", and "Sacred Geometry".
    
    Guidelines:
    - Palette: RESTRICTED to Metallic Golds (Tungsten), Deep Blues (Quantum), and Void Blacks. No neon rainbows.
    - Low Energy: 'CRYSTALLIZE' or 'VOID'. Deep, slow, solid structures.
    - High Energy: 'FRAGMENT' or 'RESONANCE'. Breaking geometry, high entropy.
    - Open Hands: 'WEAVE'. Connecting threads.
    
    Output strictly JSON matching the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: ThemeSchema,
      }
    });

    const text = response.text;
    if (!text) return null;

    const data = JSON.parse(text) as VisualTheme;
    return data;

  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};