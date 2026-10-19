import { expect, test, spyOn } from "bun:test";
import { ApiError } from "@google/genai";
import { geminiDiagnostic, redactGeminiSecrets } from "../src/services/chat/geminiDiagnostic";
import { generateAnswer } from "../src/services/chat/geminiService";

test("diagnóstico conserva status HTTP, código, mensaje y modelo originales",()=>{
  const error=new ApiError({status:404,message:JSON.stringify({error:{code:404,status:"NOT_FOUND",message:"This model is no longer available to new users.",details:[{reason:"MODEL_UNAVAILABLE"}]}})});
  expect(geminiDiagnostic(error,"gemini-2.5-flash")).toEqual({provider:"gemini",httpStatus:404,code:404,status:"NOT_FOUND",reason:"MODEL_UNAVAILABLE",message:"This model is no longer available to new users.",model:"gemini-2.5-flash"});
});
test("diagnóstico elimina la clave incluso si Google la incluye en mensaje o URL",()=>{
  const old=process.env.GEMINI_API_KEY;
  const fixture="fixture-key/with+encoding";
  process.env.GEMINI_API_KEY=fixture;
  try {
    const text=redactGeminiSecrets("key "+fixture+" encoded "+encodeURIComponent(fixture)+" https://example.invalid?key=another-fixture&x=1");
    expect(text).not.toContain(fixture);
    expect(text).not.toContain(encodeURIComponent(fixture));
    expect(text).not.toContain("another-fixture");
    expect(text).toContain("[REDACTED]");
  } finally {if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;}
});
test("servicio registra el error antes de devolver el mensaje público",async()=>{
  const log=spyOn(console,"error").mockImplementation(()=>{});
  const error=new ApiError({status:404,message:JSON.stringify({error:{code:404,status:"NOT_FOUND",message:"Model unavailable"}})});
  try {
    await expect(generateAnswer("p",[],[],{models:{generateContent:async()=>{throw error;}}})).rejects.toThrow();
    expect(log).toHaveBeenCalledTimes(1);
    const detail=JSON.parse(String(log.mock.calls[0]?.[1]));
    expect(detail.httpStatus).toBe(404);
    expect(detail.status).toBe("NOT_FOUND");
    expect(detail.message).toBe("Model unavailable");
    expect(detail.model).toBe(process.env.GEMINI_MODEL?.trim()||"");
  }finally{log.mockRestore();}
});
test("fallo de red sin JSON conserva mensaje sin stack ni objeto de petición",()=>{
  const result=geminiDiagnostic(new Error("Network disconnected"),"gemini-3.6-flash");
  expect(result.httpStatus).toBeNull();
  expect(result.message).toBe("Network disconnected");
  expect(result).not.toHaveProperty("stack");
});
