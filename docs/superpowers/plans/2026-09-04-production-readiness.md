# Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Add safe pre-launch observability and a disabled-by-default payment webhook foundation without accepting or granting access for live payments.

**Architecture:** Keep payment state in D1 and use a narrow provider-adapter module so route code never parses unverified payloads. Add a health route that reports only states, and centralize request IDs and safe error logs in the existing HTTP helper.

**Tech Stack:** TypeScript, React 19, Vinext, Cloudflare Workers, Drizzle ORM/D1, Node test runner.

**Spec:** \`docs/superpowers/specs/2026-09-04-production-readiness-design.md\`

## Global Constraints

- Preserve existing uncommitted user changes; stage only task files.
- Customer payment checkout stays disabled and \`POST /api/billing\` keeps returning \`payments_not_configured\`.
- Do not log bodies, headers, emails, chat content, files, secrets, or webhook signatures.
- Do not claim Freedom Pay compatibility before implementing verification from its official documentation.
- Every behavioral test fails before its production implementation is written.

---

### Task 1: Request context and safe API errors

**Files:**
- Modify: \`lib/server/http.ts\`
- Modify: \`app/api/billing/route.ts\`
- Create: \`tests/http-observability.test.mjs\`

**Interfaces:**
- Produces \`requestIdFor(request?: Request): string\` and \`jsonError(error, request?, route?): Response\`.
- Every API error has matching \`X-Request-Id\` and JSON \`requestId\`; unexpected errors remain generic.

- [ ] **Step 1: Write the failing test**

~~~js
test("API errors expose a generated request ID but no internal detail", async () => {
  const { ApiError, jsonError } = await loadHttpModule();
  const response = jsonError(new ApiError(422, "bad input", "validation_error"));
  const body = await response.json();
  assert.equal(response.headers.get("X-Request-Id"), body.requestId);
  assert.match(body.requestId, /^[a-f0-9-]{36}$/);
  assert.equal(body.code, "validation_error");
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: \`node --test tests/http-observability.test.mjs\`

Expected: FAIL because the response has neither a request ID header nor field.

- [ ] **Step 3: Write minimal implementation**

Add \`requestIdFor\`, add its result to API error headers/body, and log only \`requestId\`, literal route name, status/code, and error class. Pass request and route from billing.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: \`node --test tests/http-observability.test.mjs\`

Expected: PASS.

- [ ] **Step 5: Commit only task files**

~~~bash
git add lib/server/http.ts app/api/billing/route.ts tests/http-observability.test.mjs
git commit -m "feat: add safe API request correlation"
~~~

### Task 2: Non-secret readiness endpoint

**Files:**
- Create: \`app/api/health/route.ts\`
- Modify: \`lib/server/runtime.ts\`
- Create: \`tests/health-route.test.mjs\`

**Interfaces:**
- \`GET /api/health\` returns \`{ ok, requestId, checks: { database, storage, ai, payments, voice } }\`.
- \`checks.payments\` is exactly \`disabled\`, \`incomplete\`, or \`ready\`; URLs and secrets are never returned.

- [ ] **Step 1: Write the failing test**

~~~js
test("health treats disabled payments as healthy pre-launch without exposing configuration", async () => {
  const source = await readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(source, /payments:\s*paymentReadiness\(/);
  assert.match(source, /"disabled"/);
  assert.doesNotMatch(source, /PAYMENT_WEBHOOK_SECRET\s*[,}]/);
  assert.doesNotMatch(source, /PAYMENT_CHECKOUT_URL\s*[,}]/);
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: \`node --test tests/health-route.test.mjs\`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Write minimal implementation**

Add \`paymentReadiness()\`: neither setting means \`disabled\`, one means \`incomplete\`, both means \`ready\`. Probe D1 with a constant select, report whether R2 binding exists, report selected AI mode and whether local audio is available. Return 503 only for a failed required configured dependency; disabled payments remain 200.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: \`node --test tests/health-route.test.mjs\`

Expected: PASS.

- [ ] **Step 5: Commit only task files**

~~~bash
git add app/api/health/route.ts lib/server/runtime.ts tests/health-route.test.mjs
git commit -m "feat: add non-secret readiness endpoint"
~~~

### Task 3: Fail-closed payment webhook boundary

**Files:**
- Create: \`lib/server/payment-webhook.ts\`
- Create: \`app/api/billing/webhook/route.ts\`
- Create: \`tests/payment-webhook.test.mjs\`

**Interfaces:**
- \`paymentWebhookReadiness(env): "disabled" | "incomplete" | "ready"\`.
- \`verifyPaymentWebhook(request, env): Promise<VerifiedPaymentEvent | null>\`.
- \`VerifiedPaymentEvent\` includes event ID, type, payment ID, status, amount, currency, and nullable mapped user ID.
- The initial Freedom Pay adapter returns \`null\` until official signature validation is supplied.

- [ ] **Step 1: Write the failing test**

~~~js
test("webhook cannot persist or grant access before a provider verifier exists", async () => {
  const route = await readFile(new URL("../app/api/billing/webhook/route.ts", import.meta.url), "utf8");
  assert.match(route, /verifyPaymentWebhook/);
  assert.match(route, /payments_not_configured/);
  assert.ok(route.indexOf("verifyPaymentWebhook") < route.indexOf(".insert(paymentWebhookEvents)"));
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: \`node --test tests/payment-webhook.test.mjs\`

Expected: FAIL because the boundary does not exist.

- [ ] **Step 3: Write minimal implementation**

Share readiness logic with health. Return 503 before verification when disabled or incomplete. For configured-but-unimplemented Freedom Pay, return 401 \`invalid_webhook_signature\` before any D1 write. Do not parse unverified body data for persistence.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: \`node --test tests/payment-webhook.test.mjs\`

Expected: PASS.

- [ ] **Step 5: Commit only task files**

~~~bash
git add lib/server/payment-webhook.ts app/api/billing/webhook/route.ts tests/payment-webhook.test.mjs
git commit -m "feat: add fail-closed payment webhook boundary"
~~~

### Task 4: Reserve idempotent verified-event processing

**Files:**
- Modify: \`lib/server/payment-webhook.ts\`
- Modify: \`app/api/billing/webhook/route.ts\`
- Modify: \`tests/payment-webhook.test.mjs\`

**Interfaces:**
- Produces \`recordPaymentWebhookEvent(event): Promise<{ duplicate: boolean }>\`.
- A verified event is inserted into \`paymentWebhookEvents\` using its existing unique provider/event key before any payment or membership action.
- Duplicate events return an idempotent response and cannot grant access again.

- [ ] **Step 1: Write the failing test**

~~~js
test("event receipt is persisted idempotently before membership changes", async () => {
  const route = await readFile(new URL("../app/api/billing/webhook/route.ts", import.meta.url), "utf8");
  const receipt = route.indexOf(".insert(paymentWebhookEvents)");
  const membership = route.indexOf(".insert(memberships)");
  assert.ok(receipt >= 0);
  assert.ok(membership > receipt);
  assert.match(route, /onConflictDoNothing/);
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: \`node --test tests/payment-webhook.test.mjs\`

Expected: FAIL because no verified-event persistence exists.

- [ ] **Step 3: Write minimal implementation**

Add the path but keep it unreachable with the disabled adapter: \`onConflictDoNothing()\`, return duplicate before later processing, then grant only for a verified succeeded event with an adapter-mapped existing user. Do not invent a user mapping or plan selection.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: \`node --test tests/payment-webhook.test.mjs\`

Expected: PASS.

- [ ] **Step 5: Commit only task files**

~~~bash
git add lib/server/payment-webhook.ts app/api/billing/webhook/route.ts tests/payment-webhook.test.mjs
git commit -m "feat: reserve idempotent payment event handling"
~~~

### Task 5: Deployment checklist and payment regression guard

**Files:**
- Modify: \`README.md\`
- Modify: \`tests/rendered-html.test.mjs\`

**Interfaces:**
- README documents D1/R2, migrations, secrets, AI endpoint, HTTPS webhook, secret rotation, health check, backups, and sandbox payment verification.
- Public payment screen remains informational until live checkout is intentionally implemented.

- [ ] **Step 1: Write the failing test**

~~~js
test("the product keeps payment disabled while checkout is not implemented", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const billing = await readFile(new URL("../app/api/billing/route.ts", import.meta.url), "utf8");
  assert.match(page, /paymentBadge: "Сейчас бесплатно"/);
  assert.match(billing, /payments_not_configured/);
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: \`node --test tests/rendered-html.test.mjs\`

Expected: adjust the new assertion until removal of the disabled-payment contract makes it fail.

- [ ] **Step 3: Write minimal implementation**

Append the production checklist to README. Explicitly state the current webhook is fail-closed and that Freedom Pay remains externally blocked pending official verifier documentation, merchant credentials, and a sandbox account.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: \`node --test tests/rendered-html.test.mjs\`

Expected: PASS.

- [ ] **Step 5: Commit only task files**

~~~bash
git add README.md tests/rendered-html.test.mjs
git commit -m "docs: add production launch checklist"
~~~

### Task 6: Full verification and handoff

**Files:**
- Modify: no production files expected.

- [ ] **Step 1: Check scope and whitespace**

Run: \`git diff --check HEAD~5..HEAD\` and \`git status --short\`

Expected: no whitespace errors; all pre-existing user files remain untouched.

- [ ] **Step 2: Run static checks**

Run: \`npx tsc --noEmit && npm run lint && npm run build\`

Expected: all commands exit 0.

- [ ] **Step 3: Run behavioral suite**

Run: \`npm test\`

Expected: full Node suite passes with health, HTTP, and webhook regressions.

- [ ] **Step 4: Verify pre-launch endpoint**

Run: \`npm run dev\`, then in another terminal: \`Invoke-WebRequest http://localhost:3000/api/health -UseBasicParsing\`

Expected: HTTP 200, \`payments: "disabled"\`, and no settings or secret values in JSON.

- [ ] **Step 5: Hand off**

Report files changed, exact test output, and the remaining external requirement: official Freedom Pay webhook rules, merchant credentials, and a sandbox environment before live enablement.

