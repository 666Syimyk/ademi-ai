# ADEMI MIND — full audit and remediation design

## Purpose

Make ADEMI MIND dependable as a specialised, psychologically safe support product in Russian, Kyrgyz, and English. This is not a claim that the local model can outperform Gemini at general knowledge or multimodal tasks. The target advantage is a predictable psychology workflow: explicit safety boundaries, practical next steps, transparent data handling, local speech recognition, and a graceful response when the local model is slow or offline.

## Evidence collected

- Production dependency scan: `npm audit --omit=dev --json` reports 0 vulnerabilities.
- Development dependency scan: 19 vulnerabilities, concentrated in the Vite/Cloudflare/Vinext development toolchain.
- Type check fails in `app/api/chat/route.ts` (nullable provider) and `vite.config.ts` (implicit `any`).
- Real local Ollama responses took 161.3 seconds and then failed after 180.2 seconds. `lib/server/ollama.ts` permits 1,200 generated tokens and a 180-second request.
- A real local sidecar health check and prior live TTS/STT probes succeeded.
- User-facing source review found a missing `media-src blob:` CSP directive, account-agnostic voice consent, no way to withdraw voice consent, incomplete privacy disclosure, and a misleading Russian sign-in claim that only Russian is supported.
- Browser capture is not available in this session, so this is not a complete visual screenshot audit. Source-based accessibility review and server/API checks continue; browser visual validation remains a release requirement.

## Required behaviour

1. A normal chat request must complete quickly or return a safe guided-psychology response, not a three-minute opaque failure.
2. A slow, restarting, empty, or malformed local model must not consume a user-visible interaction with a 503 when guided support can respond safely.
3. The response metadata must accurately say whether a generative provider or guided response produced the answer.
4. Audio playback must be permitted by the worker CSP. Voice consent must be scoped to the signed-in account, explain Edge Neural TTS, and be revocable in the profile.
5. The privacy page must state what selected reply text is sent for online voice synthesis, that microphone audio is handled locally by the sidecar, and how consent can be withdrawn.
6. The hosted deployment must not show audio controls that only function through the local Vite proxy. A separately deployed HTTPS voice service remains required before enabling voice in production.
7. Russian, Kyrgyz, and English UI copy must remain truthful; Russian neural speech is the only currently enabled voice output.
8. Critical checks must pass: TypeScript, lint, production build, integration tests, Python service tests, dependency audit, and live local health/chat/voice probes where possible.

## Boundaries and decisions

- Do not change the default chat-history preference: that is a product-policy decision needing owner approval.
- Do not deploy a public voice/STT service, change payment infrastructure, or claim legal readiness; those require owner credentials and infrastructure decisions.
- Do not blindly run `npm audit fix`: its proposed Drizzle Kit downgrade is incompatible with a safe upgrade path.
- Update direct development packages only after compatibility checks and a full verification run.
- Preserve all pre-existing uncommitted work.

## Priority order

| Priority | Finding | Remediation |
| --- | --- | --- |
| P0 | 161–180 second Ollama wait and 503 failure | Bound response generation, add timeouts/error classification, and fall back to guided psychology support. |
| P0 | TypeScript fails | Fix nullable provider flow and Vite proxy parameter typing. |
| P0 | Worker CSP can block `blob:` audio | Add an explicit `media-src 'self' blob:` policy and test it. |
| P0 | Voice privacy/consent incomplete | Account-scope consent, revoke control, localised disclosure, privacy policy update. |
| P0 | Hosted voice controls cannot reach local sidecar | Expose runtime capability and hide/clearly explain unavailable controls outside local development. |
| P1 | Mic processing cannot be cancelled and copy is Russian-only | Make processing cancellable and localise voice/microphone copy. |
| P1 | `ffprobe` dependency is opaque | Surface decoder readiness in local health endpoint and document prerequisite. |
| P1 | Development toolchain advisories | Upgrade compatible direct packages, then re-scan and rebuild. |
| P2 | Legal links discard language | Preserve `lang` in in-app legal links. |

## Gemini comparison guardrail

Gemini remains the stronger general-purpose, broad-language and multimodal assistant. ADEMI MIND is designed to be stronger only for a narrow promise: psychologically oriented, safety-bounded conversations with clear next steps and transparent voice/data behaviour. Release copy must never claim universal superiority over Gemini.

