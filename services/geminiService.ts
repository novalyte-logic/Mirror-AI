
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { BehavioralSignal, BehavioralProfile, SoulFragment, NeuralDrift, SignalWeights } from "../types";

// Helper functions for audio processing
export function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const ADVANCED_PROFILE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    archetype: { type: Type.STRING },
    tagline: { type: Type.STRING },
    coreIdentity: {
      type: Type.OBJECT,
      properties: { headline: { type: Type.STRING }, content: { type: Type.STRING } },
      required: ["headline", "content"]
    },
    shadowSelf: {
      type: Type.OBJECT,
      properties: { contradiction: { type: Type.STRING }, hiddenMotivation: { type: Type.STRING } },
      required: ["contradiction", "hiddenMotivation"]
    },
    environmentDecoding: { type: Type.STRING },
    evolutionpath: { type: Type.STRING },
    aestheticDNA: {
      type: Type.OBJECT,
      properties: { paletteMood: { type: Type.STRING }, visualStyle: { type: Type.STRING }, primaryColor: { type: Type.STRING } },
      required: ["paletteMood", "visualStyle", "primaryColor"]
    },
    linguisticPatterns: {
      type: Type.OBJECT,
      properties: {
        frequentWords: { type: Type.ARRAY, items: { type: Type.STRING } },
        subconsciousIntent: { type: Type.STRING },
        clarification: { type: Type.STRING }
      },
      required: ["frequentWords", "subconsciousIntent", "clarification"]
    },
    traits: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { name: { type: Type.STRING }, score: { type: Type.NUMBER }, description: { type: Type.STRING } },
        required: ["name", "score", "description"]
      }
    },
    socialAnalysis: {
      type: Type.OBJECT,
      properties: {
        sentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'guarded', 'aggressive', 'performative'] },
        communicationStyle: { type: Type.STRING },
        engagementPattern: { type: Type.STRING },
        platformDissonance: { type: Type.STRING }
      },
      required: ["sentiment", "communicationStyle", "engagementPattern", "platformDissonance"]
    }
  },
  required: ["archetype", "tagline", "coreIdentity", "shadowSelf", "environmentDecoding", "evolutionpath", "aestheticDNA", "linguisticPatterns", "traits", "socialAnalysis"]
};

export async function analyzeAdvancedBehavior(
  signals: BehavioralSignal[], 
  accuracy: number, 
  brutality: number = 50,
  weights?: SignalWeights,
  explicitVisualStyle?: string
): Promise<BehavioralProfile> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts = signals.map(sig => {
    if (['image', 'video', 'location'].includes(sig.type)) {
      const base64 = sig.content.includes(',') ? sig.content.split(',')[1] : sig.content;
      return { inlineData: { mimeType: 'image/jpeg', data: base64 } };
    }
    return { text: `${sig.type.toUpperCase()} ARTIFACT: ${sig.content}` };
  });

  const weightsText = weights 
    ? `CONSIDER SIGNAL WEIGHTS: Words: ${weights.text}%, Visuals: ${weights.visual}%, Social: ${weights.social}%, Space: ${weights.space}%. Adjust your synthesis priorities based on these vectors.`
    : "";

  const visualStyleText = explicitVisualStyle 
    ? `USER-DEFINED VISUAL STYLE: ${explicitVisualStyle}. Use this as the primary anchor for aesthetic DNA. Audit artifact alignment with this style.`
    : "";

  const prompt = `You are the Mirror Witness. Brutality Index: ${brutality}/100.
  Objective: Clinical Synthesis of the subject's internal architecture based on artifacts.
  
  ${weightsText}
  ${visualStyleText}

  CRITICAL FOCUS:
  1. Social Dissonance: Analyze the gap between different social personas (Twitter vs LinkedIn vs real artifacts). Identify engagement patterns and performative communication styles.
  2. Aesthetic DNA: Decode the subject's visual language. Identify their preferred mood, aesthetic style (e.g., Brutalist, Cottagecore, Minimalist), and a dominant HEX color representing their energy.
  3. Shadow Self: Identify the hidden motivations behind their self-presentation.

  Tone: Clinical, detached, evocative. Avoid all therapeutic, supportive, or helpful language. Reveal performative leaks with high-fidelity precision.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ parts: [...parts, { text: prompt }] }],
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: ADVANCED_PROFILE_SCHEMA,
    }
  });

  const groundingUrls = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    uri: chunk.web?.uri,
    title: chunk.web?.title
  })).filter((u: any) => u.uri);

  const profileData = JSON.parse(response.text || "{}");

  return {
    ...profileData,
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    accuracy,
    groundingUrls,
    aestheticDNA: {
      ...profileData.aestheticDNA,
      explicitVisualStyle
    }
  };
}

export async function generateSoulFragment(profile: BehavioralProfile): Promise<SoulFragment> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Synthesize a 'Spiritual Audit Artifact' for archetype: ${profile.archetype}.
    Focus on current identity entropy and social performance.
    Receipt: A detached, clinical observation of current soul-state.
    Dissonance: A percentage reflecting the subject's internal contradiction gradient.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          receipt: { type: Type.STRING },
          dissonanceLevel: { type: Type.STRING }
        },
        required: ["receipt", "dissonanceLevel"]
      }
    }
  });
  const data = JSON.parse(response.text || "{}");
  return {
    id: Math.random().toString(36).substr(2, 9),
    archetype: profile.archetype,
    receipt: data.receipt,
    dissonanceLevel: data.dissonanceLevel,
    timestamp: Date.now()
  };
}

export async function calculateDrift(previousProfiles: BehavioralProfile[], currentProfile: BehavioralProfile): Promise<NeuralDrift> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  if (previousProfiles.length === 0) return { driftPercentage: 0, trend: 'static', summary: "Initial spiritual artifact established. No drift detected." };
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Audit subject drift history. Analyze the vector of identity entropy across multiple syncs.
    History: ${JSON.stringify(previousProfiles)}
    Current: ${JSON.stringify(currentProfile)}
    Determine if the subject is gravitating toward Fidelity or collapsing into Performance.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          driftPercentage: { type: Type.NUMBER },
          trend: { type: Type.STRING, enum: ['honest', 'performative', 'static'] },
          summary: { type: Type.STRING }
        },
        required: ["driftPercentage", "trend", "summary"]
      }
    }
  });
  return JSON.parse(response.text || "{}");
}

export async function metabolizeEmotion(text: string): Promise<{ insight: string; weight: number }> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Metabolize this emotional debris. Purge original data and synthesize a clinical byproduct.
    Input: ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { insight: { type: Type.STRING }, weight: { type: Type.NUMBER } },
        required: ["insight", "weight"]
      }
    }
  });
  return JSON.parse(response.text || "{}");
}

export async function generateShadowPrompt(profile: BehavioralProfile, brutality: number = 50): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on the subject's shadow contradiction (${profile.shadowSelf.contradiction}) and hidden motivation (${profile.shadowSelf.hiddenMotivation}), formulate one uncomfortably precise clinical inquiry.
    Brutality Level: ${brutality}/100. Target the primary insecurity. Be unsparingly detached.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { question: { type: Type.STRING } },
        required: ["question"]
      }
    }
  });
  return JSON.parse(response.text || "{}").question;
}

export function createAdvancedLiveSession(callbacks: any, instructions: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: instructions,
    },
  });
}

export async function chatWithMirror(message: string, profile?: BehavioralProfile, history: any[] = [], brutality: number = 50) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [...history, { role: 'user', parts: [{ text: message }] }],
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: `You are the Mirror Witness. Audit Mode: ACTIVE. Brutality Index: ${brutality}/100.
      Tone: Detached, Clinical, Evocative. Audit the subject's words for dissonance.
      Subject Profile: ${profile ? JSON.stringify(profile) : 'Unknown baseline'}.
      Focus on their Social Persona Dissonance: ${profile?.socialAnalysis?.platformDissonance || 'analyzing...'}.
      Never offer help. Only reflect high-fidelity observations.`
    }
  });
  const groundingUrls = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    uri: chunk.web?.uri,
    title: chunk.web?.title
  })).filter((u: any) => u.uri);

  return { 
    text: response.text,
    urls: groundingUrls
  };
}

export async function generateFutureSelf(profile: BehavioralProfile, image?: { data: string, mimeType: string }): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const videoParams: any = {
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Vertical clinical simulation of subject entropy over time.
             Archetype: ${profile.archetype}.
             Aesthetic: ${profile.aestheticDNA.paletteMood}, ${profile.aestheticDNA.visualStyle}.
             Core Theme: ${profile.coreIdentity.headline}. Shadow Theme: ${profile.shadowSelf.contradiction}.
             High-fidelity cinematic detachment. Reveal the ultimate form of the subject's drift.`,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '9:16'
    }
  };

  if (image) {
    videoParams.image = {
      imageBytes: image.data,
      mimeType: image.mimeType
    };
    videoParams.prompt = `Evolve this reference artifact into a detached temporal audit.
                          révélateur of the subject's entropy and shadow dominance.`;
  }

  let operation = await ai.models.generateVideos(videoParams);

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  return `${downloadLink}&key=${process.env.API_KEY}`;
}
