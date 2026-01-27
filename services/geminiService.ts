import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MOCK_RESPONSES = [
  "Branch stabilized. Logic flow is optimal.",
  "Timeline analysis complete. Significant data fork detected.",
  "Exploring the recursive implications of this thread...",
  "Synthesizing response from localized data buffers.",
  "Interesting pivot. The topological entropy is increasing.",
  "Protocol adjusted. Ready for further branching."
];

const MOCK_TITLES = [
  "Logic Analysis",
  "Data Protocol",
  "Timeline Fork",
  "Neural Segment",
  "System Inquiry",
  "Branch Path"
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * CHAT COMPLETION with Fallback
 */
export const generateResponse = async (
  prompt: string, 
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  isMock: boolean = false
) => {
  if (isMock) {
    await sleep(1000 + Math.random() * 500);
    return MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        temperature: 0.8,
        topP: 0.95,
        topK: 40,
      }
    });
    return response.text || "No response generated.";
  } catch (error: any) {
    console.warn("API Error (likely quota). Switching to simulated response.");
    return `[SIMULATED] ${MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]}`;
  }
};

/**
 * SEMANTIC TITLE GENERATION
 * Improved to prevent "Ugly prompt echoing"
 */
export const generateTitle = async (prompt: string, response: string, isMock: boolean = false) => {
  if (isMock) return MOCK_TITLES[Math.floor(Math.random() * MOCK_TITLES.length)];
  
  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { 
          role: 'user', 
          parts: [{ 
            text: `Generate a short, descriptive title (2-6 words) for this conversation. Do not use quotes or special characters.

User: "${prompt}"
AI: "${response.substring(0, 150)}..."

Title:` 
          }] 
        }
      ],
      config: { temperature: 0.7 }
    });

    let title = result.text?.replace(/["'#*\n]/g, '').trim() || "";
    
    // Basic validation: reject if empty, too long, or is just the prompt repeated
    if (!title || 
        title.length > 60 || 
        title.length < 3 ||
        title.toLowerCase() === prompt.toLowerCase().substring(0, title.length)) {
      return MOCK_TITLES[Math.floor(Math.random() * MOCK_TITLES.length)];
    }
    
    return title;
  } catch (err) {
    return MOCK_TITLES[Math.floor(Math.random() * MOCK_TITLES.length)];
  }
};
