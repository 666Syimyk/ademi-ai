# ADEMI MIND

ADEMI MIND is a Russian, Kyrgyz, and English AI companion with a premium black-and-gold interface, saved conversations, a safety layer, and a free local-model option.

## Run locally

Install Node.js 22.13 or later, then install dependencies:

```bash
npm install
```

For full open-ended answers at no API cost, install Ollama and download the default model:

```powershell
winget install Ollama.Ollama
ollama pull qwen3.5:4b
ollama list
```

The Ollama desktop app normally starts its local service automatically. If it is not running, start it with:

```powershell
ollama serve
```

Start ADEMI MIND:

```bash
npm run dev
```

Open `http://localhost:3000`. Local development includes a safe local sign-in emulation, so `/signin-with-chatgpt` redirects to the app instead of returning a 404. The local D1 schema initializes automatically on the first request.

## Local voice and microphone

Install the companion once, then start the app normally:

```powershell
py -3.12 -m pip install -r local_ai/requirements.txt
winget install --id Gyan.FFmpeg --exact
# Open a new terminal after installation, then confirm the decoder is on PATH.
ffprobe -version
npm run dev
Invoke-RestMethod http://localhost:3000/local-ai/health
```

`ffprobe` from FFmpeg is required for local speech-to-text. The health response includes `decoderAvailable`; it must be `true` before microphone transcription can work. `npm run dev` starts both Vinext and a localhost-only voice companion on `127.0.0.1:8091`. If the voice companion cannot start, the web app stays available and the terminal prints the reason; voice playback and microphone transcription remain unavailable. `npm run dev:app` starts only the web application, which is useful for troubleshooting but leaves voice and transcription unavailable.

- Russian assistant replies can be played with Edge Neural TTS (`ru-RU-SvetlanaNeural` or `ru-RU-DmitryNeural`). It is online and needs no API key, but it sends only the selected reply text to Microsoft after the person explicitly allows it in the interface. It is not an offline or device-private voice service.
- Microphone recordings are captured in browser memory, transcribed locally by Whisper Small, and are not saved. A short temporary decode file is removed immediately after transcription. Browser microphone permission is still required.
- Typing and responses work in Russian, Kyrgyz, and English. Playback is intentionally limited to Russian in this release.

If Python 3.12 is installed in a nonstandard location, set `ADEMI_PYTHON` to its executable in the shell before running `npm run dev`.

## AI modes

`ADEMI_AI_PROVIDER=ollama` is the local default. With Ollama running and the selected model present, ADEMI MIND answers broad questions about study, work, writing, ideas, technology, and psychology. If Ollama is offline, its model is not downloaded, or the local model fails during a response, the app returns its built-in guided psychology response instead, reports no active provider, and releases the chat allowance.

Configure the provider in an ignored `.env` file if needed:

```dotenv
ADEMI_AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5:4b

# Optional hosted mode
# ADEMI_AI_PROVIDER=openai
# OPENAI_API_KEY=...
# OPENAI_MODEL=gpt-5.6-terra
```

Use `ADEMI_AI_PROVIDER=openai` only when an OpenAI key is intentionally configured. The interface labels this as cloud AI; it never presents it as a local model.

## Deployment note

`127.0.0.1` means the machine where the Worker runs. A deployed Cloudflare Worker cannot access a visitor’s or developer’s computer through `127.0.0.1`. For a hosted release, use the OpenAI provider or an Ollama-compatible endpoint that is deliberately reachable from the Worker and secured by your infrastructure. Keep the guided mode available as the no-model fallback.

In local mode, Ollama generation happens on the machine that runs Ollama. Conversation history is still stored by the app when history is enabled (locally in development, or in the configured D1 database when hosted). Do not submit passwords, API keys, or other secrets in chat.

## Verification

```bash
npm run build
npm run lint
npm test
```

`npm test` builds the application and runs the complete suite: rendering, local sign-in, local Ollama happy-path and outage recovery, profile data handling, safety, and guided-mode boundaries.

## Project layout

- `app/` — interface and API routes
- `lib/server/` — provider selection, Ollama/OpenAI clients, safety, and guided responses
- `db/` and `drizzle/` — D1 schema and migrations
- `worker/` — Cloudflare/Vinext entry point and local-development identity bridge
- `tests/` — full regression coverage
