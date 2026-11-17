# Local Voice, Multilingual Text, and Psychology Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver natural Russian neural playback, reliable local speech-to-text, RU/KG/EN typed chat, and a stronger locale-aware psychological support protocol in ADEMI MIND.

**Architecture:** A localhost-only FastAPI sidecar provides Edge Neural MP3 synthesis and faster-whisper transcription; the Vite development proxy exposes it to the app as same-origin `/local-ai/*`. The browser records audio in memory, posts it to the sidecar, and never persists recordings. The existing language/safety/chat pipeline regains its three-language flow, while shared Ollama/OpenAI instructions use an explicit, safe psychology protocol for the selected language.

**Tech Stack:** Next-compatible Vinext/React 19, Cloudflare Worker development runtime, Python 3.12, FastAPI, Uvicorn, edge-tts 7.2.8, faster-whisper 1.2.1, FFmpeg, Node test runner, ESLint.

**Spec:** `docs/superpowers/specs/2026-08-30-local-voice-multilingual-psychology-design.md`

## Global Constraints

- Bind all local AI services to `127.0.0.1:8091`, never a LAN interface.
- Use `ru-RU-SvetlanaNeural` as default and `ru-RU-DmitryNeural` as the optional Russian TTS voice.
- The UI must disclose and obtain opt-in before sending a reply text to Edge Neural TTS; do not claim the cloud voice is offline or private to the device.
- Do not save audio recordings. Delete any decoding temporary file in `finally`.
- Limit TTS text to 6,000 characters and microphone capture to 60 seconds / 10 MB.
- Use multilingual Whisper Small on CPU `int8`; Kyrgyz transcription is best effort.
- Preserve deterministic crisis, violence, and urgent medical handling before provider calls.
- Never diagnose, prescribe medication, promise treatment/outcomes, encourage dependency, or replace qualified/emergency care.
- Russian is the only playback language in this release; RU/KG/EN all remain available for typed UI and responses.
- The repository worktree already contains user changes. Do not reset, revert, or commit source changes; only inspect the diff and report it.

---

## File structure

| File | Responsibility |
| --- | --- |
| `local_ai/voice_service.py` | Localhost FastAPI health, TTS, and STT endpoints; validation and temporary-file cleanup. |
| `local_ai/requirements.txt` | Reproducible Python package pins for the companion service. |
| `local_ai/test_voice_service.py` | Pure service validation and mocked HTTP contract tests; no network/model download. |
| `scripts/dev-local-ai.mjs` | Starts and tears down the Python companion and Vinext dev server together. |
| `vite.config.ts` | Proxies `/local-ai/*` to `127.0.0.1:8091` in local development. |
| `lib/client/local-audio.ts` | Browser-facing TTS fetch, `MediaRecorder` capture, abort, validation, and object URL helpers. |
| `app/page.tsx` | Language state, consent, MP3 playback, recorder UI, per-message language, and locale-aware controls. |
| `app/globals.css` | Voice consent, playback, recording, and processing visual states. |
| `worker/index.ts` | Allows same-origin microphone permission while retaining other restrictive permissions. |
| `lib/server/psychology-protocol.ts` | Language validation and localized psychology instructions. |
| `lib/server/openai.ts` | Passes the selected language into shared system instructions. |
| `app/api/chat/route.ts` | Preserves message/response language in safety, persistence, and GET payloads. |
| `tests/local-audio-contract.test.mjs` | Source-level contracts for local-only voice behavior and microphone security policy. |
| `tests/local-dev-auth.test.mjs` | Integration coverage for RU/KG/EN system-language prompts. |
| `tests/rendered-html.test.mjs` | Render/UI contracts for language selectors, RU-only playback, consent, and local recording. |
| `README.md`, `.env.example` | Local AI startup, privacy disclosure, and optional companion configuration documentation. |

## Task 1: Create and validate the localhost AI companion

**Files:**
- Create: `local_ai/voice_service.py`
- Create: `local_ai/requirements.txt`
- Create: `local_ai/test_voice_service.py`

**Interfaces:**
- Produces `GET /health -> {"status":"ok","sttModel":"small","sttLoaded":boolean}`.
- Produces `POST /v1/audio/speech` consuming `{"text":string,"voice":"svetlana"|"dmitry"}` and returning `audio/mpeg`.
- Produces `POST /v1/audio/transcribe` consuming multipart `audio` and optional `language` in `RU|KG|EN`, returning `{"text":string,"language":"RU"|"KG"|"EN"}`.
- Produces `MAX_TTS_CHARS = 6000`, `MAX_AUDIO_BYTES = 10 * 1024 * 1024`, and `MAX_AUDIO_SECONDS = 60` constants for use by tests.

- [ ] **Step 1: Write failing Python contract tests**

```python
# local_ai/test_voice_service.py
import unittest
from voice_service import (
    MAX_AUDIO_BYTES,
    MAX_TTS_CHARS,
    normalize_language,
    validate_speech_request,
)

class VoiceServiceContractTests(unittest.TestCase):
    def test_only_russian_voice_and_bounded_text_are_accepted(self):
        self.assertEqual(
            validate_speech_request("Привет", "svetlana"),
            ("Привет", "ru-RU-SvetlanaNeural"),
        )
        with self.assertRaises(ValueError):
            validate_speech_request("x" * (MAX_TTS_CHARS + 1), "svetlana")
        with self.assertRaises(ValueError):
            validate_speech_request("hello", "unknown")

    def test_language_is_limited_to_ru_kg_en(self):
        self.assertEqual(normalize_language("KG"), "KG")
        self.assertEqual(normalize_language("unsupported"), "RU")
        self.assertGreater(MAX_AUDIO_BYTES, 0)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `py -3.12 -m unittest local_ai/test_voice_service.py -v`

Expected: FAIL because `voice_service` and its functions do not exist.

- [ ] **Step 3: Implement the minimal validated FastAPI service**

```python
# local_ai/voice_service.py (key public boundary)
VOICE_IDS = {
    "svetlana": "ru-RU-SvetlanaNeural",
    "dmitry": "ru-RU-DmitryNeural",
}
MAX_TTS_CHARS = 6_000
MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_AUDIO_SECONDS = 60

def normalize_language(value: object) -> str:
    return value if value in {"RU", "KG", "EN"} else "RU"

def validate_speech_request(text: object, voice: object) -> tuple[str, str]:
    if not isinstance(text, str) or not text.strip() or len(text) > MAX_TTS_CHARS:
        raise ValueError("invalid speech text")
    if voice not in VOICE_IDS:
        raise ValueError("invalid voice")
    return text.strip(), VOICE_IDS[voice]
```

Implement a lazily loaded `WhisperModel("small", device="cpu", compute_type="int8")`. Read an upload only once, reject a payload larger than `MAX_AUDIO_BYTES`, write it to a named temporary `.webm` file, use `ffprobe` to reject duration above `MAX_AUDIO_SECONDS`, transcribe with `vad_filter=True`, and remove the file in a `finally` block. Synthesize with `edge_tts.Communicate(...).stream()` and return only audio chunks as `audio/mpeg`; never write MP3 files. Use `asyncio.wait_for` around TTS to apply a 30-second timeout. Convert `ValueError` to HTTP 422, absent/cold model errors to 503, and provider/decode failures to 502 without leaking audio/text in error details.

Create `local_ai/requirements.txt`:

```text
edge-tts==7.2.8
fastapi==0.115.0
uvicorn==0.30.6
faster-whisper==1.2.1
python-multipart==0.0.12
```

- [ ] **Step 4: Run unit tests and endpoint health check**

Run: `py -3.12 -m unittest local_ai/test_voice_service.py -v`

Expected: PASS.

Run the sidecar in one terminal:

```powershell
py -3.12 -m uvicorn local_ai.voice_service:app --host 127.0.0.1 --port 8091
```

Then in a second terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8091/health
```

Expected: JSON status `ok`, `sttModel` `small`, and no listener outside localhost.

- [ ] **Step 5: Check only task files before proceeding**

Run: `git diff --check -- local_ai/voice_service.py local_ai/requirements.txt local_ai/test_voice_service.py`

Expected: no whitespace errors. Do not commit source changes in the dirty worktree.

## Task 2: Run the companion with local development and unfreeze microphone permission

**Files:**
- Create: `scripts/dev-local-ai.mjs`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `worker/index.ts:74`
- Test: `tests/local-audio-contract.test.mjs`

**Interfaces:**
- Produces `npm run dev` that starts the companion plus Vinext and terminates both on Ctrl+C.
- Produces same-origin development paths `/local-ai/health`, `/local-ai/v1/audio/speech`, and `/local-ai/v1/audio/transcribe` proxied to `127.0.0.1:8091`.
- Produces `Permissions-Policy` with `microphone=(self)` and camera/geolocation/payment disabled.

- [ ] **Step 1: Write a failing Node contract test**

```js
test("local audio is localhost-only and the browser may request its microphone", async () => {
  const [vite, worker, script] = await Promise.all([
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/dev-local-ai.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(vite, /\/local-ai/);
  assert.match(vite, /127\.0\.0\.1:8091/);
  assert.match(worker, /microphone=\(self\)/);
  assert.doesNotMatch(worker, /microphone=\(\)/);
  assert.match(script, /127\.0\.0\.1/);
  assert.match(script, /SIGINT/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test --test-name-pattern="local audio is localhost-only" tests/local-audio-contract.test.mjs`

Expected: FAIL because the test file, proxy, and launcher do not exist and the current worker denies microphone permission.

- [ ] **Step 3: Implement the launcher, proxy, and policy**

Use `node:child_process.spawn` in `scripts/dev-local-ai.mjs` to launch:

```js
const python = process.env.ADEMI_PYTHON ?? "py";
const pythonArgs = process.env.ADEMI_PYTHON
  ? ["-m", "uvicorn", "local_ai.voice_service:app", "--host", "127.0.0.1", "--port", "8091"]
  : ["-3.12", "-m", "uvicorn", "local_ai.voice_service:app", "--host", "127.0.0.1", "--port", "8091"];
```

Start Vinext as the second child, forward `SIGINT`, `SIGTERM`, and child failure to a single cleanup function, and use `process.platform === "win32" ? "npm.cmd" : "npm"` for the Node child executable. Update `package.json` to make `dev` run `node scripts/dev-local-ai.mjs` and add a `dev:app` script containing the former `vinext dev` command for tests/troubleshooting.

In `vite.config.ts`, merge the existing conditional `server` object with:

```ts
proxy: {
  "/local-ai": {
    target: "http://127.0.0.1:8091",
    changeOrigin: false,
    rewrite: (path) => path.replace(/^\/local-ai/, ""),
  },
},
```

In `worker/index.ts`, change only `microphone=()` to `microphone=(self)`; keep camera, geolocation, and payment disabled.

- [ ] **Step 4: Run the contract test and smoke the proxy**

Run: `node --test --test-name-pattern="local audio is localhost-only" tests/local-audio-contract.test.mjs`

Expected: PASS.

Run: `npm run dev`, wait for both local services to report readiness, then:

```powershell
Invoke-RestMethod http://localhost:3000/local-ai/health
```

Expected: the same health JSON as direct port 8091, proving browser calls remain same-origin.

- [ ] **Step 5: Check task files before proceeding**

Run: `git diff --check -- scripts/dev-local-ai.mjs package.json vite.config.ts worker/index.ts tests/local-audio-contract.test.mjs`

Expected: no whitespace errors; do not commit source changes.

## Task 3: Restore three-language server behavior and strengthen the psychology protocol

**Files:**
- Modify: `lib/server/psychology-protocol.ts`
- Modify: `lib/server/openai.ts:180-209`
- Modify: `app/api/chat/route.ts:84-86, 360-375, 405-450`
- Modify: `tests/local-dev-auth.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces `normalizePsychologyLanguage(value: unknown, fallback: Language): Language`.
- Produces `createPsychologyInstructions(language: Language): string` with `Respond in Russian`, `Respond in Kyrgyz`, or `Respond in English` locale instructions.
- Makes POST `/api/chat` return a `language: Language` property; makes saved-conversation GET message rows return `language`.

- [ ] **Step 1: Write failing integration assertions for EN/KG prompts and response language**

In `tests/local-dev-auth.test.mjs`, replace the Russian-only assertion for an `EN` payload with:

```js
assert.match(ollamaChatBodies.at(-1)?.messages?.[0]?.content ?? "", /Respond in English/i);
```

Add a `KG` API POST and assert:

```js
assert.match(ollamaChatBodies.at(-1)?.messages?.[0]?.content ?? "", /Respond in Kyrgyz/i);
```

Add `assert.equal(responseBody.language, "EN")` to the API response test. In `tests/rendered-html.test.mjs`, assert `createPsychologyInstructions(language)` and reject a hard-coded `ACTIVE_PSYCHOLOGY_LANGUAGE` response lock.

- [ ] **Step 2: Run the focused integration test to verify it fails**

Run: `node --test tests/local-dev-auth.test.mjs`

Expected: FAIL because EN/KG are currently normalized to Russian and the chat response lacks `language`.

- [ ] **Step 3: Implement locale validation, localized instructions, and message payload language**

Replace the Russian-only normalizer with:

```ts
export const SUPPORTED_PSYCHOLOGY_LANGUAGES = ["RU", "KG", "EN"] as const;

export function normalizePsychologyLanguage(
  value: unknown,
  fallback: Language = "RU",
): Language {
  return SUPPORTED_PSYCHOLOGY_LANGUAGES.includes(value as Language)
    ? (value as Language)
    : fallback;
}
```

Implement `createPsychologyInstructions(language)` with a `Record<Language, string>` language directive and the six-step protocol from the spec. Preserve all existing course evidence, abuse, prompt-injection, medical, and emergency boundaries in `openai.ts`; call `baseInstructions(language)` from `createAssistantInstructions(language, context)` so Ollama and OpenAI receive identical instructions.

In `app/api/chat/route.ts`, pass `user.preferredLanguage` as fallback to the normalizer, include `language` in each normal and safety JSON response, and select `messages.language` in saved-conversation GET rows. Do not alter crisis precedence, quota order, or persistence ownership checks.

- [ ] **Step 4: Run the focused and existing psychology tests**

Run:

```powershell
node --test tests/local-dev-auth.test.mjs
node --test tests/psychology-guided.test.mjs
```

Expected: both pass; EN and KG prompts receive their respective language directives, while all existing guided safety tests remain green.

- [ ] **Step 5: Check task files before proceeding**

Run: `git diff --check -- lib/server/psychology-protocol.ts lib/server/openai.ts app/api/chat/route.ts tests/local-dev-auth.test.mjs tests/rendered-html.test.mjs`

Expected: no whitespace errors; do not commit source changes.

## Task 4: Replace browser speech APIs with local audio client primitives

**Files:**
- Create: `lib/client/local-audio.ts`
- Delete: `lib/client/web-speech.ts`
- Modify: `tests/local-audio-contract.test.mjs`

**Interfaces:**
- Produces `type RussianVoice = "svetlana" | "dmitry"`.
- Produces `synthesizeRussianSpeech(text: string, voice: RussianVoice, signal?: AbortSignal): Promise<Blob>`.
- Produces `type LocalAudioLanguage = "RU" | "KG" | "EN"` and `transcribeRecording(blob: Blob, language: LocalAudioLanguage, signal?: AbortSignal): Promise<string>`.
- Produces `startAudioRecording(): Promise<{ recorder: MediaRecorder; stream: MediaStream; stop: () => void }>`.

- [ ] **Step 1: Write failing local audio client contract assertions**

Append to `tests/local-audio-contract.test.mjs`:

```js
test("client uses the local neural-audio endpoints instead of browser speech APIs", async () => {
  const source = await readFile(new URL("../lib/client/local-audio.ts", import.meta.url), "utf8");
  assert.match(source, /\/local-ai\/v1\/audio\/speech/);
  assert.match(source, /\/local-ai\/v1\/audio\/transcribe/);
  assert.match(source, /MediaRecorder/);
  assert.match(source, /getUserMedia/);
  assert.doesNotMatch(source, /speechSynthesis|SpeechRecognition|webkitSpeechRecognition/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test --test-name-pattern="client uses the local neural-audio" tests/local-audio-contract.test.mjs`

Expected: FAIL because `local-audio.ts` does not exist.

- [ ] **Step 3: Implement minimal browser audio primitives**

`local-audio.ts` must:

```ts
export async function synthesizeRussianSpeech(
  text: string,
  voice: RussianVoice,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch("/local-ai/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
    signal,
  });
  if (!response.ok) throw new Error("local_voice_unavailable");
  return response.blob();
}
```

Validate `navigator.mediaDevices?.getUserMedia` and `window.MediaRecorder`, request `{ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }`, choose `audio/webm;codecs=opus` only when supported, accumulate chunks in memory, stop all `MediaStreamTrack`s in `stop`, and return a Blob. `transcribeRecording` must construct `FormData` with `audio` and selected `language`, reject a non-OK response as `local_transcription_unavailable`, and return only trimmed `text`. No browser speech synthesis/recognition API may remain.

- [ ] **Step 4: Run the client contract test**

Run: `node --test --test-name-pattern="client uses the local neural-audio" tests/local-audio-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Check task files before proceeding**

Run: `git diff --check -- lib/client/local-audio.ts lib/client/web-speech.ts tests/local-audio-contract.test.mjs`

Expected: no whitespace errors; do not commit source changes.

## Task 5: Integrate voice, recorder, consent, and multilingual controls in the UI

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- `Message` gains `language?: Language`.
- UI persists `language` and `profileLanguage` state as `Language` values.
- Playback only renders when `item.role === "ai" && item.language === "RU"`.
- Voice consent key is `ademi-edge-voice-consent-v1` in localStorage.

- [ ] **Step 1: Write failing rendered UI checks**

Replace the prior Russian-only voice test with assertions for:

```js
assert.match(page, /useState<Language>\("RU"\)/);
assert.match(page, /changeLanguage\(nextLanguage: Language\)/);
assert.match(page, /language:\s*language/);
assert.match(page, /item\.language === "RU"/);
assert.match(page, /ademi-edge-voice-consent-v1/);
assert.match(page, /synthesizeRussianSpeech/);
assert.match(page, /startAudioRecording/);
assert.doesNotMatch(page, /speechSynthesis|SpeechRecognition|webkitSpeechRecognition/);
```

Add CSS assertions for `.voice-consent`, `.recording`, and `.voice-button`.

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test --test-name-pattern="Russian chat exposes accessible native voice controls" tests/rendered-html.test.mjs`

Expected: FAIL because current UI is hard-coded RU and still uses browser speech APIs.

- [ ] **Step 3: Implement language state and message language propagation**

Restore `const [language, setLanguage] = useState<Language>("RU")` and `const [profileLanguage, setProfileLanguage] = useState<Language>("RU")`. Restore valid preference loading from `/api/me`, document locale assignment (`ky`, `en`, or `ru`), and a `changeLanguage(nextLanguage)` function that stops active playback/recording, clears current conversation, updates both state values, then PATCHes `/api/me` for authenticated users.

Restore interactive RU/KG/EN selectors in entry, top bar, consent, profile, and onboarding UI. Send `language` in POST `/api/chat`; append it to both optimistic user messages and returned AI messages. Map stored GET messages from their returned `language`. Preserve profile save behavior with `profileLanguage`.

- [ ] **Step 4: Implement neural MP3 playback and explicit privacy consent**

Replace current `SpeechSynthesisUtterance` code with an `HTMLAudioElement`/object-URL flow using `synthesizeRussianSpeech`. On first playback, show a Russian consent surface explaining that only the selected assistant reply text is sent to Microsoft Edge Neural TTS, then store affirmative consent under `ademi-edge-voice-consent-v1`; cancellation makes no request. Include a voice picker for `Светлана` and `Дмитрий`, defaulting to `Светлана` in localStorage.

Use an `AbortController`, a `playingMessageKey` state, `audio.onended`, `audio.onerror`, visibility cleanup, URL revocation, and a stop button. Enforce playback rendering only for a Russian assistant message. Convert sidecar failures to a Russian message that says the local voice service is unavailable; never invoke browser TTS as fallback.

- [ ] **Step 5: Implement local microphone flow**

Replace `SpeechRecognition` with `MediaRecorder` state:

```ts
type RecordingState = "idle" | "recording" | "processing";
```

Start recording on microphone click, show a stop state and a countdown to 60 seconds, abort automatically at the limit, then call `transcribeRecording(blob, language)`. Append the returned text to the existing composer value with one separating space; never auto-send it. Always stop tracks and clear Blob references on stop, error, language change, new chat, conversation open, visibility change, and unmount. Display distinct Russian errors for denied permission, absent local sidecar, over-limit recording, and transcription failure.

- [ ] **Step 6: Add black-and-gold responsive visual states**

Style `.voice-button`, `.voice-consent`, `.voice-picker`, `.microphone-button.recording`, and `.microphone-button.processing` using existing `--forest`, `--forest-2`, `--surface`, and `--line` tokens. Ensure controls fit the 320px layout, have visible keyboard focus, and show no English/Kyrgyz playback button.

- [ ] **Step 7: Run the targeted UI test**

Run: `node --test --test-name-pattern="Russian chat exposes accessible native voice controls" tests/rendered-html.test.mjs`

Expected: PASS, with no browser speech APIs present in the page source.

- [ ] **Step 8: Check task files before proceeding**

Run: `git diff --check -- app/page.tsx app/globals.css tests/rendered-html.test.mjs`

Expected: no whitespace errors; do not commit source changes.

## Task 6: Document, verify, and manually exercise the full local flow

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `tests/local-audio-contract.test.mjs`

**Interfaces:**
- Documents `npm run dev` as the local companion launcher and `npm run dev:app` as an app-only fallback.
- Documents that Edge Neural TTS requires network and sends reply text to Microsoft only after user consent.

- [ ] **Step 1: Write a failing documentation/security assertion**

```js
test("local voice documentation discloses its privacy boundary", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /Edge Neural TTS/i);
  assert.match(readme, /Microsoft/i);
  assert.match(readme, /Whisper/i);
  assert.match(readme, /not saved|не сохраняется/i);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test --test-name-pattern="local voice documentation" tests/local-audio-contract.test.mjs`

Expected: FAIL because local companion/privacy documentation is absent.

- [ ] **Step 3: Document installation, health, privacy, and recovery**

Add a `Local voice and microphone` README section with exact commands:

```powershell
py -3.12 -m pip install -r local_ai/requirements.txt
npm run dev
Invoke-RestMethod http://localhost:3000/local-ai/health
```

State that Edge Neural TTS is online/no-key, receives selected reply text only after consent, and is not an offline privacy guarantee. State that microphone audio is processed by local Whisper, deleted immediately after transcription, and still needs browser microphone permission. Add optional `ADEMI_PYTHON` and `ADEMI_LOCAL_AI_URL` documentation to `.env.example` only if they are actually consumed by implementation.

- [ ] **Step 4: Run final automated verification**

Run:

```powershell
npm run lint
npm run build
npm test
py -3.12 -m unittest local_ai/test_voice_service.py -v
```

Expected: all commands exit 0.

- [ ] **Step 5: Run local functional smoke tests**

With `npm run dev` running:

```powershell
$voice = Invoke-WebRequest -Method Post -Uri http://localhost:3000/local-ai/v1/audio/speech `
  -ContentType 'application/json' `
  -Body '{"text":"Это проверка русского нейроголоса.","voice":"svetlana"}'
"CONTENT_TYPE=$($voice.Headers['Content-Type'])"
"AUDIO_BYTES=$($voice.Content.Length)"
```

Expected: `audio/mpeg` and nonzero audio bytes. Then manually verify: consent before first play, Russian response playback, stop button, RU/KG/EN text replies, microphone permission prompt, 60-second stop, local transcription insertion without auto-send, and Russian crisis response safety.

- [ ] **Step 6: Review final diff without committing user work**

Run: `git status --short` and `git diff --check`.

Expected: only intended additions/modifications from this work plus pre-existing user changes; no source commit is created in the dirty worktree.
