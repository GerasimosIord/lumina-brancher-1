import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const generateResponseOpenAI = async (
  prompt: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  files: File[] = [],
  modelId: string = "gpt-4o"
) => {
  try {
    // Build messages array
    const messages = [
      ...history,
      { role: 'user' as const, content: prompt }
    ];

    // Create streaming response
    const stream = await client.chat.completions.create({
      model: modelId,
      messages: messages,
      stream: true,
      temperature: 0.8
    });

    return stream;
  } catch (error: any) {
    console.error("❌ OpenAI API Error:", error);
    throw error;
  }
};