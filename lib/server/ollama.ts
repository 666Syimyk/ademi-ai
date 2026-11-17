import { ApiError } from "./http";
import {
  createAssistantInstructions,
  type PsychologyResponseContext,
} from "./openai";
import { runtimeEnv } from "./runtime";
import type { Language } from "./safety";

type OllamaChatResponse = {
  model?: string;
  message?: { content?: string };
};

type OllamaTagsResponse = {
  models?: Array<{ name?: string; model?: string }>;
};

type OllamaConfig = {
  baseUrl: string | undefined;
  model: string;
};

type AvailabilityCache = {
  key: string;
  available: boolean;
  checkedAt: number;
};

const AVAILABILITY_CACHE_TTL_MS = 8_000;
const DEFAULT_OLLAMA_RESPONSE_TIMEOUT_MS = 45_000;
const OLLAMA_MAX_OUTPUT_TOKENS = 320;
let availabilityCache: AvailabilityCache | undefined;

function ollamaConfig(): OllamaConfig {
  const configuredBaseUrl = runtimeEnv().OLLAMA_BASE_URL?.trim();
  return {
    baseUrl: configuredBaseUrl?.replace(/\/+$/, "") || undefined,
    model: runtimeEnv().OLLAMA_MODEL?.trim() || "qwen3.5:4b",
  };
}

function ollamaResponseTimeoutMs() {
  const configuredTimeoutValue = runtimeEnv().OLLAMA_RESPONSE_TIMEOUT_MS?.trim();
  if (!configuredTimeoutValue || !/^\d+$/.test(configuredTimeoutValue)) {
    return DEFAULT_OLLAMA_RESPONSE_TIMEOUT_MS;
  }
  const configuredTimeout = Number(configuredTimeoutValue);
  return Number.isSafeInteger(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_OLLAMA_RESPONSE_TIMEOUT_MS;
}

function availabilityCacheKey({ baseUrl, model }: OllamaConfig) {
  return `${baseUrl ?? ""}\u0000${model}`;
}

export function invalidateOllamaAvailability() {
  availabilityCache = undefined;
}

export function isOllamaResponseFailure(error: unknown) {
  return (
    error instanceof ApiError &&
    [
      "local_ai_unavailable",
      "local_ai_timeout",
      "local_ai_malformed",
      "local_ai_empty",
      "ai_provider_error",
      "empty_ai_response",
    ].includes(error.code)
  );
}

export async function isOllamaModelAvailable() {
  const { baseUrl, model } = ollamaConfig();
  if (!baseUrl) return false;
  const key = availabilityCacheKey({ baseUrl, model });
  const now = Date.now();
  if (
    availabilityCache?.key === key &&
    now - availabilityCache.checkedAt < AVAILABILITY_CACHE_TTL_MS
  ) {
    return availabilityCache.available;
  }

  let available = false;
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(800),
    });
    if (response.ok) {
      const result = (await response.json()) as OllamaTagsResponse;
      available = (result.models ?? []).some(
        (entry) => entry.name === model || entry.model === model,
      );
    }
  } catch {
    available = false;
  }
  availabilityCache = { key, available, checkedAt: now };
  return available;
}

export async function createOllamaResponse(
  input: string,
  language: Language,
  context: PsychologyResponseContext,
) {
  const { baseUrl, model } = ollamaConfig();
  if (!baseUrl)
    throw new ApiError(503, "Локальная модель не настроена", "ai_not_configured");

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        messages: [
          {
            role: "system",
            content: createAssistantInstructions(language, context),
          },
          ...(context.history ?? []),
          { role: "user", content: input },
        ],
        options: { num_predict: OLLAMA_MAX_OUTPUT_TOKENS },
        keep_alive: "15m",
      }),
      signal: AbortSignal.timeout(ollamaResponseTimeoutMs()),
    });
  } catch (error) {
    invalidateOllamaAvailability();
    throw new ApiError(
      503,
      "Локальный ИИ не запущен. Запустите Ollama и повторите запрос.",
      error instanceof DOMException && error.name === "TimeoutError"
        ? "local_ai_timeout"
        : "local_ai_unavailable",
    );
  }
  if (!response.ok) {
    invalidateOllamaAvailability();
    throw new ApiError(
      503,
      "Локальный ИИ временно недоступен. Убедитесь, что Ollama запущен, а модель загружена, и повторите запрос.",
      "local_ai_unavailable",
    );
  }

  let result: OllamaChatResponse;
  try {
    result = (await response.json()) as OllamaChatResponse;
  } catch {
    invalidateOllamaAvailability();
    throw new ApiError(
      502,
      "Локальный ИИ вернул некорректный ответ",
      "ai_provider_error",
    );
  }
  const text = result.message?.content?.trim();
  if (!text)
    invalidateOllamaAvailability();
  if (!text)
    throw new ApiError(502, "Локальный ИИ вернул пустой ответ", "empty_ai_response");

  return {
    text,
    sources: context.courseReference
      ? [{ filename: context.courseReference.label, fileId: null }]
      : [],
    model: result.model ?? model,
    responseId: undefined,
  };
}
