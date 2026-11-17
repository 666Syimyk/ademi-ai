# Local voice, multilingual text, and psychology design

## Purpose

Turn ADEMI MIND into a stronger multilingual psychological-support assistant for the local Windows installation:

- RU, KG, and EN are available for typed UI and model responses.
- Russian replies can be read with a high-quality non-browser neural voice.
- Voice input uses local transcription rather than Chrome Speech Recognition.
- The assistant gives structured, humane psychological support without claiming to diagnose, treat, or replace a qualified professional or emergency service.

## Decisions

### Voice output

The selected default is free Edge Neural TTS through the already installed local Python environment:

- Default voice: `ru-RU-SvetlanaNeural`; offer `ru-RU-DmitryNeural` as an optional second voice.
- The browser receives MP3 audio and plays it with an HTML audio element. It must not use `speechSynthesis`.
- A local FastAPI sidecar listens only at `127.0.0.1:8091` and exposes `POST /v1/audio/speech`.
- The browser calls the sidecar through a same-origin local development proxy. Audio is streamed in memory and never saved by the application.
- Edge Neural TTS is free and needs no API key, but it is an online Microsoft service. The text of a Russian assistant reply is sent to that service to synthesize speech. Before the first playback, the UI must show an explicit Russian consent notice. The app must not claim that this voice works offline or that voice text remains solely on the device.
- Limit a synthesis request to 6,000 characters and enforce a timeout. On failure, display a clear Russian error and do not fall back to browser speech synthesis.
- Russian is the only language with a visible playback control in this release. Replies recorded as KG or EN have no playback control.

### Voice input

Replace browser `SpeechRecognition` with a local transcription path:

1. The browser requests microphone permission with `getUserMedia` and records an in-memory WebM/Opus clip through `MediaRecorder`.
2. It sends the clip to the local sidecar at `POST /v1/audio/transcribe` through the same local proxy.
3. The sidecar runs the already cached multilingual `faster-whisper` Small model on CPU with `int8` compute and returns text only.
4. The browser inserts the returned text into the composer; it does not send automatically.

Constraints:

- Bind the sidecar only to localhost.
- Do not retain recordings. If a temporary audio file is needed for decoding, delete it in `finally` immediately after transcription.
- Enforce a 60-second / 10 MB capture limit and expose recording, processing, permission, unavailable-service, and error states.
- Browser microphone permission remains required by platform security. Fix the existing `Permissions-Policy` from `microphone=()` to `microphone=(self)` so the browser can request that permission.
- The multilingual Whisper Small model handles Russian and English. Kyrgyz is supported as a best-effort language; a specialized local Kyrgyz model can be evaluated later, but is not enabled without quality validation.

### Text languages

Restore the existing three-language application support instead of the temporary Russian-only lock:

- The language selector and profile selector offer `RU`, `KG`, and `EN`.
- The chosen language controls UI copy, date formatting, persisted chat language, safety response language, guided fallback language, and generative response language.
- The model is prompted to understand all three languages and answer in the selected language. It does not silently change the UI language based on a single message.
- When a user switches language, active audio/recording is stopped and a new chat is started to avoid mixing language settings inside one conversation.
- Historical messages retain their stored language so RU playback is available only for a Russian historical answer.

### Psychological response protocol

The shared OpenAI/Ollama instructions will be replaced with a localized version of one protocol:

1. Respond directly and respectfully to the stated situation; do not invent diagnoses, motives, memories, or facts.
2. Identify the practical core: event, interpretation, emotion, body reaction, need, and desired result only when useful.
3. Give a concise explanation in plain language and no more than three tailored low-risk actions. Prefer a relevant CBT, ACT, DBT, grounding, communication, values, boundary, or problem-solving tool over generic advice.
4. End with one achievable next step for the next 24 hours. If vital context is missing, ask one focused question instead.
5. Preserve the existing deterministic crisis, violence, and urgent-medical routes before any model call.
6. Keep strict limits: no diagnosis, medication change, treatment plan, financial or healing guarantees, dependency encouragement, or replacement of professional/emergency help.

The existing three-language guided psychology fallback remains in place and is selected by the restored language value.

## Components and data flow

```text
Chat response (RU) ──> Playback click ──> local proxy ──> 127.0.0.1:8091 TTS
                                                     └──> Edge Neural TTS ──> MP3 ──> <audio>

Microphone click ──> getUserMedia + MediaRecorder ──> local proxy ──> 127.0.0.1:8091 Whisper
                                                                        └──> transcript ──> composer

Language selector ──> /api/me preference + /api/chat language ──> safety / Ollama / guided fallback
```

The local proxy is only for the local developer run. A deployed Cloudflare Worker cannot reach a Python process on the user’s machine. Production deployment therefore requires a separately deployed voice companion or a provider decision; the UI must report a missing local voice service rather than pretending it is available.

## Files and verification

Expected work:

- `local_ai/voice_service.py` and a pinned local Python requirements file for FastAPI, Uvicorn, edge-tts, faster-whisper, and decoding.
- `scripts/dev-local-ai.mjs`, `package.json`, and Vite proxy configuration to run the local app and sidecar together.
- `app/page.tsx`, `app/globals.css`, and a small client audio/recording adapter.
- `worker/index.ts` for microphone permission policy.
- `app/api/chat/route.ts`, `lib/server/psychology-protocol.ts`, `lib/server/openai.ts`, and message API types for restored text languages and locale-aware psychology instructions.
- Tests for locale normalization/prompting, UI controls, RU-only playback, local-audio error states, microphone policy, and full existing chat safety behavior.

Verification must include lint, build, the complete Node test suite, a local TTS MP3 smoke test, a local Whisper transcription smoke test, and a manual browser check for permission, recording, stopping, Russian playback, KG/EN typed answers, and crisis routing.
