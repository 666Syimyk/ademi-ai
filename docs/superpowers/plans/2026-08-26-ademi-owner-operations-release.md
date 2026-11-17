# ADEMI Owner Operations and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать владельцу безопасный кабинет управления участниками, материалами и статусами сервисов, затем завершить конфигурацию, документацию и production release gate.

**Architecture:** Owner API остаётся изолированным серверным контуром с общей проверкой владельца, строгой валидацией, bounded pagination и безопасными response DTO. Материалы доступны участникам сразу после сохранения в R2, а внешняя индексация становится независимым необязательным статусом. Публичный health дешёвый, расширенный readiness доступен только владельцу.

**Tech Stack:** TypeScript, Next.js/vinext, Cloudflare D1/R2/Workers AI, Drizzle ORM, React, CSS Modules, Node test runner, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-26-ademi-mind-universe-design.md`

## Global Constraints

- Кабинет и admin API доступны только роли `owner`, совпадающей с настроенным `ADEMI_OWNER_EMAIL`.
- Owner research, raw audit metadata, message content, secret values, file keys, hashes and provider payloads never enter client responses.
- Membership grants extend from `max(now, current active endsAt)` and never alter the owner.
- Member pagination is bounded to 50 rows and stable by `(createdAt DESC, id DESC)`.
- Stored member material becomes downloadable immediately; OpenAI indexing status never gates R2 delivery.
- Public `/api/health` performs no D1/R2/AI/payment I/O.
- Owner status performs no live AI inference and no payment request.
- Package name is `ademi-mind`; compatibility date is `2026-08-26`.
- Simulator is rejected whenever `APP_ENV=production`.
- Do not modify generated `dist/**` or invent unsupported fields in `.openai/hosting.json`.
- Preserve every pre-existing dirty/untracked user file and stage only files named by the active task.

---

### Task 1: Shared owner/admin contracts and timed membership service

**Files:**
- Create: `lib/shared/admin.ts`
- Create: `lib/server/memberships.ts`
- Modify: `lib/server/auth.ts`
- Create: `tests/admin-backend.test.mjs`

**Interfaces:**
- Produces: `AdminMember`, `AdminMembership`, `MemberMutation`, `grantTimedAccess()`, `isConfiguredOwner()`.
- Consumes: existing Drizzle `users`, `memberships`, `plans`, `auditEvents`.

- [ ] **Step 1: Write failing scheduling and owner tests**

```js
test("manual access extends current time-bound access", async () => {
  const now = 1_800_000_000_000;
  const currentEndsAt = now + 5 * DAY_MS;
  const result = await grantFixture({ now, currentEndsAt, durationDays: 30 });
  assert.equal(result.startsAt, currentEndsAt);
  assert.equal(result.endsAt, currentEndsAt + 30 * DAY_MS);
});

test("configured owner requires role and exact normalized email", () => {
  assert.equal(isConfiguredOwner({ ...student, role: "owner", email: "owner@example.com" }, "owner@example.com"), true);
  assert.equal(isConfiguredOwner({ ...student, role: "student", email: "owner@example.com" }, "owner@example.com"), false);
});
```

- [ ] **Step 2: Run and verify missing contracts**

Run: `node --test tests/admin-backend.test.mjs`

Expected: FAIL because `lib/shared/admin.ts` and `lib/server/memberships.ts` do not exist.

- [ ] **Step 3: Define explicit client-safe DTOs**

```ts
export type AdminMembership = {
  id: string;
  status: "pending" | "trialing" | "active" | "past_due" | "cancelled" | "expired" | "refunded" | "comped";
  source: "manual" | "payment" | "import";
  startsAt: number;
  endsAt: number | null;
  isCurrent: boolean;
};

export type AdminMember = {
  id: string;
  email: string;
  fullName: string | null;
  role: "owner" | "student";
  accountStatus: "active" | "suspended";
  createdAt: number;
  lastSeenAt: number | null;
  memberships: AdminMembership[];
};

export type MemberMutation =
  | { action: "set_account_status"; userId: string; status: "active" | "suspended" }
  | { action: "revoke_membership"; membershipId: string };
```

- [ ] **Step 4: Implement shared timed grants**

```ts
export async function grantTimedAccess(input: GrantTimedAccessInput) {
  const db = getDb();
  const now = input.now ?? Date.now();
  const [latest] = await currentTimedAccess(input.userId, now);
  const startsAt = Math.max(now, latest?.endsAt ?? now);
  const endsAt = startsAt + input.durationDays * 86_400_000;
  const plan = await requirePlan(input.planCode);
  const membershipId = input.membershipId ?? crypto.randomUUID();
  await db.batch([
    db.insert(memberships).values({ id: membershipId, userId: input.userId, planId: plan.id, status: input.source === "manual" ? "comped" : "active", source: input.source, startsAt, endsAt, grantedByUserId: input.grantedByUserId ?? null }),
    db.insert(auditEvents).values({ id: crypto.randomUUID(), actorUserId: input.grantedByUserId ?? null, action: "membership.granted", entityType: "membership", entityId: membershipId, metadataJson: safeJson({ source: input.source, durationDays: input.durationDays }), createdAt: now }),
  ]);
  return { id: membershipId, startsAt, endsAt };
}
```

- [ ] **Step 5: Centralize owner detection in auth**

`requireOwner()` and server page guards call the same `isConfiguredOwner(user)` function. Suspended non-owner users remain denied; configured owner is forced active by the existing identity sync.

- [ ] **Step 6: Run and commit contracts**

Run: `node --test tests/admin-backend.test.mjs`

Expected: PASS for schedule, role/email matching and safe DTO shape.

```powershell
git add lib/shared/admin.ts lib/server/memberships.ts lib/server/auth.ts tests/admin-backend.test.mjs
git diff --cached --name-only
git commit -m "feat: add owner membership services"
```

---

### Task 2: Harden and paginate member administration API

**Files:**
- Modify: `app/api/admin/members/route.ts`
- Modify: `lib/server/http.ts`
- Modify: `tests/admin-backend.test.mjs`

**Interfaces:**
- Produces: bounded member list, validated manual grant, account status mutation and verified membership revocation.
- Consumes: Task 1 DTOs and `grantTimedAccess()`.

- [ ] **Step 1: Add failing validation, pagination and zero-row tests**

```js
test("member list caps limit and returns a stable cursor", async () => {
  const result = await listMembersFixture({ limit: 500, count: 70 });
  assert.equal(result.members.length, 50);
  assert.equal(typeof result.nextCursor, "string");
});

test("revoking an unknown membership returns not found", async () => {
  const response = await patchMemberFixture({ action: "revoke_membership", membershipId: "missing" });
  assert.equal(response.status, 404);
});
```

- [ ] **Step 2: Run and verify failures**

Run: `node --test tests/admin-backend.test.mjs`

Expected: FAIL because the existing endpoint loads all rows and accepts loose payloads.

- [ ] **Step 3: Add strict JSON and same-origin utilities**

```ts
export async function readJsonObject(request: Request, maxBytes = 16_384) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new ApiError(413, "Запрос слишком большой", "payload_too_large");
  const value: unknown = await request.json().catch(() => { throw new ApiError(400, "Некорректный JSON", "invalid_json"); });
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "Некорректный JSON", "invalid_json");
  return value as Record<string, unknown>;
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new ApiError(403, "Запрос отклонён", "origin_mismatch");
}
```

- [ ] **Step 4: Implement bounded cursor listing**

`GET /api/admin/members?query=&limit=50&cursor=` normalizes query to 120 characters, clamps limit from 1–50, decodes a base64url JSON cursor `{ createdAt, id }`, fetches only that user page, then fetches memberships with `inArray(userId, ids)` and groups them in a `Map`.

```ts
return Response.json({
  members: rows.map((user) => toAdminMember(user, membershipMap.get(user.id) ?? [], now)),
  nextCursor: rows.length === limit ? encodeCursor(rows.at(-1)!) : null,
}, { headers: { "Cache-Control": "private, no-store" } });
```

- [ ] **Step 5: Validate mutations and preserve the owner**

POST validates email, Unicode full name and integer `accessDays` in `1..3650`, then calls `grantTimedAccess({ planCode: "ademi_mind_30d", source: "manual" })`. PATCH uses discriminated `action`; it selects the target first, rejects owner modification, and requires a returned row from every update.

- [ ] **Step 6: Run API tests and commit**

Run: `node --test tests/admin-backend.test.mjs`

Expected: PASS for pagination, validation, owner protection, extend semantics and not-found updates.

```powershell
git add app/api/admin/members/route.ts lib/server/http.ts tests/admin-backend.test.mjs
git diff --cached --name-only
git commit -m "feat: harden owner member management"
```

---

### Task 3: Decouple material availability from optional indexing

**Files:**
- Create: `app/api/materials/validation.ts`
- Modify: `app/api/materials/route.ts`
- Modify: `app/api/materials/sync/route.ts`
- Modify: `app/api/materials/download/route.ts`
- Create: `tests/materials-admin.test.mjs`

**Interfaces:**
- Produces: `validateMaterialUpload()`, immediate ready lifecycle, safe owner material DTO and best-effort indexing cleanup.
- Consumes: R2 `MATERIALS`, D1 material tables and optional OpenAI indexing functions.

- [ ] **Step 1: Write failing delivery and cleanup tests**

```js
test("member material is ready without an OpenAI key", async () => {
  const result = await uploadFixture({ visibility: "members", openAiConfigured: false });
  assert.equal(result.material.lifecycle, "ready");
  assert.equal(result.indexing.status, "not_configured");
});

test("a failed D1 insert deletes the newly written R2 object", async () => {
  const bucket = fakeBucket();
  await assert.rejects(() => uploadFixture({ bucket, d1Failure: true }));
  assert.equal(bucket.deletedKeys.length, 1);
});
```

- [ ] **Step 2: Run and verify current behavior fails**

Run: `node --test tests/materials-admin.test.mjs`

Expected: FAIL because member material remains `processing` without OpenAI and R2 cleanup is missing.

- [ ] **Step 3: Implement strict file validation**

```ts
export const materialRules = {
  maxBytes: 20 * 1024 * 1024,
  languages: new Set(["RU", "KG", "EN"]),
  visibilities: new Set(["owner", "members"]),
  categories: new Set(["course", "worksheet", "guide", "research"]),
};

export function hasMaterialSignature(bytes: Uint8Array, mime: string) {
  if (mime === "application/pdf") return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (mime.includes("wordprocessingml")) return bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (mime === "text/plain" || mime === "text/markdown") return !bytes.slice(0, 256).includes(0);
  return false;
}
```

Reject oversized `Content-Length` before `formData()`, then enforce actual `File.size`, extension/MIME pairing, signature, non-empty normalized title and allowlisted metadata.

- [ ] **Step 4: Mark stored material ready independently of indexing**

```ts
lifecycle: "ready",
publishedAt: visibility === "members" ? now : null,
```

Keep `materialVersions.extractionStatus` as `stored`, `processing`, `ready` or `failed`. Return `indexing.status: "not_configured"` when no OpenAI key exists. Downloads check member visibility plus material lifecycle `ready`, not extraction status.

- [ ] **Step 5: Add compensating R2 cleanup and archive-first behavior**

Wrap the D1 creation batch in `try/catch`; call `MATERIALS.delete(r2Key)` before rethrowing. During archive, update D1 first, then attempt external index cleanup; on failure write a safe audit code without republishing the material.

- [ ] **Step 6: Return a safe owner material DTO**

```ts
export type AdminMaterial = {
  id: string;
  title: string;
  category: string;
  language: "RU" | "KG" | "EN";
  visibility: "owner" | "members";
  lifecycle: "draft" | "ready" | "archived";
  updatedAt: number;
  version: { filename: string; mimeType: string; sizeBytes: number; indexingStatus: "stored" | "processing" | "ready" | "failed"; indexedAt: number | null; errorCode: string | null };
};
```

Exclude R2 keys, hashes and OpenAI identifiers.

- [ ] **Step 7: Run and commit material hardening**

Run: `node --test tests/materials-admin.test.mjs`

Expected: PASS for signatures, size, allowlists, readiness, cleanup, archive and safe DTO.

```powershell
git add app/api/materials tests/materials-admin.test.mjs
git diff --cached --name-only
git commit -m "feat: make course materials reliably available"
```

---

### Task 4: Public health and private owner readiness

**Files:**
- Create: `app/api/health/route.ts`
- Create: `app/api/admin/status/route.ts`
- Create: `lib/server/admin-status.ts`
- Create: `lib/shared/status.ts`
- Create: `tests/admin-status.test.mjs`

**Interfaces:**
- Produces: cheap public liveness and bounded owner-only service snapshot.
- Consumes: safe AI/payment readiness functions from backend plan, D1 counts, R2 list and allowlisted audit events.

- [ ] **Step 1: Write failing liveness and no-secret tests**

```js
test("public health performs no dependency probes", async () => {
  const response = await healthFixture();
  assert.deepEqual(await response.json(), { status: "ok", service: "ademi-mind" });
  assert.equal(probeCount(), 0);
});

test("owner status discards raw audit metadata and identifiers", async () => {
  const snapshot = await statusFixture({ metadataJson: '{"secret":"value"}', entityId: "private-id" });
  const encoded = JSON.stringify(snapshot);
  assert.doesNotMatch(encoded, /secret|private-id|merchant/i);
});
```

- [ ] **Step 2: Run and verify endpoints are missing**

Run: `node --test tests/admin-status.test.mjs`

Expected: FAIL for missing routes.

- [ ] **Step 3: Implement cheap public liveness**

```ts
export async function GET() {
  return Response.json(
    { status: "ok", service: "ademi-mind" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
```

- [ ] **Step 4: Define the safe status contract**

```ts
export type ServiceStatus = { state: "operational" | "degraded" | "unavailable"; code: string };
export type AdminStatus = {
  overall: ServiceStatus["state"];
  checkedAt: number;
  services: {
    database: ServiceStatus;
    storage: ServiceStatus;
    ai: ServiceStatus & { provider: "cloudflare"; model: string; fallback: "ademi-guided-v1" };
    payments: ServiceStatus & { provider: "freedompay"; mode: "test" | "production" };
    indexing: ServiceStatus;
  };
  counts: { members: number; activeMemberships: number; materials: number; failedIndexes: number };
  recentEvents: Array<{ action: string; createdAt: number }>;
};
```

- [ ] **Step 5: Probe dependencies with bounded queries**

Use `Promise.allSettled()` for four D1 aggregate queries and `MATERIALS.list({ limit: 1 })`. AI/payment readiness checks configuration only. Map recent audit actions through `new Set(["membership.granted", "membership.revoked", "material.uploaded", "material.archived"])` and discard all metadata and IDs.

- [ ] **Step 6: Protect the readiness route and run tests**

`GET /api/admin/status` calls `requireOwner()` before `buildAdminStatus()` and responds `private, no-store`.

Run: `node --test tests/admin-status.test.mjs`

Expected: PASS for public liveness, owner denial, bounded probes, degraded states and secret exclusion.

- [ ] **Step 7: Commit service status**

```powershell
git add app/api/health app/api/admin/status lib/server/admin-status.ts lib/shared/status.ts tests/admin-status.test.mjs
git diff --cached --name-only
git commit -m "feat: add safe ADEMI service readiness"
```

---

### Task 5: Isolated owner dashboard

**Files:**
- Create: `app/admin/page.tsx`
- Create: `components/admin/admin-dashboard.tsx`
- Create: `components/admin/member-panel.tsx`
- Create: `components/admin/material-panel.tsx`
- Create: `components/admin/service-status-panel.tsx`
- Create: `components/admin/technical-event-list.tsx`
- Create: `components/admin/admin.module.css`
- Create: `lib/client/admin-api.ts`
- Create: `tests/components/admin-dashboard.test.tsx`
- Create: `tests/admin-ui.test.mjs`

**Interfaces:**
- Produces: protected `/admin`, member/material/status workflows and client API wrapper.
- Consumes: Tasks 1–4 APIs and shared DTOs.

- [ ] **Step 1: Write role-isolation and interaction tests**

```tsx
it("loads members, materials and status in parallel", async () => {
  render(<AdminDashboard />);
  await waitFor(() => expect(requestedPaths()).toEqual(expect.arrayContaining([
    "/api/admin/members?limit=50",
    "/api/materials",
    "/api/admin/status",
  ])));
});

it("announces a successful manual grant", async () => {
  render(<MemberPanel initialMembers={[]} />);
  await user.type(screen.getByLabelText(/email/i), "student@example.com");
  await user.click(screen.getByRole("button", { name: /выдать доступ/i }));
  expect(await screen.findByRole("status")).toHaveTextContent(/выдан/i);
});
```

- [ ] **Step 2: Run and verify missing dashboard**

Run: `npx vitest run tests/components/admin-dashboard.test.tsx`

Expected: FAIL for missing admin components.

- [ ] **Step 3: Protect the server route before rendering client code**

```tsx
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getAppUser();
  if (!user) redirect(chatGPTSignInPath("/admin"));
  if (!isConfiguredOwner(user)) notFound();
  return <AdminDashboard />;
}
```

- [ ] **Step 4: Implement the typed admin client**

```ts
export const adminApi = {
  listMembers: (query = "", cursor?: string, signal?: AbortSignal) => apiRequest<AdminMemberPage>(`/api/admin/members?limit=50&query=${encodeURIComponent(query)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { signal }),
  grantManualAccess: (input: GrantManualAccessInput) => apiRequest("/api/admin/members", jsonMutation("POST", input)),
  setMemberStatus: (userId: string, status: "active" | "suspended") => apiRequest("/api/admin/members", jsonMutation("PATCH", { action: "set_account_status", userId, status })),
  revokeMembership: (membershipId: string) => apiRequest("/api/admin/members", jsonMutation("PATCH", { action: "revoke_membership", membershipId })),
  getStatus: (signal?: AbortSignal) => apiRequest<AdminStatus>("/api/admin/status", { signal }),
};
```

- [ ] **Step 5: Build accessible member, material and service panels**

Use semantic tables with captions and `scope="col"`, labeled forms, `aria-busy`, `role="status"`/`role="alert"`, text plus color for states, focus-managed confirmation dialogs and stacked cards at 320 px. Poll owner status at most every 60 seconds only while `document.visibilityState === "visible"`; include manual refresh.

- [ ] **Step 6: Keep owner-only code out of the student shell**

The student app shell contains a plain conditional link to `/admin`; it does not import any `components/admin/*` module. Do not call `/api/admin/research` from the dashboard by default.

- [ ] **Step 7: Run UI and source-boundary tests**

Run: `npx vitest run tests/components/admin-dashboard.test.tsx && node --test tests/admin-ui.test.mjs`

Expected: PASS for role gate, parallel loading, pagination, mutations, keyboard dialogs, polling cleanup and absence of owner research in student chunks.

- [ ] **Step 8: Commit the owner dashboard**

```powershell
git add app/admin components/admin lib/client/admin-api.ts tests/components/admin-dashboard.test.tsx tests/admin-ui.test.mjs
git diff --cached --name-only
git commit -m "feat: add ADEMI owner operations dashboard"
```

---

### Task 6: Runtime identity, documentation and production release gate

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Modify: `vite.config.ts`
- Modify: `lib/server/runtime.ts`
- Modify: `worker/index.ts`
- Rewrite: `README.md`
- Create: `docs/production-runbook.md`
- Create: `tests/production-smoke.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: deployable package identity, complete runbook, universal security headers and one-command release check.
- Consumes: all earlier backend/frontend/admin work.

- [ ] **Step 1: Write failing production smoke assertions**

```js
test("built public responses carry the complete security policy", async () => {
  const response = await renderBuilt("/");
  const csp = response.headers.get("content-security-policy") ?? "";
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("client chunks contain no secret configuration names", async () => {
  const bundle = await readClientBundle();
  assert.doesNotMatch(bundle, /FREEDOMPAY_SECRET_KEY|OPENAI_API_KEY|ADEMI_OWNER_EMAIL/);
});
```

- [ ] **Step 2: Run and verify current release gaps**

Run: `npm run build && node --test tests/production-smoke.test.mjs`

Expected: FAIL for missing health route in the build, incomplete CSP or stale starter identity.

- [ ] **Step 3: Rename package and runtime resources**

Set both package manifests to `"name": "ademi-mind"`. In `vite.config.ts`, set local names such as `ademi-mind-d1` and `ademi-mind-r2`, `compatibility_date: "2026-08-26"`, retain `nodejs_compat`, and configure AI only through the verified Cloudflare binding shape. Do not edit generated `dist/server/wrangler.json`.

- [ ] **Step 4: Centralize security headers for every response**

```ts
function withSecurityHeaders(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  if (new URL(request.url).protocol === "https:") headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
```

Apply it to both image optimization and app-router responses.

- [ ] **Step 5: Rewrite README as a deployable product guide**

README must contain product/safety boundaries, route map, Node requirement, local setup, D1/R2/AI bindings, migrations, all environment names with secret/non-secret labels, Freedom Pay sandbox and simulator, merchant cutover, tests, deployment, rollback and 112 guidance. It must state that production Freedom Pay requires real merchant credentials and legal identity/contact details.

- [ ] **Step 6: Add a production runbook**

`docs/production-runbook.md` contains staging migration order, binding verification, role matrix, Freedom Pay sandbox checklist, simulator production-denial check, health/readiness checks, log-safe incident triage and rollback steps. Use exact command names from package scripts.

- [ ] **Step 7: Define the complete release scripts**

```json
"typecheck": "tsc --noEmit --incremental false",
"test:components": "vitest run",
"test:node": "node --test \"tests/*.test.mjs\"",
"test": "npm run test:components && npm run build && npm run test:node",
"check": "npm run typecheck && npm run lint && npm test"
```

- [ ] **Step 8: Run the mandatory release gate**

Run:

```powershell
npm run check
npm run build
```

Expected: TypeScript, ESLint, component tests, every Node test, build and production smoke checks all exit 0.

- [ ] **Step 9: Perform the production-shaped checklist**

Verify DB/R2/AI binding names, migrations `0000` through `0003`, simulator denial in production, anonymous/student/expired/active/owner matrix, manual grants/revokes, material upload/download/archive/index retry, no secret strings in repository or client bundle, keyboard navigation, 320 px, reduced motion, WebGL fallback, hidden-tab loop suspension, public health and private owner readiness.

- [ ] **Step 10: Commit release documentation and configuration**

```powershell
git add package.json package-lock.json .env.example vite.config.ts lib/server/runtime.ts worker/index.ts README.md docs/production-runbook.md tests/production-smoke.test.mjs tests/rendered-html.test.mjs
git diff --cached --name-only
git commit -m "docs: prepare ADEMI MIND production release"
```
