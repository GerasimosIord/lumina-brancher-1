import OpenAI from "openai";

const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Helper function to convert File to base64
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

// Helper to determine if file is an image
const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/');
};

// Helper to determine if file is a PDF
const isPdfFile = (file: File): boolean => {
  return file.type === 'application/pdf';
};

export const generateResponseOpenAI = async (
  prompt: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  files: File[] = [],
  modelId: string = "gpt-4o"
) => {
  try {
    // Convert history to proper format
    const messages: any[] = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Build the user message content
    let userContent: any;

    // If there are files, use array format
    if (files.length > 0) {
      const contentParts: any[] = [];

      // Add text prompt first
      if (prompt.trim()) {
        contentParts.push({
          type: "text",
          text: prompt
        });
      }

      // Add files
      for (const file of files) {
        if (isImageFile(file)) {
          // Handle images
          const base64Data = await fileToBase64(file);
          contentParts.push({
            type: "image_url",
            image_url: {
              url: `data:${file.type};base64,${base64Data}`
            }
          });
        } else if (isPdfFile(file)) {
          // For PDFs, we need to read them differently
          // OpenAI's chat API doesn't directly support PDFs in the same way as images
          // You might need to extract text or use the Assistants API instead
          console.warn("PDF support requires different handling - consider using Assistants API or extracting text first");
          
          // Alternatively, you could try sending it as an image if it's been converted
          // or extract the text content first
        } else {
          console.warn(`Unsupported file type: ${file.type} for file: ${file.name}`);
        }
      }

      userContent = contentParts;
    } else {
      // No files, just text
      userContent = prompt;
    }

    // Add the user message
    messages.push({
      role: 'user',
      content: userContent
    });

    // Create streaming response
    const stream = await client.chat.completions.create({
      model: modelId,
      messages: messages,
      stream: true,
    });

    return stream;
  } catch (error: any) {
    console.error("❌ OpenAI API Error:", error);
    throw error;
  }
};