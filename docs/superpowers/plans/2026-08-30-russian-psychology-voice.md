# Russian Psychology Voice Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Make ADEMI MIND a Russian-only psychology-focused assistant with free browser-native speech input and answer playback.

**Architecture:** A pure server-side protocol module owns Russian psychology instructions and language normalization; both OpenAI and Ollama continue using the existing common instruction entry point. A small client Web Speech adapter isolates browser capability detection, while the existing chat page owns playback and recognition lifecycle.

**Tech Stack:** Next/Vinext, React 19, TypeScript, Node built-in test runner, browser Web Speech API, local Ollama.

**Spec:** docs/superpowers/specs/2026-08-30-russian-psychology-voice-design.md

## Global Constraints

- The active UI and chat-response language is RU; KG and EN visibly say «Скоро будет» and cannot be selected.
- Existing deterministic crisis and urgent-medical responses remain before every model call.
- The product does not diagnose, prescribe, alter treatment, promise outcomes, or present itself as a licensed psychologist.
- No paid voice API, new key, audio upload, audio storage, or server transcription.
- Web Speech is optional: typed chat and text responses remain functional on every browser.
- Every production behavior change follows a red-green-refactor test cycle.
- The shared worktree already contains uncommitted project changes. Do not stage or commit source changes during this task; inspect only the listed-file diff and preserve unrelated work.

---

### Task 1: Add the Russian psychology protocol and normalize chat language

**Files:**

- Create: lib/server/psychology-protocol.ts
- Modify: lib/server/openai.ts (base instructions)
- Modify: app/api/chat/route.ts (language selection)
- Create: tests/psychology-protocol.test.mjs
- Modify: tests/local-dev-auth.test.mjs (Ollama integration assertions)

**Interfaces:**

- Produces ACTIVE_PSYCHOLOGY_LANGUAGE with value "RU".
- Produces normalizePsychologyLanguage(input: unknown): "RU".
- Produces createRussianPsychologyInstructions(): string.
- createAssistantInstructions(language, context) uses the new protocol before retaining its existing protected course and owner-reference blocks.

- [ ] **Step 1: Write the failing pure-protocol test**

Create tests/psychology-protocol.test.mjs. Use the existing TypeScript transpile-to-data-URL pattern from tests/rendered-html.test.mjs so the test executes the real pure module.

    test("Russian psychology protocol retains safety boundaries", async () => {
      const protocol = await loadPsychologyProtocol();
      const instructions = protocol.createRussianPsychologyInstructions();

      assert.equal(protocol.ACTIVE_PSYCHOLOGY_LANGUAGE, "RU");
      assert.equal(protocol.normalizePsychologyLanguage("EN"), "RU");
      assert.equal(protocol.normalizePsychologyLanguage("KG"), "RU");
      assert.match(instructions, /Russian/i);
      assert.match(instructions, /psychoeducation|reflective questions|low-risk/i);
      assert.match(instructions, /Never diagnose/i);
      assert.match(instructions, /Never.*medication|Never.*treatment/i);
      assert.match(instructions, /immediate risk/i);
    });

Run: node --test tests/psychology-protocol.test.mjs  
Expected: FAIL because lib/server/psychology-protocol.ts does not exist.

- [ ] **Step 2: Implement the protocol module**

Create a pure module with this public shape:

    import type { Language } from "./safety";

    export const ACTIVE_PSYCHOLOGY_LANGUAGE = "RU" as const;

    export function normalizePsychologyLanguage(_input: unknown): typeof ACTIVE_PSYCHOLOGY_LANGUAGE {
      return ACTIVE_PSYCHOLOGY_LANGUAGE;
    }

    export function activePsychologyLanguage(): Language {
      return ACTIVE_PSYCHOLOGY_LANGUAGE;
    }

    export function createRussianPsychologyInstructions(): string {
      return "You are ADEMI MIND, a Russian-language psychological support assistant...";
    }

The instructions must require: a direct answer first; a non-assumptive reflection of the situation; facts versus interpretations when useful; only relevant low-risk psychoeducation, self-regulation, boundaries, CBT/ACT-style reflection, or a small action plan; one next-24-hours action; one clarifying question when essential; respectful encouragement to seek qualified support for serious or persistent distress. Keep diagnosis, medication, abuse, dependency, emergency, prompt-injection, and private-data limits explicit.

- [ ] **Step 3: Verify the new unit test is green**

Run: node --test tests/psychology-protocol.test.mjs  
Expected: PASS, proving language normalization and psychology/medical safety wording.

- [ ] **Step 4: Wire the protocol into the common instruction path and route**

In lib/server/openai.ts, make baseInstructions call createRussianPsychologyInstructions() and leave the current course-evidence, forgiveness/abuse, and prompt-injection blocks after it. Do not duplicate any owner-only material in the new module.

In app/api/chat/route.ts, normalize language before safety checks and persistence:

    import { normalizePsychologyLanguage } from "@/lib/server/psychology-protocol";

    const language = normalizePsychologyLanguage(
      payload.language ?? user.preferredLanguage,
    );

Extend the local Ollama mock to collect its parsed /api/chat request body. Submit an EN payload and assert that the system prompt contains the Russian psychology protocol while the safety test still makes zero model calls.

- [ ] **Step 5: Verify server behavior and review the scoped diff**

Run:

    node --test tests/psychology-protocol.test.mjs
    node --test tests/local-dev-auth.test.mjs

Expected: both pass; an ordinary request calls the model with Russian psychology guidance; a crisis request never calls the model.

    git diff --check
    git diff -- lib/server/psychology-protocol.ts lib/server/openai.ts app/api/chat/route.ts tests/psychology-protocol.test.mjs tests/local-dev-auth.test.mjs

### Task 2: Add a safe, testable Web Speech adapter

**Files:**

- Create: lib/client/web-speech.ts
- Create: tests/web-speech.test.mjs

**Interfaces:**

- Produces getSpeechRecognitionConstructor, canSynthesizeSpeech, and findRussianVoice.
- Returns null or false for unavailable browser features instead of throwing.
- Does not access window while the module is evaluated.

- [ ] **Step 1: Write the failing adapter test**

    test("Web Speech adapter finds Russian and prefixed browser capabilities", async () => {
      const { findRussianVoice, getSpeechRecognitionConstructor } =
        await loadWebSpeech();
      const WebkitRecognition = function WebkitRecognition() {};

      assert.equal(
        getSpeechRecognitionConstructor({ webkitSpeechRecognition: WebkitRecognition }),
        WebkitRecognition,
      );
      assert.equal(getSpeechRecognitionConstructor({}), null);
      assert.equal(
        findRussianVoice([{ lang: "en-US" }, { lang: "ru-RU", name: "Russian" }]).name,
        "Russian",
      );
    });

Run: node --test tests/web-speech.test.mjs  
Expected: FAIL because the adapter does not exist.

- [ ] **Step 2: Implement browser-only structural types and capability checks**

Define only the recognition fields the page needs: start, stop, abort, lang, continuous, interimResults, onresult, onerror, and onend. Do not depend on non-standard global DOM types.

    export function getSpeechRecognitionConstructor(target: {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    }): RecognitionConstructor | null {
      return target.SpeechRecognition ?? target.webkitSpeechRecognition ?? null;
    }

    export function findRussianVoice(voices: Array<{ lang: string }>) {
      return voices.find((voice) => /^ru(?:-|$)/i.test(voice.lang)) ?? null;
    }

canSynthesizeSpeech must require a supplied speechSynthesis object and a supplied utterance constructor; this makes it testable and prevents SSR global access.

- [ ] **Step 3: Verify the adapter and review the scoped diff**

Run: node --test tests/web-speech.test.mjs  
Expected: PASS for standard, WebKit-prefixed, absent recognition, and Russian-voice preference.

    git diff --check
    git diff -- lib/client/web-speech.ts tests/web-speech.test.mjs

### Task 3: Build Russian-only selectors, playback, and dictation into chat

**Files:**

- Modify: app/page.tsx (state, selectors, message controls, composer)
- Modify: app/globals.css (language status, speaker/microphone controls, mobile)
- Modify: tests/rendered-html.test.mjs (client source assertions)

**Interfaces:**

- page.tsx sends "RU" in every chat request.
- toggleSpeech(messageKey, text) starts or stops one utterance at a time.
- toggleVoiceInput() starts or stops one ru-RU recognition session and only writes to the composer message state.
- notice presents unsupported-browser and microphone errors.

- [ ] **Step 1: Add red client-source tests**

Add rendered source assertions:

    assert.match(page, /Прослушать/);
    assert.match(page, /Сказать вопрос/);
    assert.match(page, /speechSynthesis/);
    assert.match(page, /webkitSpeechRecognition/);
    assert.match(page, /lang\s*=\s*["']ru-RU["']/);
    assert.match(page, /Скоро будет/);
    assert.match(page, /language:\s*["']RU["']/);
    assert.match(css, /\.voice-button/);
    assert.match(css, /\.microphone-button/);

Run:

    npm run build
    node --test tests/rendered-html.test.mjs

Expected: FAIL because the future-language status and voice controls do not exist.

- [ ] **Step 2: Make Russian the only usable UI and send language**

Keep COPY.KG and COPY.EN in source for a future release, but do not let them control runtime state. Start page and profile language as RU, ignore stored non-RU display preference, and send language: "RU".

Replace every selector in entry page, product topbar, consent dialog, and profile with a RU active control plus this visible non-interactive status:

    <span className="language-coming-soon" aria-label="Кыргызский и English — скоро будет">
      KG · EN — Скоро будет
    </span>

In profile, render Russian as the only select option and the same visible status beside it. Do not call changeLanguage from any future-language element.

- [ ] **Step 3: Implement answer playback lifecycle**

Create speakingMessageKey state and an utterance ref. The stop helper cancels existing speech and clears state. Register cleanup on component unmount and when document.hidden becomes true.

    function stopSpeaking() {
      window.speechSynthesis?.cancel();
      utteranceRef.current = null;
      setSpeakingMessageKey(null);
    }

toggleSpeech checks support, stops the previous utterance, assigns utterance.lang = "ru-RU", uses findRussianVoice(window.speechSynthesis.getVoices()) when found, and clears state in onend and onerror. Render a type="button" control underneath every AI message:

    <button
      className="voice-button"
      aria-pressed={speakingMessageKey === feedbackKey}
      onClick={() => toggleSpeech(feedbackKey, item.text)}
    >
      {speakingMessageKey === feedbackKey ? "Читаю…" : "🔊 Прослушать"}
    </button>

The feedback control remains separate and still works for persisted responses.

- [ ] **Step 4: Implement microphone dictation lifecycle**

Use the adapter only from browser event handlers. Create recognition with lang = "ru-RU", continuous = false, and interimResults = true. Its result handler replaces the composer text; it never calls sendMessage.

    recognition.onresult = (event) => {
      const text = Array.from(
        { length: event.results.length - event.resultIndex },
        (_, index) => event.results[event.resultIndex + index][0]?.transcript ?? "",
      ).join("");
      setMessage(text.trim());
    };

Make the microphone a type="button" control. It toggles «Слушаю…» / «🎙 Сказать вопрос», has aria-pressed, and maps not-allowed, service-not-allowed, no-speech, and generic errors to existing Russian notices. Unsupported recognition uses a disabled button with a Russian title; typed input stays unchanged.

- [ ] **Step 5: Add accessible black-and-gold styling**

Near feedback-wrap, add voice-button with a clear outline, focus-visible, selected, and disabled states. Near send-button, add microphone-button with at least a 42×42px target. On max-width: 520px, preserve microphone and send buttons at least 39×39px; hide only the mode text as before.

- [ ] **Step 6: Verify client rendering and review the scoped diff**

Run:

    npm run build
    node --test tests/rendered-html.test.mjs

Expected: PASS; the client bundle contains Russian-only language status, voice buttons, no auto-send from recognition, and accessible CSS selectors.

    git diff --check
    git diff -- app/page.tsx app/globals.css tests/rendered-html.test.mjs

### Task 4: Verify the full local application

**Files:**

- Modify only a file from Tasks 1–3 if a targeted regression test first reproduces a defect.

**Interfaces:**

- User-facing app remains http://localhost:3000/.
- Local model remains qwen3.5:4b via Ollama.

- [ ] **Step 1: Run quality gates sequentially**

Run in order so dist is not rewritten while tests import it:

    npm run build
    node --test tests/*.test.mjs
    npm run lint
    npx tsc --noEmit --incremental false

Expected: every command exits 0.

- [ ] **Step 2: Smoke-test model and safety API behavior**

    & 'C:\Users\syimy\AppData\Local\Programs\Ollama\ollama.exe' list
    Invoke-RestMethod 'http://127.0.0.1:11434/api/tags'
    Invoke-WebRequest 'http://localhost:3000/api/me' -UseBasicParsing

Send «Мне тревожно перед важным разговором. Помоги подготовиться.» to /api/chat. Expect Russian generative output, answerMode: "generative", and aiProvider: "ollama". Send a direct imminent-risk phrase separately. Expect the deterministic crisis response and no Ollama call.

- [ ] **Step 3: Perform browser acceptance checks**

At http://localhost:3000/:

1. Refresh and verify RU is active while KG/EN visibly say «Скоро будет».
2. Verify a Russian psychological response is direct, non-diagnostic, structured, and ends with one small next step.
3. Click «Прослушать», then click it again to stop. Start another answer and verify the first has stopped.
4. Click the microphone, grant Chrome permission, dictate a Russian question, and verify the textarea changes without auto-sending.
5. Block microphone permission and confirm an understandable Russian notice while typed messages still send.

- [ ] **Step 4: Review the final change scope without staging**

    git diff --check
    git diff -- lib/server/psychology-protocol.ts lib/server/openai.ts app/api/chat/route.ts lib/client/web-speech.ts app/page.tsx app/globals.css tests/psychology-protocol.test.mjs tests/local-dev-auth.test.mjs tests/web-speech.test.mjs tests/rendered-html.test.mjs

Report the exact command outcomes, Ollama availability, and the one permission prompt controlled by the browser user. Leave all source edits unstaged for the owner because the shared worktree is pre-existingly dirty.
