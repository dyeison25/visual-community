import { GoogleGenAI } from "@google/genai";
import { GEMINI_HTTP_OPTIONS, geminiConfigured, geminiThinkingConfig } from "../src/services/chat/geminiService";
import { logGeminiError, redactGeminiSecrets } from "../src/services/chat/geminiDiagnostic";

const model = process.env.GEMINI_MODEL?.trim() || "";
const question = "¿Qué es una comunidad energética?";
console.log(JSON.stringify({ provider:"gemini", model, configured:geminiConfigured(), question }));
if (!geminiConfigured()) {
  console.error("Falta GEMINI_API_KEY o GEMINI_MODEL en Backend/.env.");
  process.exitCode=1;
} else {
  try {
    const ai = new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY!.trim(),vertexai:false,httpOptions:GEMINI_HTTP_OPTIONS});
    const response = await ai.models.generateContent({model,contents:question,config:{maxOutputTokens:1000,
      thinkingConfig:geminiThinkingConfig(model)}});
    console.log(JSON.stringify({model,finishReason:response.candidates?.[0]?.finishReason,answer:redactGeminiSecrets(response.text||"")}));
    if(response.candidates?.[0]?.finishReason!=="STOP"||!response.text?.trim()) process.exitCode=1;
  } catch(error) {
    logGeminiError(error,model);
    process.exitCode=1;
  }
}
