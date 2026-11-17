import {
  createPsychologyResponse,
  type PsychologyResponseContext,
} from "./openai";
import { createOllamaResponse, isOllamaModelAvailable } from "./ollama";
import { runtimeEnv } from "./runtime";
import type { Language } from "./safety";

export type GenerativeProvider = "openai" | "ollama";

export function preferredGenerativeProvider(): GenerativeProvider | null {
  const preferredProvider = runtimeEnv().ADEMI_AI_PROVIDER?.trim();
  return preferredProvider === "openai" || preferredProvider === "ollama"
    ? preferredProvider
    : null;
}

export async function generativeProvider(): Promise<GenerativeProvider | null> {
  const preferredProvider = preferredGenerativeProvider();
  const hasOpenAI = Boolean(runtimeEnv().OPENAI_API_KEY?.trim());

  if (preferredProvider === "openai") return hasOpenAI ? "openai" : null;
  if (preferredProvider === "ollama")
    return (await isOllamaModelAvailable()) ? "ollama" : null;

  // Prefer the no-cost local model whenever it is ready. Cloud deployments
  // without a reachable Ollama instance can still opt into OpenAI explicitly.
  if (await isOllamaModelAvailable()) return "ollama";
  return hasOpenAI ? "openai" : null;
}

export function createGenerativeResponse(
  provider: GenerativeProvider,
  input: string,
  language: Language,
  context: PsychologyResponseContext,
) {
  return provider === "openai"
    ? createPsychologyResponse(input, language, context)
    : createOllamaResponse(input, language, context);
}
