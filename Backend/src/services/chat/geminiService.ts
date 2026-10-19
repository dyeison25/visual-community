import { ApiError, GoogleGenAI, ThinkingLevel, type ThinkingConfig, type Content, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import type { ChatTurn, EnergyContent } from "../../../../shared/discovery";
import { DiscoveryError } from "../discovery/algolia.service";
import { instructions, responseInput } from "./chatPrompt";
import { logGeminiError } from "./geminiDiagnostic";
export { INSUFFICIENT } from "./chatPrompt";

type GeminiClient = { models: { generateContent: (params: GenerateContentParameters) => Promise<GenerateContentResponse> } };
export const GEMINI_HTTP_OPTIONS = { timeout: 45000, retryOptions: { attempts: 1 } };

export function geminiThinkingConfig(model: string): ThinkingConfig | undefined {
  if (model === "gemini-2.5-flash" || model === "gemini-2.5-flash-lite") return { thinkingBudget: 0 };
  if (model === "gemini-3.6-flash") return { thinkingLevel: ThinkingLevel.MINIMAL };
  return undefined;
}

/** Solo comprueba configuración del servidor; nunca devuelve la clave al navegador. */
export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim() && process.env.GEMINI_MODEL?.trim());
}

/** Gemini llama "model" al rol del asistente. El historial se envía acotado, sin persistirlo. */
export function geminiContents(question: string, history: ChatTurn[], sources: EnergyContent[]): Content[] {
  return responseInput(question, history, sources).map(turn => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));
}

/** Genera texto con el SDK oficial. La recuperación de fuentes permanece en retrievalService. */
export async function generateAnswer(question: string, history: ChatTurn[], sources: EnergyContent[], client?: GeminiClient): Promise<string> {
  if (!client && !geminiConfigured())
    throw new DiscoveryError(503, "El asistente todavía no está configurado. Puedes consultar las fuentes en la plataforma.");
  const model = process.env.GEMINI_MODEL?.trim() || "";
  try {
    const gemini = client || new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!.trim(),
      vertexai: false,
      httpOptions: GEMINI_HTTP_OPTIONS,
    });
    const response = await gemini.models.generateContent({
      model,
      contents: geminiContents(question, history, sources),
      config: {
        systemInstruction: instructions,
        maxOutputTokens: 1000,
        // Flash 2.5 permite desactivar razonamiento para dedicar el límite a la respuesta.
        thinkingConfig: geminiThinkingConfig(model),
        abortSignal: AbortSignal.timeout(GEMINI_HTTP_OPTIONS.timeout),
      },
    });
    const candidate = response.candidates?.[0];
    // No presentar respuestas truncadas ni contenido bloqueado como una respuesta completa.
    if (candidate?.finishReason !== "STOP" || !response.text?.trim()) throw Error("Incomplete response");
    return response.text.trim();
  } catch (error) {
    logGeminiError(error, model);
    if (error instanceof ApiError) {
      if (error.status === 429)
        throw new DiscoveryError(429, "El asistente alcanzó su límite de uso. Intenta nuevamente más tarde.");
      if ([400, 401, 403, 404].includes(error.status))
        throw new DiscoveryError(503, "El asistente no está disponible temporalmente. El administrador debe revisar su configuración de acceso.");
    }
    throw new DiscoveryError(503, "El asistente no está disponible temporalmente. Intenta nuevamente más tarde.");
  }
}
