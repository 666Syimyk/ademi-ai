# ADEMI Backend AI and Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать обычный чат платным, подключить Cloudflare Workers AI с безопасным guided fallback и реализовать тестовую одноразовую оплату Freedom Pay на 990 KGS за 30 дней.

**Architecture:** Локальная safety-проверка остаётся первым слоем. После неё сервер проверяет активный доступ, вызывает Workers AI через единый провайдерный контракт и при любой контролируемой ошибке переключается на deterministic guided engine. Freedom Pay создаёт серверный pending-платёж, а подписанный идемпотентный callback активирует отдельный 30-дневный membership.

**Tech Stack:** TypeScript 5.9, Next.js/vinext, Cloudflare Workers AI, D1, Drizzle ORM, Node test runner, Freedom Pay Merchant API.

**Spec:** `docs/superpowers/specs/2026-08-26-ademi-mind-universe-design.md`

## Global Constraints

- Node.js `>=22.13.0`.
- Тариф: `ADEMI MIND`, `99000` minor units = `990.00 KGS`, срок `30` дней, без автоматического продления.
- Основная модель: `@cf/zai-org/glm-4.7-flash`; ответ не длиннее `850` completion tokens.
- Кризисные и срочные медицинские ответы выполняются до paywall, rate limit, D1 history и AI provider.
- Обычный чат и чтение истории требуют активный доступ; экспорт и удаление личных данных не требуют оплаты.
- Owner bypass требует одновременно настроенный `ADEMI_OWNER_EMAIL` и сохранённую роль `owner`.
- OpenAI не вызывается для обычного чата; существующий модуль остаётся опциональным только для индексации материалов.
- Секреты, raw provider errors, prompt/completion content и платёжные payload не попадают в клиент или техническую телеметрию.
- Существующие незакоммиченные файлы и миграция `0002_rich_xorn.sql` сохраняются; следующая миграция имеет номер `0003`.
- Перед каждым коммитом проверять `git diff --cached --name-only` и не включать несвязанные пользовательские изменения.

---

### Task 1: Honest test runner and paid-access contract

**Files:**
- Create: `tests/access-gates.test.mjs`
- Modify: `package.json`
- Modify: `lib/server/auth.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/safety-freechat.test.mjs`

**Interfaces:**
- Produces: `resolvePaidAccess(user, now?)`, `requirePaidAccess()`, compatibility wrappers `hasCourseAccess()` and `requireCourseAccess()`.
- Consumes: existing `AppUser`, `memberships`, `ApiError`.

- [ ] **Step 1: Write failing access-order tests**

```js
test("ordinary chat is gated after deterministic emergencies", async () => {
  const route = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
  const crisis = route.indexOf('localSafety.level === "crisis"');
  const urgent = route.indexOf('localSafety.category === "urgent_medical"');
  const access = route.indexOf("resolvePaidAccess(user)");
  assert.ok(crisis >= 0 && urgent >= 0 && access >= 0);
  assert.ok(crisis < access && urgent < access);
  assert.match(route, /subscription_required/);
});

test("privacy endpoints do not require paid access", async () => {
  const dataRoute = await readFile(new URL("../app/api/me/data/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(dataRoute, /requirePaidAccess|requireCourseAccess/);
});
```

- [ ] **Step 2: Run the targeted test and verify failure**

Run: `node --test tests/access-gates.test.mjs`

Expected: FAIL because `resolvePaidAccess(user)` and `subscription_required` are not present in the chat route.

- [ ] **Step 3: Implement the paid-access snapshot**

```ts
export type PaidAccessSnapshot = {
  hasAccess: boolean;
  source: "owner" | "membership" | null;
  membershipId: string | null;
  endsAt: number | null;
};

export function isConfiguredOwner(user: AppUser) {
  const email = runtimeEnv().ADEMI_OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(email && user.role === "owner" && user.email === email);
}

export async function resolvePaidAccess(
  user: AppUser,
  now = Date.now(),
): Promise<PaidAccessSnapshot> {
  if (user.accountStatus === "suspended")
    return { hasAccess: false, source: null, membershipId: null, endsAt: null };
  if (isConfiguredOwner(user))
    return { hasAccess: true, source: "owner", membershipId: null, endsAt: null };
  const [row] = await getDb()
    .select({ id: memberships.id, endsAt: memberships.endsAt })
    .from(memberships)
    .where(and(
      eq(memberships.userId, user.id),
      inArray(memberships.status, ["active", "trialing", "comped"]),
      lte(memberships.startsAt, now),
      or(isNull(memberships.endsAt), gt(memberships.endsAt, now)),
    ))
    .orderBy(desc(memberships.endsAt))
    .limit(1);
  return row
    ? { hasAccess: true, source: "membership", membershipId: row.id, endsAt: row.endsAt }
    : { hasAccess: false, source: null, membershipId: null, endsAt: null };
}
```

- [ ] **Step 4: Gate ordinary chat after all immediate emergency branches**

```ts
const access = await resolvePaidAccess(user);
if (!access.hasAccess) {
  throw new ApiError(
    403,
    "Для обычного диалога требуется активная подписка",
    "subscription_required",
  );
}
```

Place this after account/consent/onboarding validation and before D1 conversation reads, moderation and quotas. Apply the same gate to chat `GET`; keep chat `DELETE` ownership-scoped but ungated for data rights.

- [ ] **Step 5: Make the package test command discover every Node test**

```json
{
  "scripts": {
    "test:node": "node --test \"tests/*.test.mjs\"",
    "test": "npm run build && npm run test:node",
    "typecheck": "tsc --noEmit --incremental false"
  }
}
```

- [ ] **Step 6: Replace old free-chat assertions and run tests**

Run: `node --test tests/access-gates.test.mjs tests/safety-freechat.test.mjs`

Expected: PASS; safety tests assert emergency-before-paywall ordering instead of absence of a membership gate.

- [ ] **Step 7: Commit the access boundary**

```powershell
git add package.json lib/server/auth.ts app/api/chat/route.ts tests/access-gates.test.mjs tests/rendered-html.test.mjs tests/safety-freechat.test.mjs
git diff --cached --name-only
git commit -m "feat: require paid access for ordinary chat"
```

---

### Task 2: Workers AI provider contract and bounded prompt

**Files:**
- Create: `lib/server/ai/types.ts`
- Create: `lib/server/ai/prompt.ts`
- Create: `lib/server/ai/cloudflare.ts`
- Create: `tests/ai-provider-chain.test.mjs`
- Modify: `lib/server/runtime.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces: `PsychologyAiRequest`, `PsychologyAiAnswer`, `buildPsychologyMessages()`, `createCloudflarePsychologyResponse()`.
- Consumes: `Language`, `PsychologyResponseContext`, optional runtime binding `AI?: Ai`.

- [ ] **Step 1: Write failing provider tests with a fake AI binding**

```js
test("Workers AI uses GLM with bounded history", async () => {
  const calls = [];
  const AI = { run: async (model, body) => {
    calls.push({ model, body });
    return { response: "Спокойный ответ", usage: { prompt_tokens: 30, completion_tokens: 12 } };
  }};
  const result = await createCloudflarePsychologyResponse(fixtureRequest, AI);
  assert.equal(calls[0].model, "@cf/zai-org/glm-4.7-flash");
  assert.equal(calls[0].body.max_completion_tokens, 850);
  assert.ok(JSON.stringify(calls[0].body.messages).length < 12000);
  assert.equal(result.answerMode, "generative");
});
```

- [ ] **Step 2: Run and verify the module is missing**

Run: `node --test tests/ai-provider-chain.test.mjs`

Expected: FAIL with module-not-found for `lib/server/ai/cloudflare.ts`.

- [ ] **Step 3: Define stable shared AI types**

```ts
export type ChatTurn = { role: "user" | "assistant"; content: string };
export type PsychologySource = { filename: string; fileId?: string | null };

export type PsychologyAiRequest = {
  message: string;
  history: ChatTurn[];
  language: "RU" | "KG" | "EN";
  audience: "owner" | "student";
  courseReference?: { label: string; text: string };
  ownerReference?: string;
};

export type PsychologyAiAnswer = {
  text: string;
  sources: PsychologySource[];
  answerMode: "generative" | "guided";
  model: string;
  providerResponseId?: string;
  inputTokens?: number;
  outputTokens?: number;
};
```

- [ ] **Step 4: Build a bounded prompt shared by providers**

```ts
const MAX_TURNS = 6;
const MAX_TURN_CHARS = 1500;
const MAX_HISTORY_CHARS = 6000;

export function boundedHistory(history: ChatTurn[]) {
  let used = 0;
  return history.slice(-MAX_TURNS).reverse().flatMap((turn) => {
    const content = turn.content.slice(0, Math.min(MAX_TURN_CHARS, MAX_HISTORY_CHARS - used));
    used += content.length;
    return content ? [{ ...turn, content }] : [];
  }).reverse();
}
```

Move the existing safety/evidence/prompt-injection rules from `lib/server/openai.ts` into `prompt.ts`; preserve course and owner delimiters and reject owner reference for a student audience.

- [ ] **Step 5: Implement the Cloudflare provider**

```ts
type CloudflareTextResult = {
  response?: string;
  id?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

function extractCloudflareText(result: CloudflareTextResult) {
  return (result.response ?? result.choices?.[0]?.message?.content ?? "").trim();
}

export async function createCloudflarePsychologyResponse(
  request: PsychologyAiRequest,
  AI: Ai,
): Promise<PsychologyAiAnswer> {
  const result = await AI.run("@cf/zai-org/glm-4.7-flash", {
    messages: buildPsychologyMessages(request),
    max_completion_tokens: 850,
    temperature: 0.3,
  }) as CloudflareTextResult;
  const text = extractCloudflareText(result);
  if (!text) throw new AiProviderError("empty_response");
  return {
    text,
    sources: request.courseReference ? [{ filename: request.courseReference.label }] : [],
    answerMode: "generative",
    model: "@cf/zai-org/glm-4.7-flash",
    providerResponseId: result.id,
    inputTokens: result.usage?.prompt_tokens,
    outputTokens: result.usage?.completion_tokens,
  };
}
```

- [ ] **Step 6: Add the optional binding without enabling remote local inference by default**

```ts
export type RuntimeBindings = {
  DB: D1Database;
  MATERIALS: R2Bucket;
  AI?: Ai;
  AI_MODEL?: string;
  ADEMI_REMOTE_AI?: string;
  // existing bindings remain
};
```

In `vite.config.ts`, include `ai: { binding: "AI", remote: true }` only when `process.env.ADEMI_REMOTE_AI === "true"`; otherwise omit `ai` so local runs exercise guided fallback.

- [ ] **Step 7: Run provider tests and commit**

Run: `node --test tests/ai-provider-chain.test.mjs`

Expected: PASS for model, prompt limits, usage mapping and empty-response rejection.

```powershell
git add lib/server/ai lib/server/runtime.ts vite.config.ts tests/ai-provider-chain.test.mjs
git diff --cached --name-only
git commit -m "feat: add Cloudflare psychology provider"
```

---

### Task 3: Workers AI to guided fallback chain and chat integration

**Files:**
- Create: `lib/server/ai/chain.ts`
- Create: `lib/server/ai/index.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `app/api/me/route.ts`
- Modify: `lib/server/openai.ts`
- Modify: `tests/ai-provider-chain.test.mjs`

**Interfaces:**
- Produces: `generatePsychologyAnswer(request, guidedContext)`, `getAiReadiness()`.
- Consumes: Cloudflare provider from Task 2 and existing `createGuidedPsychologyResponse()`.

- [ ] **Step 1: Add failing fallback cases**

```js
for (const scenario of ["missing", "quota", "exception", "empty"]) {
  test(`falls back to guided for ${scenario}`, async () => {
    const answer = await runChainScenario(scenario);
    assert.equal(answer.answerMode, "guided");
    assert.equal(answer.model, "ademi-guided-v1");
    assert.doesNotMatch(JSON.stringify(answer), /stack|secret|quota exceeded/i);
  });
}
```

- [ ] **Step 2: Verify fallback tests fail**

Run: `node --test tests/ai-provider-chain.test.mjs`

Expected: FAIL because `generatePsychologyAnswer` is not exported.

- [ ] **Step 3: Implement the chain with safe reason codes**

```ts
export async function generatePsychologyAnswer(
  request: PsychologyAiRequest,
  guided: GuidedPsychologyContext,
): Promise<PsychologyAiAnswer & { fallbackReason?: FallbackReason }> {
  const AI = runtimeEnv().AI;
  if (AI) {
    try {
      return await createCloudflarePsychologyResponse(request, AI);
    } catch (error) {
      const fallbackReason = classifyProviderFailure(error);
      return { ...createGuidedAnswer(request, guided), fallbackReason };
    }
  }
  return { ...createGuidedAnswer(request, guided), fallbackReason: "binding_missing" };
}
```

Allowed fallback codes are `binding_missing`, `provider_error`, `quota`, `empty_response`; do not return the raw exception.

- [ ] **Step 4: Replace the chat provider branch**

```ts
const answer = await generatePsychologyAnswer(
  {
    message,
    history: priorMessages,
    language,
    audience: user.role === "owner" ? "owner" : "student",
    courseReference: matchedCourseProgram ? { label: sourceLabel, text: courseProgramText } : undefined,
    ownerReference,
  },
  {
    audience: user.role === "owner" ? "owner" : "student",
    history: priorMessages,
    courseMatched: matchedCourseProgram,
    safetyLevel: localSafety.level === "sensitive" ? "sensitive" : "standard",
  },
);
```

Remove ordinary-chat calls to `createPsychologyResponse()` and `moderateText()`. Keep the OpenAI module available only to material indexing callers.

- [ ] **Step 5: Return effective AI readiness from `/api/me`**

```ts
services: {
  ai: true,
  provider: runtimeEnv().AI ? "cloudflare" : "guided",
  answerMode: runtimeEnv().AI ? "generative" : "guided",
  model: runtimeEnv().AI ? "@cf/zai-org/glm-4.7-flash" : "ademi-guided-v1",
  fallback: "ademi-guided-v1",
}
```

- [ ] **Step 6: Run AI, safety and guided tests**

Run: `node --test tests/ai-provider-chain.test.mjs tests/psychology-guided.test.mjs tests/safety-freechat.test.mjs`

Expected: PASS; the source scan confirms ordinary chat does not invoke OpenAI.

- [ ] **Step 7: Commit the provider chain**

```powershell
git add lib/server/ai app/api/chat/route.ts app/api/me/route.ts lib/server/openai.ts tests/ai-provider-chain.test.mjs
git diff --cached --name-only
git commit -m "feat: add resilient psychology AI fallback"
```

---

### Task 4: Additive billing and AI telemetry schema

**Files:**
- Modify: `db/schema.ts`
- Create: `tests/migration-billing-ai.test.mjs`
- Create via Drizzle: `drizzle/0003_ademi_mind_billing_ai.sql`
- Create via Drizzle: `drizzle/meta/0003_snapshot.json`
- Modify via Drizzle: `drizzle/meta/_journal.json`

**Interfaces:**
- Produces: extended `payments`, extended `paymentWebhookEvents`, new `aiProviderEvents`, seeded plan `ademi_mind_30d`.
- Consumes: existing `users`, `plans`, `memberships` and migration `0002`.

- [ ] **Step 1: Write a migration invariant test**

```js
test("billing migration is additive and seeds the exact plan", async () => {
  const sql = await readFile(new URL("../drizzle/0003_ademi_mind_billing_ai.sql", import.meta.url), "utf8");
  assert.match(sql, /ALTER TABLE `payments` ADD `order_id` text/);
  assert.match(sql, /99000/);
  assert.match(sql, /ademi_mind_30d/);
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN/);
});
```

- [ ] **Step 2: Verify the migration test fails**

Run: `node --test tests/migration-billing-ai.test.mjs`

Expected: FAIL because migration `0003` does not exist.

- [ ] **Step 3: Add schema fields and telemetry table**

```ts
orderId: text("order_id"),
providerPaymentId: text("provider_payment_id"),
mode: text("mode", { enum: ["test", "production"] }).notNull().default("test"),
redirectUrl: text("redirect_url"),
failureCode: text("failure_code"),
completedAt: integer("completed_at"),
activationAppliedAt: integer("activation_applied_at"),
```

```ts
export const aiProviderEvents = sqliteTable("ai_provider_events", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  answerMode: text("answer_mode").notNull(),
  outcome: text("outcome").notNull(),
  reasonCode: text("reason_code"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  latencyMs: integer("latency_ms").notNull(),
  createdAt: integer("created_at").notNull().default(nowMs),
});
```

Add webhook fields `paymentId`, `resultCode`, `payloadFingerprint`, `responseBody` and `responseStatus`. Add unique indexes `(provider, orderId)` and `(provider, providerPaymentId)`.

- [ ] **Step 4: Generate migration 0003 and append immutable seeds**

Run: `npm run db:generate -- --name=ademi_mind_billing_ai`

Append to the generated migration:

```sql
INSERT OR IGNORE INTO `plans`
  (`id`, `code`, `name`, `price_minor`, `currency`, `duration_days`, `is_active`)
VALUES
  ('plan_ademi_mind_30d', 'ademi_mind_30d', 'ADEMI MIND', 99000, 'KGS', 30, 1);
INSERT OR REPLACE INTO `app_settings` (`key`, `value_json`)
VALUES ('active_plan_code', '{"code":"ademi_mind_30d"}');
```

- [ ] **Step 5: Run migration and schema tests**

Run: `node --test tests/migration-billing-ai.test.mjs tests/profile-backend.test.mjs`

Expected: PASS and no mutation to `0000`, `0001` or `0002`.

- [ ] **Step 6: Commit only schema artifacts**

```powershell
git add db/schema.ts drizzle/0003_ademi_mind_billing_ai.sql drizzle/meta/0003_snapshot.json drizzle/meta/_journal.json tests/migration-billing-ai.test.mjs
git diff --cached --name-only
git commit -m "feat: add ADEMI billing schema"
```

---

### Task 5: Freedom Pay signature, amounts, XML and configuration

**Files:**
- Create: `lib/server/payments/types.ts`
- Create: `lib/server/payments/config.ts`
- Create: `lib/server/payments/signature.ts`
- Create: `lib/server/payments/amount.ts`
- Create: `lib/server/payments/xml.ts`
- Create: `tests/freedompay-signature.test.mjs`
- Modify: `lib/server/runtime.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `getPaymentConfig()`, `signFreedomPay()`, `verifyFreedomPaySignature()`, `minorToDecimal()`, `decimalToMinor()`, `parseFreedomPayXml()`, `buildFreedomPayXml()`.
- Consumes: runtime environment only on the server.

- [ ] **Step 1: Write official-ordering and tamper tests**

```js
test("Freedom Pay signature sorts values and excludes pg_sig", () => {
  const params = { pg_order_id: "order-1", pg_amount: "990.00", pg_salt: "abc" };
  assert.equal(signFreedomPay("init_payment.php", params, "secret"), expectedMd5);
  assert.equal(verifyFreedomPaySignature("init_payment.php", { ...params, pg_sig: expectedMd5 }, "secret"), true);
  assert.equal(verifyFreedomPaySignature("init_payment.php", { ...params, pg_amount: "991.00", pg_sig: expectedMd5 }, "secret"), false);
});

test("KGS conversion never uses floating point", () => {
  assert.equal(minorToDecimal(99000), "990.00");
  assert.equal(decimalToMinor("990.00"), 99000);
  assert.throws(() => decimalToMinor("990.001"));
});
```

- [ ] **Step 2: Run and verify missing-module failures**

Run: `node --test tests/freedompay-signature.test.mjs`

Expected: FAIL for missing payment modules.

- [ ] **Step 3: Implement MD5 signing and constant-time comparison**

```ts
import { createHash, timingSafeEqual } from "node:crypto";

export function signFreedomPay(
  script: string,
  values: Record<string, string>,
  secret: string,
) {
  const sorted = Object.entries(values)
    .filter(([key]) => key !== "pg_sig")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
  return createHash("md5").update([script, ...sorted, secret].join(";")).digest("hex");
}

export function verifyFreedomPaySignature(script: string, values: Record<string, string>, secret: string) {
  const received = values.pg_sig ?? "";
  const expected = signFreedomPay(script, values, secret);
  const left = Buffer.from(received, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
```

- [ ] **Step 4: Implement strict money and bounded XML helpers**

```ts
export function decimalToMinor(value: string) {
  const match = /^(0|[1-9]\d*)\.(\d{2})$/.exec(value);
  if (!match) throw new ApiError(422, "Некорректная сумма", "invalid_amount");
  return Number(match[1]) * 100 + Number(match[2]);
}
```

`parseFreedomPayXml()` rejects bodies over 64 KiB and any `<!DOCTYPE` or `<!ENTITY`; it extracts only the allowlisted tags `pg_status`, `pg_payment_id`, `pg_redirect_url`, `pg_error_code`, `pg_error_description` and decodes five standard XML entities.

- [ ] **Step 5: Implement strict test configuration**

```ts
export function getPaymentConfig(): PaymentConfig {
  const env = runtimeEnv();
  const mode = env.PAYMENT_MODE === "production" ? "production" : "test";
  const apiBase = env.FREEDOMPAY_API_BASE ?? "https://test-api.freedompay.kg";
  if (mode === "test" && new URL(apiBase).hostname !== "test-api.freedompay.kg")
    throw new ApiError(500, "Некорректная тестовая конфигурация оплаты", "payment_config_error");
  return {
    mode,
    apiBase,
    merchantId: env.FREEDOMPAY_MERCHANT_ID ?? "",
    secretKey: env.FREEDOMPAY_SECRET_KEY ?? "",
    appBaseUrl: env.APP_BASE_URL ?? "http://localhost:3000",
    simulator: mode === "test" && env.APP_ENV !== "production" && env.PAYMENT_TEST_SIMULATOR === "true",
  };
}
```

Extend `RuntimeBindings` with the exact server-only names:

```ts
APP_ENV?: "development" | "test" | "production";
APP_BASE_URL?: string;
PAYMENT_PROVIDER?: "freedompay";
PAYMENT_MODE?: "test" | "production";
FREEDOMPAY_MERCHANT_ID?: string;
FREEDOMPAY_SECRET_KEY?: string;
FREEDOMPAY_API_BASE?: string;
PAYMENT_TEST_SIMULATOR?: string;
```

- [ ] **Step 6: Document environment names without values**

```dotenv
APP_ENV=development
APP_BASE_URL=http://localhost:3000
AI_MODEL=@cf/zai-org/glm-4.7-flash
PAYMENT_PROVIDER=freedompay
PAYMENT_MODE=test
FREEDOMPAY_MERCHANT_ID=
FREEDOMPAY_SECRET_KEY=
FREEDOMPAY_API_BASE=https://test-api.freedompay.kg
PAYMENT_TEST_SIMULATOR=true
```

- [ ] **Step 7: Run tests and commit**

Run: `node --test tests/freedompay-signature.test.mjs`

Expected: PASS for signing, tamper rejection, money and unsafe XML.

```powershell
git add lib/server/payments lib/server/runtime.ts .env.example tests/freedompay-signature.test.mjs
git diff --cached --name-only
git commit -m "feat: add Freedom Pay protocol primitives"
```

---

### Task 6: Server-priced checkout and billing status

**Files:**
- Create: `lib/server/payments/freedompay.ts`
- Create: `lib/server/payments/service.ts`
- Modify: `app/api/billing/route.ts`
- Create: `app/api/billing/status/route.ts`
- Create: `tests/payment-service.test.mjs`
- Create: `tests/payment-routes.test.mjs`

**Interfaces:**
- Produces: `createCheckout(user)`, `getBillingSnapshot(user)`, `initializeFreedomPayPayment(input)`.
- Consumes: server plan `ademi_mind_30d`, payment config and signing helpers.

- [ ] **Step 1: Write failing server-price and ownership tests**

```js
test("checkout ignores client price and uses the active plan", async () => {
  const checkout = await createCheckoutFixture({ body: { amount: 1 } });
  assert.equal(checkout.amountMinor, 99000);
  assert.equal(checkout.currency, "KGS");
  assert.equal(checkout.durationDays, 30);
});

test("billing status is scoped to the authenticated owner", async () => {
  const response = await billingStatusFixture({ requestedOrderUser: "other-user" });
  assert.equal(response.status, 404);
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `node --test tests/payment-service.test.mjs tests/payment-routes.test.mjs`

Expected: FAIL because checkout services and status route do not exist.

- [ ] **Step 3: Implement Freedom Pay initialization**

```ts
export async function initializeFreedomPayPayment(input: FreedomPayCheckoutInput) {
  const config = getPaymentConfig();
  const params = {
    pg_merchant_id: config.merchantId,
    pg_order_id: input.orderId,
    pg_amount: minorToDecimal(input.amountMinor),
    pg_currency: input.currency,
    pg_description: "ADEMI MIND - 30 days",
    pg_salt: crypto.randomUUID().replaceAll("-", ""),
    pg_result_url: `${config.appBaseUrl}/api/billing/callback/freedompay`,
    pg_success_url: `${config.appBaseUrl}/mind?payment=success&orderId=${encodeURIComponent(input.orderId)}`,
    pg_failure_url: `${config.appBaseUrl}/mind?payment=failed&orderId=${encodeURIComponent(input.orderId)}`,
  };
  const signed = { ...params, pg_sig: signFreedomPay("init_payment.php", params, config.secretKey) };
  const response = await fetch(`${config.apiBase}/init_payment.php`, { method: "POST", body: new URLSearchParams(signed) });
  return parseFreedomPayXml(await readBoundedText(response, 65536));
}
```

- [ ] **Step 4: Create pending payment before external initialization**

```ts
const orderId = crypto.randomUUID();
const paymentId = crypto.randomUUID();
await db.insert(payments).values({
  id: paymentId,
  userId: user.id,
  planId: plan.id,
  provider: "freedompay",
  externalPaymentId: `local:${orderId}`,
  orderId,
  amountMinor: plan.priceMinor,
  currency: plan.currency,
  status: "pending",
  mode: config.mode,
});
```

On provider failure, update only `status: "failed"` and a stable `failureCode`; never store the raw error.

- [ ] **Step 5: Replace billing GET/POST contracts**

```ts
// GET
return Response.json({
  plan: { code: plan.code, name: plan.name, priceMinor: plan.priceMinor, currency: plan.currency, durationDays: plan.durationDays },
  access,
  payment: latestPayment ? publicPayment(latestPayment) : null,
  provider: { name: "freedompay", mode: config.mode, configured, simulator: config.simulator },
}, privateNoStore);

// POST
return Response.json(
  { orderId: checkout.orderId, status: "pending", checkoutUrl: checkout.redirectUrl },
  { status: 201, headers: privateNoStore.headers },
);
```

- [ ] **Step 6: Implement ownership-scoped status**

`GET /api/billing/status?orderId=` selects by both `payments.orderId` and authenticated `user.id`; it returns `404` rather than revealing another user's order.

- [ ] **Step 7: Run route tests and commit**

Run: `node --test tests/payment-service.test.mjs tests/payment-routes.test.mjs`

Expected: PASS for price authority, safe redirect validation, provider failure and ownership.

```powershell
git add lib/server/payments app/api/billing tests/payment-service.test.mjs tests/payment-routes.test.mjs
git diff --cached --name-only
git commit -m "feat: initialize Freedom Pay checkout"
```

---

### Task 7: Idempotent callback, membership activation and local simulator

**Files:**
- Create: `lib/server/payments/membership.ts`
- Create: `app/api/billing/callback/freedompay/route.ts`
- Create: `app/api/billing/simulate/route.ts`
- Modify: `lib/server/payments/service.ts`
- Modify: `tests/payment-service.test.mjs`
- Modify: `tests/payment-routes.test.mjs`

**Interfaces:**
- Produces: `activateSuccessfulPayment(input)`, `processFreedomPayCallback(params)`, test-only simulator route.
- Consumes: payment row, seeded plan and protocol helpers.

- [ ] **Step 1: Write duplicate and extension tests**

```js
test("duplicate callback does not extend twice", async () => {
  const first = await processValidCallback(fixture);
  const second = await processValidCallback(fixture);
  assert.equal(first.membershipId, second.membershipId);
  assert.equal(await countMembershipsForPayment(fixture.providerPaymentId), 1);
});

test("a paid renewal starts after current access", async () => {
  const now = 1_800_000_000_000;
  const currentEndsAt = now + 5 * DAY_MS;
  const result = await activateFixture({ now, currentEndsAt });
  assert.equal(result.startsAt, currentEndsAt);
  assert.equal(result.endsAt, currentEndsAt + 30 * DAY_MS);
});
```

- [ ] **Step 2: Run and verify failures**

Run: `node --test tests/payment-service.test.mjs tests/payment-routes.test.mjs`

Expected: FAIL because callback processing is absent.

- [ ] **Step 3: Implement deterministic activation**

```ts
export async function activateSuccessfulPayment(input: ActivationInput) {
  const db = getDb();
  const startsAt = Math.max(input.now, input.currentEndsAt ?? input.now);
  const endsAt = startsAt + input.durationDays * 86_400_000;
  const membershipId = `payment:${input.providerPaymentId}`;
  await db.batch([
    db.insert(memberships).values({
      id: membershipId,
      userId: input.userId,
      planId: input.planId,
      status: "active",
      source: "payment",
      provider: "freedompay",
      providerSubscriptionId: input.providerPaymentId,
      startsAt,
      endsAt,
    }).onConflictDoNothing(),
    db.update(payments).set({
      status: "paid",
      providerPaymentId: input.providerPaymentId,
      completedAt: input.now,
      activationAppliedAt: input.now,
      updatedAt: input.now,
    }).where(and(eq(payments.id, input.paymentId), isNull(payments.activationAppliedAt))),
  ]);
  return { membershipId, startsAt, endsAt };
}
```

- [ ] **Step 4: Verify and process the callback before changing state**

The callback accepts bounded `application/x-www-form-urlencoded` or `multipart/form-data`, verifies signature, merchant, order, provider payment ID, amount `990.00`, currency `KGS` and mode. Its deterministic event key is `${pg_payment_id}:${pg_result}`. Build and persist the signed Freedom Pay response so a duplicate returns the same XML. The signature script name is derived with `scriptBasename(new URL(request.url).pathname)`; for this route it is `freedompay`.

```ts
const callbackScript = scriptBasename(new URL(request.url).pathname);
if (!verifyFreedomPaySignature(callbackScript, params, config.secretKey))
  return signedFreedomPayError("invalid_signature", 400);
const payment = await ownedPaymentByOrder(params.pg_order_id);
assertCallbackMatchesPayment(params, payment, config);
const result = await processFreedomPayCallback(params);
return new Response(result.responseBody, {
  status: result.responseStatus,
  headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" },
});
```

- [ ] **Step 5: Add the development-only simulator**

```ts
const config = getPaymentConfig();
if (!config.simulator || runtimeEnv().APP_ENV === "production")
  throw new ApiError(404, "Страница не найдена", "not_found");
const user = await requireAppUser();
const payment = await requireOwnedPendingPayment(user.id, orderId);
return Response.json(await simulateSuccessfulPayment(payment), { headers: { "Cache-Control": "private, no-store" } });
```

- [ ] **Step 6: Run callback, concurrency and simulator tests**

Run: `node --test tests/payment-service.test.mjs tests/payment-routes.test.mjs`

Expected: PASS for invalid signature/merchant/amount/currency, duplicate callback, two concurrent deliveries, expired membership, active extension and production simulator denial.

- [ ] **Step 7: Commit payment activation**

```powershell
git add lib/server/payments app/api/billing/callback app/api/billing/simulate tests/payment-service.test.mjs tests/payment-routes.test.mjs
git diff --cached --name-only
git commit -m "feat: activate memberships from Freedom Pay"
```

---

### Task 8: Account API, safe telemetry and backend release gate

**Files:**
- Create: `lib/server/ai/telemetry.ts`
- Modify: `app/api/me/route.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `app/api/billing/route.ts`
- Modify: `worker/index.ts`
- Create: `tests/backend-release.test.mjs`

**Interfaces:**
- Produces: effective `MeResponse`, safe AI events and consistent private caching.
- Consumes: `resolvePaidAccess()`, `getAiReadiness()`, `getBillingSnapshot()`.

- [ ] **Step 1: Write response-shape and no-secret tests**

```js
test("account and billing responses expose readiness but no secrets", async () => {
  const sources = await Promise.all([
    readFile(new URL("../app/api/me/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/billing/route.ts", import.meta.url), "utf8"),
  ]);
  const combined = sources.join("\n");
  assert.match(combined, /hasAccess/);
  assert.match(combined, /ademi-guided-v1/);
  assert.doesNotMatch(combined, /secretKey\s*:/);
});
```

- [ ] **Step 2: Run and verify the current response is stale**

Run: `node --test tests/backend-release.test.mjs`

Expected: FAIL because `/api/me` still reports legacy OpenAI/payment readiness.

- [ ] **Step 3: Return effective access and safe service summaries**

```ts
const access = await resolvePaidAccess(user);
return Response.json({
  authenticated: true,
  user: publicUser(user),
  hasAccess: access.hasAccess,
  membership: { source: access.source, endsAt: access.endsAt },
  consentRequired: user.consentVersion !== CONSENT_VERSION,
  services: {
    ai: getAiReadiness(),
    payments: getPaymentReadiness(),
  },
}, { headers: { "Cache-Control": "private, no-store" } });
```

- [ ] **Step 4: Persist metadata-only provider events**

```ts
await recordAiProviderEvent({
  requestId,
  userId: user.id,
  provider: answer.answerMode === "generative" ? "workers_ai" : "guided",
  model: answer.model,
  answerMode: answer.answerMode,
  outcome: answer.fallbackReason ? "fallback" : "success",
  reasonCode: answer.fallbackReason,
  inputTokens: answer.inputTokens,
  outputTokens: answer.outputTokens,
  latencyMs,
});
```

Do not pass `message`, `answer.text`, history, owner reference or crisis text to this function.

- [ ] **Step 5: Apply security headers to every Worker response path**

Extract `withSecurityHeaders(response, request)` and invoke it for both `/_vinext/image` and app-router responses. Add `object-src 'none'`; add HSTS only when `new URL(request.url).protocol === "https:"`.

- [ ] **Step 6: Run the full backend gate**

Run:

```powershell
npm run typecheck
npm run lint
npm run build
npm run test:node
```

Expected: every command exits 0; all current and new tests run, and client chunks contain no owner corpus, course corpus or secret names.

- [ ] **Step 7: Commit the backend release slice**

```powershell
git add lib/server/ai/telemetry.ts app/api/me/route.ts app/api/chat/route.ts app/api/billing/route.ts worker/index.ts tests/backend-release.test.mjs
git diff --cached --name-only
git commit -m "feat: finalize secure paid backend"
```
