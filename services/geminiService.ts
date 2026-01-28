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
 * Convert a File object to base64 string (browser-compatible)
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Get MIME type from File object
 */
const getMimeType = (file: File): string => {
  return file.type || 'application/octet-stream';
};

/**
 * CHAT COMPLETION with File Upload Support
 */
export const generateResponse = async (
  prompt: string, 
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  files: File[] = [],
  isMock: boolean = false
) => {
  if (isMock) {
    await sleep(1000 + Math.random() * 500);
    return MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
  }

  try {
    // Build the user message parts
    const userParts: any[] = [];
    
    // Add text prompt if provided
    if (prompt.trim()) {
      userParts.push({ text: prompt });
    }
    
    // Add files if provided
    if (files.length > 0) {
     // console.log(`📎 Processing ${files.length} files...`);
      for (const file of files) {
       // console.log(`  - Converting ${file.name} (${file.type})...`);
        const base64Data = await fileToBase64(file);
        const mimeType = getMimeType(file);
        
        userParts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      // console.log(`  ✓ ${file.name} converted (${base64Data.length} chars)`);
      }
    }

    // Build the full contents array
    const contents = [
      ...history,
      { role: 'user', parts: userParts }
    ];

  //  console.log('🚀 Sending request to Gemini API...');
   // console.log('📊 Request payload:', {
    //  model: 'gemini-3-flash-preview',
    //  contentsLength: contents.length,
    //  lastMessageParts: userParts.length
  //  });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        temperature: 0.8,
        topP: 0.95,
        topK: 40,
      }
    });
    
  //  console.log('✅ Gemini API responded successfully');

  {/*  if (response.usageMetadata) {
      console.log("Token Usage:", {
        input: response.usageMetadata.promptTokenCount,      // Your text + files
        output: response.usageMetadata.candidatesTokenCount, // The AI's answer
        total: response.usageMetadata.totalTokenCount        // Sum
      });
    }
*/}
    return response.text || "No response generated.";
  } catch (error: any) {
    // 🔍 THIS IS THE KEY CHANGE - LOG THE ACTUAL ERROR
   {/* console.error("❌ Gemini API Error Details:", {
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      response: error.response,
      fullError: error
    });
 */}   
 //   console.warn("Switching to simulated response due to error above.");
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