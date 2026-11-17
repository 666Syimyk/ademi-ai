# Public Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver ADEMI MIND as a deployable Cloudflare public site with Supabase email authentication, fast cloud chat, production-capable voice controls, and verified user flows.

**Architecture:** Replace injected ChatGPT identity with a Supabase token adapter while preserving the app's D1 user model. Keep AI and transcription server-side behind Worker secrets. Split the large client page only when required to introduce focused auth and voice components.

**Tech Stack:** TypeScript, React 19, Vinext, Cloudflare Workers/D1/R2, Supabase Auth REST/JWT, OpenAI API, browser Web Speech/Web Audio, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-04-public-launch-design.md`

## Global Constraints

- Preserve unrelated uncommitted work and stage only files each task changes.
- No service-role key or OpenAI key in client source, `.env.example` values, rendered HTML, or logs.
- Keep crisis handling before generative AI and retain guided fallbacks.
- Payment remains visibly disabled and cannot grant access.
- Tests are written and observed failing before implementation.

---

### Task 1: Supabase configuration and verified server identity

**Files:** Modify `lib/server/runtime.ts`, `app/chatgpt-auth.ts`, `lib/server/auth.ts`, `worker/index.ts`; create `lib/server/supabase-auth.ts`, `tests/supabase-auth.test.mjs`.

**Produces:** `getAuthenticatedIdentity(requestHeaders)` returning `{ userId, email, fullName } | null`; development identity remains available only for localhost.

- [ ] Write a failing test asserting a missing/bad bearer token returns null, a valid mocked Supabase user maps to its immutable ID, and local headers are ignored in production.
- [ ] Run `node --test tests/supabase-auth.test.mjs`; expect failure because no adapter exists.
- [ ] Add runtime bindings `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optional server key; implement the adapter using Supabase `/auth/v1/user` with the presented bearer token and bounded timeout.
- [ ] Update auth callers to use the adapter and update Worker CSP `connect-src` to the configured Supabase origin without broad wildcards.
- [ ] Re-run focused test and commit task files.

### Task 2: Public account screens and password recovery

**Files:** Create `app/auth/page.tsx`, `app/auth/reset-password/page.tsx`, `lib/client/supabase-auth.ts`; modify `app/page.tsx`, `app/globals.css`; create `tests/auth-rendering.test.mjs`.

**Produces:** registration, sign-in, sign-out, reset-email request, and reset-password completion using Supabase browser client.

- [ ] Write failing rendering tests for email/password controls, accessible validation text, loading-disabled submit controls, and reset-link route.
- [ ] Run `node --test tests/auth-rendering.test.mjs`; expect missing-page failure.
- [ ] Implement localized auth forms: `signUp`, `signInWithPassword`, `resetPasswordForEmail`, `updateUser`, `signOut`; use the current origin plus `/auth/reset-password` as redirect target.
- [ ] Replace ChatGPT sign-in links with `/auth`, preserve intended return path, and show unauthenticated chat visitors an auth call-to-action.
- [ ] Re-run focused tests and commit task files.

### Task 3: Fast hosted AI and resilient chat response

**Files:** Modify `lib/server/openai.ts`, `lib/server/ai.ts`, `app/api/chat/route.ts`, `app/api/me/route.ts`, `.env.example`; modify `tests/local-dev-auth.test.mjs`.

**Produces:** OpenAI provider selected in hosted mode, a bounded request timeout, generic fallback to guided chat, and accurate provider metadata.

- [ ] Add a failing integration case where an OpenAI timeout returns `200`, `answerMode: "guided"`, and `aiProvider: null` inside the configured bound.
- [ ] Run `node --test tests/local-dev-auth.test.mjs`; expect the new assertion to fail.
- [ ] Implement `AbortSignal.timeout` around the OpenAI request, cap completion output, classify timeout/quota/provider errors, and retain the guided safe fallback.
- [ ] Keep provider keys server-only and ensure `/api/me` labels hosted OpenAI as cloud AI.
- [ ] Re-run integration test and commit task files.

### Task 4: Production voice and interaction sound capabilities

**Files:** Create `app/api/audio/transcribe/route.ts`, `lib/client/browser-voice.ts`; modify `app/page.tsx`, `app/globals.css`, `worker/index.ts`; create `tests/voice-production.test.mjs`.

**Produces:** microphone recording sent only to protected transcription endpoint; SpeechSynthesis playback with cancellation; local Web Audio interaction sounds; capability/permission feedback.

- [ ] Write failing tests for no local-sidecar URLs in hosted voice code, explicit microphone user action, cancellation control, and server-only transcription request.
- [ ] Run `node --test tests/voice-production.test.mjs`; expect missing module/route failure.
- [ ] Implement browser recorder upload with maximum duration/size, Worker transcription using server OpenAI key, memory-only blobs, and timeout/error cleanup.
- [ ] Implement SpeechSynthesis voice selection and stop behavior; do not show a control when the relevant browser capability is absent.
- [ ] Add a persisted sound preference and local Web Audio click confirmation without fetching sound files.
- [ ] Re-run focused tests and commit task files.

### Task 5: Complete visible user actions and accessibility

**Files:** Modify `app/page.tsx`, `app/globals.css`, `app/legal-page.tsx`, `tests/rendered-html.test.mjs`; add `tests/client-actions.test.mjs`.

**Produces:** every navigation/action button has a working route or protected API outcome, appropriate disabled state, status announcement, and keyboard-accessible control.

- [ ] Write failing tests enumerating navigation, profile save, avatar upload/remove, history, export/delete data, feedback, consent, logout, chat submit, voice start/stop, and billing-disabled copy.
- [ ] Run `node --test tests/rendered-html.test.mjs tests/client-actions.test.mjs`; expect contract gaps.
- [ ] Repair each discovered unbound or misleading control; use `aria-live`/`role=status` for form messages and focus errors after failed auth submission.
- [ ] Re-run focused tests and commit task files.

### Task 6: Production operations, health, and deployment documentation

**Files:** Create `app/api/health/route.ts`; modify `lib/server/http.ts`, `README.md`, `.env.example`, `vite.config.ts`; create `tests/production-readiness.test.mjs`.

**Produces:** non-secret readiness response, request correlation, Cloudflare/Supabase/OpenAI setup instructions, migration/deploy/domain checklist.

- [ ] Write failing tests requiring a `requestId`, no secret values in readiness JSON, and documentation for Supabase callback URLs, Worker secrets, D1/R2, and custom domain.
- [ ] Run `node --test tests/production-readiness.test.mjs`; expect missing endpoint/checklist failure.
- [ ] Add readiness checks, error IDs, explicit environment templates without values, and exact Cloudflare deployment commands.
- [ ] Re-run focused tests and commit task files.

### Task 7: Full verification and public deployment

**Files:** no product code expected; deployment configuration and secrets are created only in owner accounts.

- [ ] Run `git diff --check`, `npx tsc --noEmit`, `npm run lint`, `npm test`, and `npm run build`; all must exit 0.
- [ ] Run local end-to-end smoke testing: register, sign in, request reset, set password, chat, deny/allow microphone, play/stop voice, profile/data actions, and all links.
- [ ] With owner-supplied Cloudflare/Supabase/OpenAI credentials, configure secrets and bindings, apply D1 migrations, deploy Worker, connect custom domain, and check HTTPS `/api/health`.
- [ ] Record the public URL and results; if credentials are not available, hand off exact commands and mark deployment externally blocked rather than claiming publication.
