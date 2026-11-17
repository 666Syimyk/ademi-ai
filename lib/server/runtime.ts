import { env } from "cloudflare:workers";

export type RuntimeBindings = {
  DB: D1Database;
  MATERIALS: R2Bucket;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
  // Local development/test override. Production uses the built-in 45 second
  // timeout when this binding is absent.
  OLLAMA_RESPONSE_TIMEOUT_MS?: string;
  ADEMI_AI_PROVIDER?: "openai" | "ollama";
  ADEMI_OWNER_EMAIL?: string;
  ADEMI_SUPPORT_EMAIL?: string;
  PAYMENT_PROVIDER?: string;
  PAYMENT_CHECKOUT_URL?: string;
  PAYMENT_WEBHOOK_SECRET?: string;
  ADEMI_LOCAL_DEV_AUTH?: string;
};

export function runtimeEnv() {
  return env as unknown as RuntimeBindings;
}
