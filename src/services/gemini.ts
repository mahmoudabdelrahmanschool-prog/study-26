import { GoogleGenAI, Modality } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export const MODELS = {
  text: "gemini-3.1-pro-preview",
  flash: "gemini-3-flash-preview",
  tts: "gemini-2.5-flash-preview-tts",
  audio: "gemini-2.5-flash-native-audio-preview-12-2025"
};

export async function generateText(prompt: string, history: any[] = []) {
  const chat = ai.chats.create({
    model: MODELS.text,
    config: {
      systemInstruction: "You are study 26, a helpful educational assistant. Help students with their studies, explain complex topics simply, and encourage critical thinking.",
    },
    history: history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }))
  });
  
  const response = await chat.sendMessage({ message: prompt });
  return response.text;
}

export async function generateTTS(text: string): Promise<string | undefined> {
  try {
    const response = await ai.models.generateContent({
      model: MODELS.tts,
      contents: [{ parts: [{ text: `Read this clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS Error:", error);
    return undefined;
  }
}

export async function generateCourse(topic: string, level: string = 'Beginner') {
  const prompt = `Create a comprehensive structured course for the topic: "${topic}" at a "${level}" difficulty level. 
  Return the response as a JSON object with the following structure:
  {
    "title": string,
    "description": string,
    "objectives": string[],
    "lessons": [
      {
        "id": number,
        "title": string,
        "content": string,
        "summary": string
      }
    ]
  }
  Provide 5 detailed lessons. Only return the JSON.`;
  
  const response = await ai.models.generateContent({
    model: MODELS.text,
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });
  return JSON.parse(response.text);
}

export async function generateQuiz(topic: string) {
  const prompt = `Generate a 5-question multiple choice quiz about "${topic}". 
  Return the response as a JSON array of objects with:
  "question": string,
  "options": string[],
  "correctAnswer": number (index of options)
  Only return the JSON.`;
  
  const response = await ai.models.generateContent({
    model: MODELS.flash,
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });
  return JSON.parse(response.text);
}

export async function generateExam(topic: string) {
  const prompt = `Generate a 40-question multiple choice exam about "${topic}". 
  Return the response as a JSON array of objects with:
  "question": string,
  "options": string[],
  "correctAnswer": number (index of options)
  Only return the JSON.`;
  
  const response = await ai.models.generateContent({
    model: MODELS.flash,
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });
  return JSON.parse(response.text);
}

export async function generateDocSlides(topic: string) {
  const prompt = `Create a 5-section educational document about "${topic}". 
  Each section should be a "slide" with a title and content.
  Return as a JSON array of objects: { "title": string, "content": string }.
  Only return JSON.`;
  
  const response = await ai.models.generateContent({
    model: MODELS.flash,
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });
  return JSON.parse(response.text);
}

export async function generatePPTSlides(topic: string) {
  const prompt = `Create content for a 5-slide PowerPoint presentation about "${topic}". 
  Each slide should have a title and 3-4 bullet points.
  Return as a JSON array of objects: { "title": string, "bullets": string[] }.
  Only return JSON.`;
  
  const response = await ai.models.generateContent({
    model: MODELS.flash,
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });
  return JSON.parse(response.text);
}
