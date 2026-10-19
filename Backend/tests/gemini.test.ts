import { expect, test } from "bun:test";
import { ApiError, GoogleGenAI } from "@google/genai";
import { geminiConfigured, geminiContents, generateAnswer, GEMINI_HTTP_OPTIONS } from "../src/services/chat/geminiService";
import { chat } from "../src/services/chat/chatService";
import { INSUFFICIENT } from "../src/services/chat/chatPrompt";
import type { EnergyContent } from "../../shared/discovery";
const source: EnergyContent = { objectID: "fixture", contentId: "fixture", title: "Fuente de prueba", description: "Resumen de prueba", kind: "article", category: "energy_communities", topics: ["energy_communities"], source: "MinEnergía", sourceUrl: "https://www.minenergia.gov.co/es/", publishedAt: null, indexedAt: "2026-09-21", keywords: [] };
async function settings(values: Record<string,string|undefined>, action: () => Promise<void>) {
  const old = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try { for (const [key,value] of Object.entries(values)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } await action(); }
  finally { for (const [key,value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}
test("Gemini requiere su propia clave y modelo; no usa credenciales OpenAI", async () => {
  for (const values of [{GEMINI_API_KEY:undefined,GEMINI_MODEL:"gemini-2.5-flash"},{GEMINI_API_KEY:"fixture",GEMINI_MODEL:undefined}]) {
    await settings(values,async () => {
      expect(geminiConfigured()).toBe(false);
      await expect(generateAnswer("pregunta",[],[source])).rejects.toThrow("no está configurado");
      await expect(chat("uid","pregunta",[])).rejects.toThrow("no está configurado");
    });
  }
});
test("Gemini transforma roles y acota historial y fuentes", () => {
  const contents = geminiContents("¿Y en Medellín?",[{role:"user",content:"Comunidades en Antioquia"},{role:"assistant",content:"Respuesta anterior"}],Array.from({length:8},(_,i)=>({...source,objectID:String(i)})));
  expect(contents.map(c=>c.role)).toEqual(["user","model","user"]);
  expect(contents[0]?.parts?.[0]?.text).toBe("Comunidades en Antioquia");
  const context = contents.at(-1)?.parts?.[0]?.text;
  expect(context).toContain('"reference":5');
  expect(context).not.toContain('"reference":6');
  expect(context).toContain("¿Y en Medellín?");
  expect(geminiContents("p",Array.from({length:7},()=>({role:"user" as const,content:"x".repeat(2000)})),[])).toHaveLength(5);
});
test("SDK oficial serializa configuración, contexto y clave solo en la petición del servidor", async () => {
  await settings({GEMINI_MODEL:"gemini-2.5-flash"},async () => {
    let body:any, url="", keyHeader="";
    const client = new GoogleGenAI({apiKey:"fixture-not-a-real-key",vertexai:false,httpOptions:{...GEMINI_HTTP_OPTIONS,fetch:async(input,init)=>{
      url=String(input);body=JSON.parse(String(init?.body));keyHeader=new Headers(init?.headers).get("x-goog-api-key")||"";
      return Response.json({candidates:[{content:{role:"model",parts:[{text:"Respuesta de prueba [1]"}]},finishReason:"STOP"}]});
    }}});
    expect(await generateAnswer("Pregunta",[{role:"assistant",content:"Anterior"}],[source],client)).toBe("Respuesta de prueba [1]");
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain("gemini-2.5-flash:generateContent");
    expect(url).not.toContain("fixture-not-a-real-key");
    expect(keyHeader).toBe("fixture-not-a-real-key");
    expect(body.systemInstruction.parts[0].text).toContain("No inventes");
    expect(body.contents[0].role).toBe("model");
    expect(body.generationConfig.maxOutputTokens).toBe(1000);
    expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(0);
  });
});
test("Gemini cuota, credenciales y modelo devuelven errores sin detalles privados", async () => {
  for (const status of [400,401,403,404,429,500]) {
    const fake={models:{generateContent:async()=>{throw new ApiError({status,message:"secret provider details"});}}};
    await expect(generateAnswer("p",[],[],fake)).rejects.toThrow(status===429?"límite de uso":status===500?"no está disponible temporalmente":"configuración de acceso");
  }
});
test("Gemini rechaza respuesta vacía, truncada y bloqueada", async () => {
  for(const response of [{candidates:[],text:""}, {candidates:[{finishReason:"MAX_TOKENS"}],text:"incompleta"}, {candidates:[{finishReason:"SAFETY"}],text:"bloqueada"}]){
    await expect(generateAnswer("p",[],[],{models:{generateContent:async()=>response}} as any)).rejects.toThrow("no está disponible temporalmente");
  }
});
test("timeout y error de red no filtran detalles", async () => {
  for(const error of [new DOMException("private details","TimeoutError"),new Error("network private details")]){
    await expect(generateAnswer("p",[],[],{models:{generateContent:async()=>{throw error;}}})).rejects.toThrow("no está disponible temporalmente");
  }
});
test("SDK no reintenta automáticamente ni repite consumo tras 503", async () => {
  await settings({GEMINI_MODEL:"gemini-2.5-flash"},async () => {
    let calls=0;
    const client=new GoogleGenAI({apiKey:"fixture",vertexai:false,httpOptions:{...GEMINI_HTTP_OPTIONS,fetch:async()=>{
      calls++;return Response.json({error:{code:503,message:"fixture error",status:"UNAVAILABLE"}},{status:503});
    }}});
    await expect(generateAnswer("p",[],[],client)).rejects.toThrow("no está disponible temporalmente");
    expect(calls).toBe(1);expect(GEMINI_HTTP_OPTIONS.timeout).toBe(45000);
  });
});
test("sin fuentes no se solicita generación y con fuentes mantiene respuesta y atribución", async () => {
  let calls=0;
  const generate=async()=>{calls++;return "Respuesta [1]";};
  expect((await chat("uid","p",[],{retrieve:async()=>({sources:[]}),generateAnswer:generate})).answer).toBe(INSUFFICIENT);
  expect(calls).toBe(0);
  const result=await chat("uid","p",[],{retrieve:async()=>({sources:[source],category:"energy_communities"}),generateAnswer:generate});
  expect(result.sources).toEqual([source]);expect(calls).toBe(1);
});
