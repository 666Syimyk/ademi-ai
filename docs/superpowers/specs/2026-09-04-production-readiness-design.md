# ADEMI MIND — production-readiness design

## Purpose

Make the existing application operationally safer to deploy without enabling live payments before Freedom Pay credentials, a signed webhook contract, and an owner-controlled production account are available.

## Scope

- Keep the customer payment screen in its current disabled, truthful state.
- Add an internal payment-webhook boundary which is disabled unless the required configuration is present.
- Make duplicate delivery safe through the existing unique `(provider, externalEventId)` database invariant.
- Expose a non-secret health/readiness report for deployment checks.
- Add correlation IDs to API errors and structured server logs that exclude request bodies, user messages, credentials, and payment secrets.
- Document the Cloudflare deployment and payment-enablement procedure.

## Out of scope

- Freedom Pay checkout integration, merchant onboarding, live webhook registration, and real payment processing.
- Changing subscription prices, refund policy, or legal terms.
- Public deployment of the local voice sidecar.
- Collecting new user data or recording chat text in logs.

## Architecture

### Configuration

`RuntimeBindings` gains optional deployment values for an externally supplied webhook URL and a health-token policy only if required by the existing Workers deployment conventions. Readiness is derived from bindings already in use: D1, R2, AI selection, payment provider, checkout URL, and webhook secret. It returns booleans and named states only; it never returns values, URLs containing credentials, or secret presence details beyond the aggregated payment readiness state.

### Payment webhook boundary

Create `POST /api/billing/webhook`. It accepts no event when payment configuration is incomplete and returns a generic unavailable response. When configuration is complete, it verifies a provider-specific signature before parsing an event. The first supported adapter is an explicit disabled `freedompay` adapter: it has a narrow parser/verification interface and fails closed until official Freedom Pay signing documentation and credentials are supplied.

The route writes a `paymentWebhookEvents` row before granting access. The database unique key makes the operation idempotent. A recognised successful event may create or update a payment and membership only after the adapter validates an external payment ID, amount, currency, status, and event ID. Unknown event types are recorded as received but do not grant access. Invalid signatures create no database rows and never reveal the expected signature.

### Health endpoint

Create `GET /api/health`. It is a deployment-readiness endpoint, not a data endpoint. It reports `ok`, `checks`, and a `requestId`. Checks include database query success, R2 binding availability, active AI mode, payment mode (`disabled`, `incomplete`, or `ready`), and local voice capability (`local-only` or `not-available`). It returns `503` only when a required configured dependency is unhealthy; a deliberately disabled payment provider remains a healthy pre-launch state.

### Error observability

Introduce one request-context helper in `lib/server/http.ts`. Routes can generate or forward a request ID, write structured metadata (`requestId`, route, status, error code, error class), and return it in an `X-Request-Id` header. Public JSON remains generic for unexpected failures. Logging must not serialize `Request`, headers, body, user email, chat content, file data, or secret configuration.

### Operational documentation

Add a production checklist to `README.md`: bind D1/R2, apply migrations, set non-secret and secret bindings in Cloudflare, configure a reachable AI provider, use HTTPS webhook endpoint, securely rotate the webhook secret, verify health, back up data, and perform a test payment only after credentials are configured. The checklist explicitly says that the current code does not enable Freedom Pay until a reviewed provider adapter is implemented from official documentation.

## Failure handling

- Missing payment configuration: webhook replies unavailable; checkout remains disabled; health says `disabled` or `incomplete`.
- Invalid or missing signature: reject before any persistence, without indicating why verification failed.
- Duplicate webhook: return success/idempotent result and do not create a second membership or payment.
- Database/R2 health failure: return `503` health result with non-secret failed check names.
- Unexpected route failure: generic `500` response with request ID; safe structured error log.

## Test strategy

1. Add route-level tests for readiness: disabled payments are healthy pre-launch; missing core binding produces `503`; no secret appears in JSON.
2. Add webhook tests for disabled configuration, signature rejection before persistence, duplicate-event idempotency, and unsupported events not granting membership.
3. Add HTTP-helper tests to prove every error response carries a request ID and logs only approved fields.
4. Add rendered/API regression tests confirming the customer payment UI remains disabled until checkout is intentionally enabled.
5. Run TypeScript, lint, the full Node suite, and a production build.

## Acceptance criteria

- No API response or log path created by this work exposes credentials, webhook signatures, or chat text.
- Live payment access cannot be granted while payment configuration is absent.
- Replayed valid events cannot create duplicate payment or membership records.
- Operators can distinguish healthy pre-launch configuration from broken production dependencies through `/api/health`.
- Existing 51 tests remain green, and new behaviour is covered by tests written before implementation.
- The deployment checklist clearly identifies the remaining owner actions and external Freedom Pay dependency.
