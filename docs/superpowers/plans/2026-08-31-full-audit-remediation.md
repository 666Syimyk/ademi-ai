# ADEMI MIND Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Resolve the audited P0/P1 defects that prevent ADEMI MIND from being a dependable psychology-focused assistant, and leave a verified, candid release audit.

**Architecture:** Keep the existing Vinext/Workers app, Ollama provider abstraction, and local Python audio sidecar. Bound local generation at the provider adapter, choose guided psychology output at the API route whenever the provider cannot respond in time, and expose a runtime audio capability so the client never advertises local-only controls on a hosted worker. Keep privacy and consent decisions local to the client account and document the external Edge TTS boundary.

**Tech Stack:** React 19, TypeScript, Vinext/Vite, Cloudflare Workers, Drizzle, Ollama, Python/FastAPI, Edge Neural TTS, faster-whisper, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-full-audit-remediation-design.md`

## Global constraints

- Preserve pre-existing dirty-worktree changes and do not commit.
- Use test-driven development: add or change a behavioural test, observe it fail, then implement the smallest fix.
- Do not expose a local sidecar through a public deployment or collect new user data.
- Do not assert that ADEMI MIND is universally better than Gemini.

### Task 1: Make the project type-safe

**Files:**
- Modify: `app/api/chat/route.ts`
- Modify: `vite.config.ts`

1. Use the failing `npx tsc --noEmit` baseline as the red check.
2. Narrow the selected generative provider before calling it and type the Vite proxy rewrite parameter.
3. Run `npx tsc --noEmit`; expect zero errors.

### Task 2: Bound local-model latency and return safe fallback

**Files:**
- Modify: `lib/server/ollama.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `tests/local-dev-auth.test.mjs`

1. Extend the mock Ollama server so a deliberately slow response is possible.
2. Write a failing integration assertion that a delayed model request returns a 200 guided answer inside a test-controlled short timeout and reports no active provider.
3. Add a bounded token budget, configurable safe timeout, timeout error classification, availability invalidation, and guided fallback for local-provider failures only.
4. Keep crisis and medical safety paths provider-free.
5. Re-run the integration test and a live request against the real local model.

### Task 3: Correct audio security, capability and consent

**Files:**
- Modify: `worker/index.ts`
- Modify: `app/api/me/route.ts`
- Modify: `lib/server/runtime.ts`
- Modify: `app/page.tsx`
- Modify: `tests/rendered-html.test.mjs`

1. Add failing checks for the explicit blob media CSP and local audio capability.
2. Add `media-src 'self' blob:` to Worker CSP.
3. Surface whether the local sidecar proxy is expected to exist; do not show playback/mic controls in a hosted worker where it cannot work.
4. Scope voice approval to the signed-in account, add profile withdrawal, stop active playback when withdrawn, and localise dialogue/copy for RU/KG/EN.
5. Make transcription processing cancellable from the existing microphone control.
6. Run relevant rendered/integration tests and TypeScript.

### Task 4: Make voice processing transparent and diagnosable

**Files:**
- Modify: `local_ai/voice_service.py`
- Modify: `local_ai/test_voice_service.py`
- Modify: `local_ai/requirements.txt` or `README.md`
- Modify: `scripts/dev-local-ai.mjs`

1. Add a failing Python health test for decoder readiness.
2. Report `ffprobe` availability and clear client-facing health state; document installation prerequisite.
3. Ensure a failed audio sidecar does not unnecessarily conceal the web-app startup failure reason.
4. Run Python tests and a live health check.

### Task 5: Fix copy and legal disclosures

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/privacy/page.tsx`
- Modify: `tests/rendered-html.test.mjs`

1. Add failing rendered-content checks for truthful multilingual support, Edge TTS disclosure, local microphone handling, and consent withdrawal.
2. Correct the Russian sign-in copy and preserve language query parameters for in-app legal links.
3. Add complete RU/KG/EN privacy wording without pretending Edge TTS is local.
4. Run tests and inspect rendered HTML.

### Task 6: Update safe development tooling

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

1. Record a baseline `npm audit --json`.
2. Upgrade direct compatible Vite/Vinext/Cloudflare/Wrangler versions only; avoid the unsafe Drizzle Kit downgrade.
3. Run install, lint, build, test, and audit again. Revert only the specific dependency update if compatibility fails; preserve unrelated work.

### Task 7: Final verification and handoff

1. Run `git diff --check`, `npx tsc --noEmit`, `npm run lint`, `npm test`, Python tests, dependency scans, live local health/voice/chat probes.
2. Review exact changed files and test results.
3. State the remaining externally blocked work: browser screenshot audit and deployed HTTPS audio sidecar.
4. Compare ADEMI MIND and Gemini honestly by specialty, using official sources for current Gemini facts.

