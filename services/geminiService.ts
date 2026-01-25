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
          parts: [{ text: `Task: Create a chat segment title based on the following user prompt and AI response. Describe it as best as you can in 5-6 words 
          Rules: 
          1. Do NOT repeat the user's prompt. 
          2. Do NOT use the word 'Chat' or 'Discussion'. 
          3. Be abstract and elegant.
          
          User: "${prompt}"
          AI: "${response.substring(0, 100)}..."
          Name:` }] 
        }
      ],
      config: { temperature: 0.7 }
    });
    
    let title = result.text?.replace(/["'#*]/g, '').trim() || "";
    // If the model still echoed the prompt or failed, use a mock title instead of prompt substring
    if (title.length > 25 || title.toLowerCase().includes(prompt.toLowerCase().substring(0, 5))) {
      return MOCK_TITLES[Math.floor(Math.random() * MOCK_TITLES.length)];
    }
    return title;
  } catch (err) {
    // Better fallback than just prompt.substring
    return MOCK_TITLES[Math.floor(Math.random() * MOCK_TITLES.length)];
  }
};
