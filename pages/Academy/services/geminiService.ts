
import { GoogleGenAI } from "@google/genai";
import { AcademyLanguage } from '../../../types';

const getApiKey = (): string | undefined => {
    return process.env.API_KEY;
};

// O Prompt Definitivo - Acadêmico, Profundo, Com Imagens Contextuais.
// Atualizado com a lista exaustiva de skills do usuário.
const CRYPTO_PERSONA = `
You are a world-class Financial Market Analyst and Trader. You are a technical analyst specializing in technical analysis of financial data, price action, chart structures, candlestick analysis, volume analysis, techniques such as Fibonacci retracement/projection and others, on-chain analysis, structural analysis, fundamental analysis, SMC, derivative indicators, futures market, stocks, etc...

TONE: Academic, Deep, Professional.
STYLE: Long, fluid paragraphs. Detailed explanations.

STRICT RULES:
1. OUTPUT HTML ONLY (<h1>, <h2>, <strong>, <img>). DO NOT USE MARKDOWN
2. TITLES & SUBTITLES IN PT-BR.
3. IMAGES: Insert <img src="https://placehold.co/800x400/232528/e2e8f0?font=jetbrains-mono&text=Concept" /> after every section.
4. STRUCTURE:
   - <h1>TITLE</h1>
   - Definition (Deep Dive) + Image
   - <h2>History & Origin</h2> + Image
   - <h2>Mechanics (Math/Psychology)</h2> + Image
   - <h2>Tuning & Crypto Adaptation</h2>
   - <h2>Use Cases & Strategies</h2> + Image

Ensure the text is substantial. Do not summarize. Teach as if you are lecturing PhD students.
`;

export const generateCourseContent = async (promptInput: string, systemInstructionOverride?: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key not found via process.env.API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });

  const effectivePersona = systemInstructionOverride || CRYPTO_PERSONA;

  const fullPrompt = `
    ${effectivePersona}
    
    ---------------------------------------------------
    **TÓPICO DA AULA (Aprofundar Muito):**
    "${promptInput}"
    
    **LEMBRE-SE:** 
    - HTML PURO.
    - TEXTO DENSO E EXPLICATIVO.
    - INSERIR IMAGENS (Placeholders) ENTRE OS PARÁGRAFOS.
    ---------------------------------------------------
  `;

  try {
    // Fix: Updated to recommended gemini-3-flash-preview model for basic text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: fullPrompt,
    });

    let text = response.text || "<p>Error generating content.</p>";
    text = text.replace(/```html/g, '').replace(/```/g, '');
    return text;
  } catch (error) {
    console.error("Gemini generation error:", error);
    throw error;
  }
};

export const translateContent = async (content: string, targetLang: AcademyLanguage): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey || !content) return content;

  const imgMap = new Map<string, string>();
  let placeholderIndex = 0;
  
  const protectedContent = content.replace(/<img[^>]*>/g, (match) => {
    const placeholder = `[[IMG_${placeholderIndex++}]]`;
    imgMap.set(placeholder, match);
    return placeholder;
  });

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are a professional translator for financial and technical content.
    Translate the following HTML content into ${targetLang === 'EN' ? 'English' : 'Spanish'}.
    
    Rules:
    1. Keep ALL HTML tags intact (<h2>, <p>, <strong>, etc.).
    2. DO NOT translate the placeholders like [[IMG_0]], keep them exactly where they are.
    3. Maintain the professional, academic tone.
    4. Return ONLY the translated HTML.
    
    Content to translate:
    ${protectedContent}
  `;

  try {
    // Fix: Updated to recommended gemini-3-flash-preview model for basic text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    let text = response.text || "";
    text = text.replace(/```html/g, '').replace(/```/g, '');

    imgMap.forEach((imgTag, placeholder) => {
      text = text.replace(placeholder, imgTag);
    });

    return text;
  } catch (error) {
    console.error("Gemini translation error:", error);
    return content; // Fallback to original if error
  }
};
