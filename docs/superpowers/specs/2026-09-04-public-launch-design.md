# ADEMI MIND — public launch design

## Goal

Turn ADEMI MIND into a public, shareable web application with real account flows, fast server-side AI chat, browser voice interaction, verified user actions, and a Cloudflare deployment path.

## Product boundary

The app is a wellbeing companion, not emergency, medical, or clinical care. Existing crisis safety routes stay server-side and retain priority over normal chat. The application must not claim that a public AI provider is free, private by default, or available without limits.

## Architecture

### Hosting

Deploy the existing Vinext Worker to Cloudflare. Cloudflare D1 remains the relational store and R2 remains private object storage. Cloudflare manages the public domain, TLS, Workers secrets, deployment logs, and cache boundary.

### Authentication

Replace production reliance on injected ChatGPT identity headers with Supabase Auth. The client uses a public Supabase URL and anonymous key only. The Worker validates a bearer token through Supabase's verified user API/JWT boundary and maps immutable Supabase user IDs to users.authUserId.

Required flows: email/password registration; email/password sign-in; password-reset email request; password reset completion; session refresh; sign-out; and localized loading/error states.

Google sign-in is excluded from the initial release because it needs separate Google OAuth configuration and verified redirect domains. It can be added later without changing user records.

### AI chat

The Worker calls OpenAI only with a server-side secret. The default model is a low-latency configured model, while guided psychology remains the fallback for provider outage, timeout, quota errors, and safety-sensitive paths. Timeouts and message limits prevent stalled provider requests from blocking the UI.

An OpenAI account with billing is a deployment requirement. The public site labels cloud processing accurately and preserves the privacy disclosure.

### Voice

The public client asks for microphone permission only after a deliberate action. Audio goes to a protected Worker endpoint for transcription when OPENAI_API_KEY is configured and is never written to D1/R2. Text-to-speech uses browser SpeechSynthesis first, with stop/cancel control. The UI clearly identifies unsupported browser or device states.

Small interaction sounds use Web Audio generated locally, remain off until first interaction, and respect a persistent sound preference.

### Product completion

Every visible action has an outcome: navigation reaches the intended page or panel; forms validate input, disable while submitting, and show localized feedback; profile, consent, history, feedback, materials, and account-data actions call protected APIs; legal and safety pages work without login; billing stays disabled until a reviewed provider integration exists.

## Data and security

- No API secret is bundled into browser JavaScript.
- Supabase service credentials are Worker-only secrets; the public anonymous key is intentionally client-visible.
- Worker CSP permits only required same-origin, Supabase, and API connections.
- Error logs use request IDs and omit server stacks, secrets, tokens, emails, chat text, and audio.
- Passwords never pass through D1; Supabase owns password hashing and reset mail.
- Account deletion removes app-owned D1/R2 data and signs out the session. Deleting the Supabase identity additionally needs a Worker-side service credential.

## Deployment inputs owned by the project owner

1. Cloudflare account, API token or Wrangler login, and domain DNS access.
2. Supabase project URL, anonymous key, service-role key, configured email sender, and allowed production redirect URL.
3. OpenAI API key with a funded billing account.
4. Cloudflare D1/R2 production bindings and a deployment environment.

The code, tests, and deployment checklist can be completed without disclosing these values. A public URL cannot be created until the owner supplies access or performs the documented final deployment commands.

## Verification

- Unit and integration tests cover identity token validation, auth UI states, protected requests, reset flow contracts, chat fallbacks, voice capability gating, and no-secret browser bundle rules.
- Full TypeScript, lint, production build, and Node tests pass.
- Manual release testing covers registration, reset email, sign-in, sign-out, chat, microphone denial/allowance, playback cancellation, mobile layout, and all navigation.
- A deployed smoke test checks HTTPS, custom domain, CSP, health endpoint, and error correlation.

## Acceptance criteria

- A new person can open one HTTPS link, create an account, sign in, reset a forgotten password, chat, and use supported voice controls.
- AI requests either produce a timely response or a clear guided fallback.
- All visible buttons work or are explicitly marked unavailable with an explanation; payment is the only intentionally unavailable commercial action.
- The deployment produces a public Cloudflare URL before custom-domain setup, then supports the owner domain.
- Production requires no local Ollama, Python sidecar, FFmpeg, or developer machine.
