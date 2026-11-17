import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(script, /process\.execPath/);
  assert.match(script, /vinext\/dist\/cli\.js/);
});

test("a failed local voice sidecar leaves the web app running with a clear reason", async () => {
  const script = await readFile(
    new URL("../scripts/dev-local-ai.mjs", import.meta.url),
    "utf8",
  );

  assert.match(script, /function reportSidecarFailure/);
  assert.match(
    script,
    /The web app will continue without voice input or playback\./,
  );
  assert.match(script, /sidecar\.once\("error", \(error\) => reportSidecarFailure/);
  assert.match(script, /sidecar\.once\("exit", handleSidecarExit\)/);
  assert.match(script, /app\.once\("error", \(error\) => handleApplicationFailure/);
  assert.match(script, /app\.once\("exit", handleApplicationExit\)/);
  assert.doesNotMatch(script, /for \(const \[name, child\] of/);
});

test("the client distinguishes an unavailable sidecar from a missing decoder", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /decoderAvailable/);
  assert.match(page, /localVoiceAvailable/);
  assert.match(page, /localMicrophoneAvailable/);
  assert.match(page, /audioHealth\.decoderUnavailable/);
  assert.match(page, /audioHealth\.localServiceUnavailable/);
});

test("client uses the local neural-audio endpoints instead of browser speech APIs", async () => {
  const source = await readFile(
    new URL("../lib/client/local-audio.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /\/local-ai\/v1\/audio\/speech/);
  assert.match(source, /\/local-ai\/v1\/audio\/transcribe/);
  assert.match(source, /MediaRecorder/);
  assert.match(source, /getUserMedia/);
  assert.doesNotMatch(
    source,
    /speechSynthesis|SpeechRecognition|webkitSpeechRecognition/,
  );
});

test("local voice documentation discloses its privacy boundary", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.match(readme, /Edge Neural TTS/i);
  assert.match(readme, /Microsoft/i);
  assert.match(readme, /Whisper/i);
  assert.match(readme, /ffprobe/i);
  assert.match(readme, /decoderAvailable/);
  assert.match(readme, /not saved|не сохраняется/i);
});
