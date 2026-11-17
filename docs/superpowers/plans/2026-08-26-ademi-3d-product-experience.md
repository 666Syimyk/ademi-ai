# ADEMI 3D Product Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить публичную премиальную 3D-страницу и перенести существующее приложение в защищённый `/mind` с завершёнными чатовым, профильным и платёжным сценариями.

**Architecture:** `/` становится серверно отрисованной маркетинговой страницей, `/mind` — динамическим защищённым приложением. Один динамически загружаемый Three.js runtime создаёт 3D-ядро, а CSS fallback, reduced-motion и мобильный бюджет гарантируют доступность. Текущий монолит делится на независимые компоненты и hooks, которые используют серверные API-контракты из backend-плана.

**Tech Stack:** React 19, TypeScript, Next.js/vinext, Three.js, CSS Modules, Vitest, Testing Library, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-26-ademi-mind-universe-design.md`

## Global Constraints

- Сохранять существующую сливово-золотую айдентику и знак `A`.
- Цена и срок приходят от сервера; интерфейс ожидает 990 KGS / 30 дней и явно сообщает об отсутствии автопродления.
- Публичная страница не загружает `/api/me`, историю, owner research или course corpus.
- `/mind` требует Sign in with ChatGPT и использует return path `/mind`.
- Обычный composer недоступен без подписки; отдельный crisis entry остаётся доступным и ведёт к локальной safety-ветке backend.
- Three.js не загружается при reduced motion или отсутствии WebGL; DPR ограничен `1.5` на desktop и `1` на mobile.
- Render loop останавливается в скрытой вкладке и полностью освобождается при unmount/context loss.
- Основные тексты имеют WCAG AA contrast, доступ с клавиатуры и корректную работу от 320 px.
- RU, KG и EN остаются поддерживаемыми во всех продуктовых сценариях.
- Существующие незакоммиченные изменения `app/page.tsx`, `app/globals.css`, legal pages и tests сохраняются и изменяются точечно.

---

### Task 1: Shared frontend contracts, localization and component test harness

**Files:**
- Create: `lib/shared/contracts.ts`
- Create: `lib/i18n/marketing.ts`
- Create: `lib/i18n/mind.ts`
- Create: `lib/client/api.ts`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/components/contracts.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `Language`, `ThemeMode`, `MeResponse`, `ChatResponse`, `BillingResponse`, `apiRequest()` and localized copy accessors.
- Consumes: backend JSON shapes established by the backend plan.

- [ ] **Step 1: Install exact runtime and test dependencies**

Run:

```powershell
npm install three@0.185.1
npm install --save-dev @types/three@0.185.4 vitest@4.1.11 jsdom@27.4.0 @testing-library/react@16.3.2 @testing-library/dom@10.4.1 @testing-library/user-event@14.6.6 @testing-library/jest-dom@7.0.1
```

Expected: package lock changes only through npm and React remains at the current project version.

- [ ] **Step 2: Write failing contract/localization tests**

```ts
import { describe, expect, it } from "vitest";
import { normalizeLanguage } from "../../lib/shared/contracts";
import { marketingCopy } from "../../lib/i18n/marketing";

describe("public contracts", () => {
  it("normalizes an unsupported language to RU", () => {
    expect(normalizeLanguage("DE")).toBe("RU");
  });
  it.each(["RU", "KG", "EN"] as const)("has a complete %s price card", (language) => {
    expect(marketingCopy[language].pricing.price).toContain("990");
    expect(marketingCopy[language].pricing.period.length).toBeGreaterThan(5);
    expect(marketingCopy[language].pricing.autoRenewal).toBe(false);
  });
});
```

- [ ] **Step 3: Run and verify missing modules**

Run: `npx vitest run tests/components/contracts.test.ts`

Expected: FAIL because shared contracts and marketing copy do not exist.

- [ ] **Step 4: Define the shared response contracts**

```ts
export type Language = "RU" | "KG" | "EN";
export type ThemeMode = "system" | "light" | "dark";
export type AnswerMode = "generative" | "guided";

export type MeResponse = {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    fullName: string | null;
    role: "owner" | "student";
    preferredLanguage: Language;
    historyEnabled: boolean;
    avatarUrl: string | null;
    profileCompletedAt: number | null;
  };
  hasAccess?: boolean;
  consentRequired?: boolean;
  membership?: { source: "owner" | "membership" | null; endsAt: number | null };
  services?: { ai: { answerMode: AnswerMode; model: string; fallback: string } };
};

export type BillingResponse = {
  plan: { code: string; name: string; priceMinor: number; currency: "KGS"; durationDays: 30 };
  access: { hasAccess: boolean; endsAt: number | null };
  payment: { orderId: string; status: "pending" | "paid" | "failed" } | null;
  provider: { name: "freedompay"; mode: "test" | "production"; configured: boolean; simulator: boolean };
};
```

- [ ] **Step 5: Implement a single safe API client**

```ts
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({})) as { error?: string; code?: string };
  if (!response.ok) throw new ClientApiError(response.status, body.code ?? "request_error", body.error ?? "Request failed");
  return body as T;
}
```

- [ ] **Step 6: Configure jsdom tests and scripts**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "jsdom", setupFiles: ["./tests/setup.ts"], include: ["tests/components/**/*.test.ts?(x)"] },
});
```

```json
"test:components": "vitest run",
"test:node": "node --test \"tests/*.test.mjs\"",
"test": "npm run test:components && npm run build && npm run test:node"
```

- [ ] **Step 7: Run and commit the frontend foundation**

Run: `npm run test:components`

Expected: PASS.

```powershell
git add package.json package-lock.json vitest.config.ts tests/setup.ts tests/components/contracts.test.ts lib/shared/contracts.ts lib/i18n/marketing.ts lib/i18n/mind.ts lib/client/api.ts
git diff --cached --name-only
git commit -m "feat: add ADEMI frontend contracts"
```

---

### Task 2: Server-rendered public landing page

**Files:**
- Replace: `app/page.tsx`
- Create: `components/marketing/landing-page.tsx`
- Create: `components/marketing/marketing-header.tsx`
- Create: `components/marketing/hero.tsx`
- Create: `components/marketing/features.tsx`
- Create: `components/marketing/safety.tsx`
- Create: `components/marketing/product-demo.tsx`
- Create: `components/marketing/pricing.tsx`
- Create: `components/marketing/faq.tsx`
- Create: `components/marketing/footer.tsx`
- Create: `components/marketing/marketing.module.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: permanent public route `/` and sign-in CTA with return path `/mind`.
- Consumes: `marketingCopy`, `getChatGPTUser()`, `chatGPTSignInPath()` and an immediately rendered `<MindUniverse>` CSS fallback whose runtime is completed in Task 3.

- [ ] **Step 1: Replace the old loading-shell test with public-page assertions**

```js
test("server-renders the complete public ADEMI offer", async () => {
  const response = await render("/?lang=RU");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /ADEMI MIND/);
  assert.match(html, /990/);
  assert.match(html, /30 (дней|дня)/u);
  assert.match(html, /112/);
  assert.match(html, /privacy|конфиденциаль/u);
  assert.match(html, /return_to=%2Fmind/);
  assert.doesNotMatch(html, /Создаём безопасное пространство/u);
});
```

- [ ] **Step 2: Run the targeted render test and verify failure**

Run: `npm run build && node --test tests/rendered-html.test.mjs`

Expected: FAIL on pricing, FAQ or permanent public-route assertions.

- [ ] **Step 3: Make `/` a server component with language normalization**

```tsx
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const language = normalizeLanguage(lang);
  const user = await getChatGPTUser();
  const ctaHref = user ? "/mind" : chatGPTSignInPath("/mind");
  return <LandingPage language={language} ctaHref={ctaHref} />;
}
```

- [ ] **Step 4: Render the complete semantic page**

```tsx
export function LandingPage({ language, ctaHref }: Props) {
  const copy = marketingCopy[language];
  return (
    <div lang={language === "KG" ? "ky" : language.toLowerCase()} className={styles.page}>
      <MarketingHeader ctaHref={ctaHref} copy={copy.header} />
      <main>
        <Hero ctaHref={ctaHref} copy={copy.hero} />
        <Features copy={copy.features} />
        <Safety copy={copy.safety} />
        <ProductDemo copy={copy.demo} />
        <Pricing ctaHref={ctaHref} copy={copy.pricing} />
        <Faq items={copy.faq} />
      </main>
      <MarketingFooter language={language} copy={copy.footer} />
    </div>
  );
}
```

The pricing card displays server-agreed copy `990 сом`, `30 дней`, `одноразовая оплата`, `без автоматического списания`. The safety section distinguishes education from diagnosis and always exposes `/safety` plus `tel:112` for immediate danger.

- [ ] **Step 5: Render RU, KG and EN variants**

Add table-driven assertions for `/?lang=RU`, `/?lang=KG` and `/?lang=EN`; verify the content container language and localized CTA/period text.

- [ ] **Step 6: Run tests and commit the public page**

Run: `npm run build && node --test tests/rendered-html.test.mjs`

Expected: PASS and the browser bundle still excludes owner research and the protected course corpus.

```powershell
git add app/page.tsx components/marketing lib/i18n/marketing.ts tests/rendered-html.test.mjs
git diff --cached --name-only
git commit -m "feat: build ADEMI public experience"
```

---

### Task 3: Progressive Mind Universe 3D scene

**Files:**
- Create: `components/brand/brand-mark.tsx`
- Create: `components/brand/mind-universe.tsx`
- Create: `components/brand/mind-runtime.ts`
- Create: `components/brand/brand.module.css`
- Create: `tests/components/mind-universe.test.tsx`

**Interfaces:**
- Produces: `<MindUniverse active={boolean} compact={boolean} />`, `mountMindRuntime(canvas, options)` and deterministic `dispose()`.
- Consumes: `three` only inside the dynamically imported runtime.

- [ ] **Step 1: Write failing progressive-enhancement tests**

```tsx
it("keeps the static fallback when reduced motion is requested", async () => {
  mockReducedMotion(true);
  const loader = vi.fn();
  render(<MindUniverse active={false} runtimeLoader={loader} />);
  expect(screen.getByTestId("mind-fallback")).toBeVisible();
  expect(loader).not.toHaveBeenCalled();
});

it("disposes the runtime on unmount", async () => {
  const dispose = vi.fn();
  const { unmount } = render(<MindUniverse active runtimeLoader={async () => ({ mountMindRuntime: () => ({ dispose, setActive: vi.fn(), setPaused: vi.fn() }) })} />);
  await waitFor(() => expect(dispose).not.toHaveBeenCalled());
  unmount();
  expect(dispose).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run and verify the component is missing**

Run: `npx vitest run tests/components/mind-universe.test.tsx`

Expected: FAIL for missing brand component.

- [ ] **Step 3: Implement SSR fallback and capability checks**

```tsx
export function MindUniverse({ active, compact = false, runtimeLoader = () => import("./mind-runtime") }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<MindRuntime | null>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas || !canvas.getContext("webgl2")) return;
    let runtime: MindRuntime | undefined;
    let cancelled = false;
    runtimeLoader().then(({ mountMindRuntime }) => {
      if (!cancelled) {
        runtime = mountMindRuntime(canvas, { compact, active });
        runtimeRef.current = runtime;
      }
    });
    return () => { cancelled = true; runtime?.dispose(); runtimeRef.current = null; };
  }, [compact]);
  useEffect(() => { runtimeRef.current?.setActive(active); }, [active]);
  useEffect(() => { runtimeRef.current?.setPaused(paused); }, [paused]);
  return (
    <div className={styles.universe} data-active={active}>
      <div data-testid="mind-fallback" className={styles.fallback} aria-hidden="true" />
      <canvas ref={canvasRef} aria-hidden="true" />
      <button type="button" onClick={() => setPaused((value) => !value)}>{paused ? "Включить анимацию" : "Остановить анимацию"}</button>
    </div>
  );
}
```

- [ ] **Step 4: Implement the bounded Three.js runtime**

`mountMindRuntime()` creates one core mesh, two orbit line loops, 120 desktop or 42 compact particles, warm point lights and a transparent renderer. Cap pixel ratio, use fine-pointer parallax only, pause on `visibilitychange`, handle `webglcontextlost`, and remove every listener/material/geometry on dispose.

```ts
export type MindRuntime = { setActive(value: boolean): void; setPaused(value: boolean): void; dispose(): void };

export function mountMindRuntime(canvas: HTMLCanvasElement, options: MindRuntimeOptions): MindRuntime {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !options.compact, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, options.compact ? 1 : 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const resources = createMindScene(scene, options.compact ? 42 : 120);
  return createManagedLoop({ renderer, scene, camera, resources, canvas, active: options.active });
}
```

- [ ] **Step 5: Test reduced motion, context loss, pause and cleanup**

Run: `npx vitest run tests/components/mind-universe.test.tsx`

Expected: PASS; reduced motion and no-WebGL paths never call the runtime loader.

- [ ] **Step 6: Commit the 3D brand system**

```powershell
git add components/brand tests/components/mind-universe.test.tsx
git diff --cached --name-only
git commit -m "feat: add progressive 3D mind universe"
```

---

### Task 4: Protected `/mind` route and responsive app shell

**Files:**
- Create: `app/mind/page.tsx`
- Create: `app/mind/loading.tsx`
- Create: `components/app-shell/mind-app.tsx`
- Create: `components/app-shell/sidebar.tsx`
- Create: `components/app-shell/topbar.tsx`
- Create: `components/app-shell/mobile-drawer.tsx`
- Create: `components/app-shell/app-shell.module.css`
- Create: `lib/client/use-me.ts`
- Create: `tests/components/mind-app.test.tsx`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: protected app route and screen state `"chat" | "materials" | "profile" | "billing"`.
- Consumes: `MeResponse`, `apiRequest()` and explicit loading panels for chat, profile and billing that Tasks 5–7 replace one at a time.

- [ ] **Step 1: Write route and access-routing tests**

```tsx
it("routes a student without access to billing", async () => {
  mockApi<MeResponse>("/api/me", studentWithoutAccess);
  render(<MindApp />);
  expect(await screen.findByRole("heading", { name: /подписк|доступ/i })).toBeVisible();
  expect(screen.queryByRole("textbox", { name: /сообщение/i })).not.toBeInTheDocument();
});

it("shows the admin link only to the owner", async () => {
  mockApi<MeResponse>("/api/me", ownerResponse);
  render(<MindApp />);
  expect(await screen.findByRole("link", { name: /кабинет владельца/i })).toHaveAttribute("href", "/admin");
});
```

- [ ] **Step 2: Run and verify missing shell failures**

Run: `npx vitest run tests/components/mind-app.test.tsx`

Expected: FAIL because `/mind` and `MindApp` are absent.

- [ ] **Step 3: Add the server-side SIWC gate**

```tsx
export const dynamic = "force-dynamic";

export default async function MindPage() {
  await requireChatGPTUser("/mind");
  return <MindApp />;
}
```

- [ ] **Step 4: Implement deterministic screen routing**

```ts
function initialScreen(me: MeResponse): Screen {
  if (!me.user?.profileCompletedAt || me.consentRequired) return "profile";
  if (!me.hasAccess && me.user.role !== "owner") return "billing";
  return "chat";
}
```

The shell shows chat/materials/profile/billing links, membership date and owner-only `/admin`. Mobile drawer closes on Escape, scrim and navigation and restores focus to its trigger.

- [ ] **Step 5: Add a stable loading skeleton**

`app/mind/loading.tsx` uses the same shell dimensions as the hydrated app and contains no private user data.

- [ ] **Step 6: Run component and render tests**

Run: `npm run test:components && npm run build && node --test tests/rendered-html.test.mjs`

Expected: PASS for anonymous `/mind` redirect, student routing, owner navigation and drawer keyboard behavior.

- [ ] **Step 7: Commit the protected shell**

```powershell
git add app/mind components/app-shell lib/client/use-me.ts tests/components/mind-app.test.tsx tests/rendered-html.test.mjs
git diff --cached --name-only
git commit -m "feat: add protected ADEMI app shell"
```

---

### Task 5: Extract the chat experience and crisis entry

**Files:**
- Create: `components/chat/chat-view.tsx`
- Create: `components/chat/message-list.tsx`
- Create: `components/chat/composer.tsx`
- Create: `components/chat/empty-state.tsx`
- Create: `components/chat/mode-badge.tsx`
- Create: `components/chat/crisis-entry.tsx`
- Create: `components/chat/chat.module.css`
- Create: `lib/client/use-chat.ts`
- Create: `tests/components/chat.test.tsx`
- Modify: `components/app-shell/mind-app.tsx`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: `useChat({ language, enabled })`, `<ChatView />`, `<CrisisEntry />` and `sending` animation state.
- Consumes: `/api/chat`, `ChatResponse`, paid access from `MeResponse`.

- [ ] **Step 1: Write interaction and locked-state tests**

```tsx
it("submits on Enter but keeps Shift+Enter for a new line", async () => {
  render(<Composer disabled={false} onSend={onSend} />);
  const box = screen.getByRole("textbox", { name: /сообщение/i });
  await user.type(box, "Мне тревожно{shift>}{enter}{/shift}сегодня");
  expect(onSend).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  expect(onSend).toHaveBeenCalledOnce();
});

it("keeps crisis help available while ordinary chat is locked", () => {
  render(<ChatView hasAccess={false} />);
  expect(screen.queryByTestId("ordinary-composer")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /срочн|опасност/i })).toBeVisible();
  expect(screen.getByRole("link", { name: /112/ })).toHaveAttribute("href", "tel:112");
});
```

- [ ] **Step 2: Run and verify missing component failures**

Run: `npx vitest run tests/components/chat.test.tsx`

Expected: FAIL for missing chat components.

- [ ] **Step 3: Move API state into `useChat`**

```ts
export function useChat({ language, enabled }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const send = useCallback(async (text: string, crisisOnly = false) => {
    if (sending || (!enabled && !crisisOnly)) return;
    setSending(true);
    try {
      const answer = await apiRequest<ChatResponse>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, language, clientRequestId: crypto.randomUUID(), sessionContext: boundedSessionContext(messages) }),
      });
      appendAnswer(answer);
    } finally { setSending(false); }
  }, [enabled, language, messages, sending]);
  return { messages, sending, send, loadConversation, deleteConversation, submitFeedback };
}
```

- [ ] **Step 4: Render public mode and safety metadata**

`ModeBadge` displays localized `Cloudflare AI` or `Guided safety mode` based on response `answerMode`; it never displays quota errors or secret configuration. Crisis messages use `safetyLevel === "crisis"`, expose `tel:112` and suppress ordinary coaching suggestions.

- [ ] **Step 5: Connect AI animation and preserve source/feedback/history behavior**

Pass `sending` into the compact `<MindUniverse active={sending} compact />`; preserve current source chips, message IDs, feedback categories and one-turn bounded `sessionContext`.

- [ ] **Step 6: Run chat and safety tests**

Run: `npx vitest run tests/components/chat.test.tsx && node --test tests/safety-freechat.test.mjs tests/psychology-guided.test.mjs`

Expected: PASS for keyboard, duplicate-send lock, modes, saved history and crisis access.

- [ ] **Step 7: Commit the chat slice**

```powershell
git add components/chat lib/client/use-chat.ts components/app-shell/mind-app.tsx tests/components/chat.test.tsx tests/rendered-html.test.mjs
git diff --cached --name-only
git commit -m "feat: build immersive ADEMI chat"
```

---

### Task 6: Onboarding, profile and data controls

**Files:**
- Create: `components/profile/onboarding-flow.tsx`
- Create: `components/profile/profile-view.tsx`
- Create: `components/profile/avatar-field.tsx`
- Create: `components/profile/data-controls.tsx`
- Create: `components/profile/profile.module.css`
- Create: `lib/client/use-profile.ts`
- Create: `lib/client/use-theme.ts`
- Create: `tests/components/profile.test.tsx`
- Modify: `components/app-shell/mind-app.tsx`

**Interfaces:**
- Produces: completed two-step onboarding and preserved profile/privacy functions.
- Consumes: `/api/me`, `/api/me/avatar`, `/api/me/data`.

- [ ] **Step 1: Write onboarding and destructive-action tests**

```tsx
it("requires a valid name and consent before completion", async () => {
  render(<OnboardingFlow me={newUser} onComplete={onComplete} />);
  await user.click(screen.getByRole("button", { name: /продолжить/i }));
  expect(screen.getByRole("alert")).toHaveTextContent(/имя/i);
  await user.type(screen.getByLabelText(/имя/i), "Адеми");
  await user.click(screen.getByRole("button", { name: /продолжить/i }));
  expect(screen.getByRole("checkbox", { name: /18/i })).not.toBeChecked();
});

it("requires confirmation before deleting history", async () => {
  render(<DataControls />);
  await user.click(screen.getByRole("button", { name: /удалить историю/i }));
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(deleteRequest).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run and verify missing profile components**

Run: `npx vitest run tests/components/profile.test.tsx`

Expected: FAIL for missing modules.

- [ ] **Step 3: Implement two-step onboarding**

Step 1 PATCHes normalized `fullName` and `preferredLanguage`. Step 2 requires both an 18+ checkbox and service-limit acceptance, then PATCHes `{ acceptConsent: true, profileCompletedAt: Date.now() }`. The server remains authoritative for the stored completion timestamp.

- [ ] **Step 4: Preserve profile, avatar, theme and history controls**

Move existing validated avatar upload/delete, `ademi-theme` persistence, history toggle, data export and deletion into focused components. If history is disabled, clear visible conversation state after the successful PATCH.

- [ ] **Step 5: Show membership end date and localized status**

```tsx
{me.membership?.endsAt ? (
  <p><span>{copy.accessUntil}</span><time dateTime={new Date(me.membership.endsAt).toISOString()}>{formatDate(me.membership.endsAt, language)}</time></p>
) : null}
```

- [ ] **Step 6: Run profile and backend security tests**

Run: `npx vitest run tests/components/profile.test.tsx && node --test tests/profile-backend.test.mjs`

Expected: PASS for profile validation, avatar security, theme, history, export and confirmation.

- [ ] **Step 7: Commit profile/onboarding**

```powershell
git add components/profile lib/client/use-profile.ts lib/client/use-theme.ts components/app-shell/mind-app.tsx tests/components/profile.test.tsx
git diff --cached --name-only
git commit -m "feat: complete ADEMI onboarding and profile"
```

---

### Task 7: Billing UI and payment return flow

**Files:**
- Create: `components/billing/billing-view.tsx`
- Create: `components/billing/plan-card.tsx`
- Create: `components/billing/payment-status.tsx`
- Create: `components/billing/billing.module.css`
- Create: `lib/client/use-billing.ts`
- Create: `tests/components/billing.test.tsx`
- Modify: `components/app-shell/mind-app.tsx`

**Interfaces:**
- Produces: server-authoritative pricing, checkout redirect, bounded pending polling and access refresh.
- Consumes: `GET/POST /api/billing`, `GET /api/billing/status`, `BillingResponse`.

- [ ] **Step 1: Write exact plan and state-machine tests**

```tsx
it("renders the server plan and no-renewal disclosure", async () => {
  mockBilling(activeTestPlan);
  render(<BillingView />);
  expect(await screen.findByText(/990/)).toBeVisible();
  expect(screen.getByText(/30 (дней|дня)/i)).toBeVisible();
  expect(screen.getByText(/без автоматического/i)).toBeVisible();
});

it("stops polling when payment becomes paid", async () => {
  mockPaymentSequence([pendingPayment, paidPayment]);
  render(<BillingView returnOrderId="order-1" />);
  await waitFor(() => expect(refreshMe).toHaveBeenCalledOnce());
  expect(statusRequestCount()).toBe(2);
});
```

- [ ] **Step 2: Run and verify missing billing components**

Run: `npx vitest run tests/components/billing.test.tsx`

Expected: FAIL for missing modules.

- [ ] **Step 3: Implement the billing state machine**

```ts
export function useBilling({ returnOrderId, onActivated }: Options) {
  const [snapshot, setSnapshot] = useState<BillingResponse | null>(null);
  useEffect(() => {
    if (!returnOrderId || snapshot?.payment?.status !== "pending") return;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      const payment = await apiRequest<PaymentStatus>(`/api/billing/status?orderId=${encodeURIComponent(returnOrderId)}`);
      if (payment.status === "paid") { clearInterval(timer); await onActivated(); }
      if (payment.status === "failed" || attempts >= 20) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [returnOrderId, snapshot?.payment?.status, onActivated]);
  return { snapshot, startCheckout, refresh };
}
```

- [ ] **Step 4: Follow only safe checkout URLs**

```ts
function isSafeCheckoutUrl(value: string) {
  const url = new URL(value, window.location.origin);
  return (url.origin === window.location.origin && url.pathname.startsWith("/api/billing/")) ||
    (url.protocol === "https:" && (url.hostname === "test-api.freedompay.kg" || url.hostname.endsWith(".freedompay.kg")));
}
```

Disable the button while creating a checkout. Test-mode and simulator badges are visible whenever the server reports them. Failed and expired states provide retry/renew actions; owner sees access without checkout.

- [ ] **Step 5: Run billing tests**

Run: `npx vitest run tests/components/billing.test.tsx`

Expected: PASS for price, states, redirect allowlist, bounded polling, cleanup and owner bypass.

- [ ] **Step 6: Commit billing UI**

```powershell
git add components/billing lib/client/use-billing.ts components/app-shell/mind-app.tsx tests/components/billing.test.tsx
git diff --cached --name-only
git commit -m "feat: complete ADEMI subscription experience"
```

---

### Task 8: Member material library

**Files:**
- Create: `components/materials/material-library.tsx`
- Create: `components/materials/material-card.tsx`
- Create: `components/materials/materials.module.css`
- Create: `lib/client/use-materials.ts`
- Create: `tests/components/materials.test.tsx`
- Modify: `components/app-shell/mind-app.tsx`
- Modify: `components/app-shell/sidebar.tsx`

**Interfaces:**
- Produces: accessible member-only material list and ownership-safe downloads.
- Consumes: `GET /api/materials`, `GET /api/materials/download?materialId=`, effective access from `MeResponse`.

- [ ] **Step 1: Write loading, empty, download and lock tests**

```tsx
it("lists only server-returned ready member materials", async () => {
  mockApi("/api/materials", { materials: [{ id: "m1", title: "Практика опоры", category: "guide", language: "RU", lifecycle: "ready", updatedAt: 1 }] });
  render(<MaterialLibrary hasAccess />);
  expect(await screen.findByRole("heading", { name: "Практика опоры" })).toBeVisible();
  expect(screen.getByRole("link", { name: /скачать/i })).toHaveAttribute("href", "/api/materials/download?materialId=m1");
});

it("does not request member materials without access", () => {
  render(<MaterialLibrary hasAccess={false} />);
  expect(requestedPaths()).not.toContain("/api/materials");
  expect(screen.getByText(/активн.*подписк/i)).toBeVisible();
});
```

- [ ] **Step 2: Run and verify missing material components**

Run: `npx vitest run tests/components/materials.test.tsx`

Expected: FAIL because the member library does not exist.

- [ ] **Step 3: Implement a bounded material hook**

```ts
export function useMaterials(enabled: boolean) {
  const [state, setState] = useState<MaterialsState>({ status: "idle", items: [] });
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    setState((current) => ({ ...current, status: "loading" }));
    try {
      const result = await apiRequest<{ materials: MemberMaterial[] }>("/api/materials", { signal });
      setState({ status: "ready", items: result.materials });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setState({ status: "error", items: [] });
    }
  }, [enabled]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  return { ...state, reload: load };
}
```

- [ ] **Step 4: Render semantic cards and safe downloads**

`MaterialLibrary` uses a named `<section>`, loading status, retry button and localized empty state. `MaterialCard` renders title, category, language and update date; its download link contains only `encodeURIComponent(material.id)` and relies on server authentication/authorization. Do not render R2 keys, hashes or indexing identifiers.

- [ ] **Step 5: Add the member navigation destination**

Add `materials` to the shell state union and sidebar/mobile navigation. Selecting it is allowed only when `me.hasAccess` or the user is owner; otherwise route to billing. Preserve focus restoration on mobile navigation.

- [ ] **Step 6: Run material and access tests**

Run: `npx vitest run tests/components/materials.test.tsx tests/components/mind-app.test.tsx && node --test tests/materials-admin.test.mjs`

Expected: PASS for member list, empty/error/retry, safe download URL, lock behavior and mobile navigation.

- [ ] **Step 7: Commit the member library**

```powershell
git add components/materials lib/client/use-materials.ts components/app-shell/mind-app.tsx components/app-shell/sidebar.tsx tests/components/materials.test.tsx
git diff --cached --name-only
git commit -m "feat: add member material library"
```

---

### Task 9: Visual system, legal copy, metadata and frontend release gate

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `app/legal-page.tsx`
- Modify: `app/privacy/page.tsx`
- Modify: `app/terms/page.tsx`
- Modify: `app/safety/page.tsx`
- Modify: `components/**/*.module.css`
- Create: `tests/components/accessibility.test.tsx`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: final Mind Universe design, accessible motion rules and truthful legal/payment copy.
- Consumes: all component slices above.

- [ ] **Step 1: Add failing global design/accessibility checks**

```tsx
it("has landmarks, visible controls and a reduced-motion fallback", () => {
  render(<LandingPage language="RU" ctaHref="/mind" />);
  expect(screen.getByRole("banner")).toBeVisible();
  expect(screen.getByRole("main")).toBeVisible();
  expect(screen.getByRole("contentinfo")).toBeVisible();
  expect(screen.getAllByRole("link", { name: /начать/i }).length).toBeGreaterThan(0);
});
```

Add source assertions for `@media (prefers-reduced-motion: reduce)`, `:focus-visible`, `@media (pointer: coarse)` and a `320px` breakpoint.

- [ ] **Step 2: Run and verify missing final rules**

Run: `npx vitest run tests/components/accessibility.test.tsx`

Expected: FAIL until the final global tokens and motion rules exist.

- [ ] **Step 3: Establish global tokens and scoped modules**

```css
:root {
  --ink-950: #08050e;
  --plum-900: #17101f;
  --plum-700: #3b2050;
  --champagne-100: #fff4dc;
  --gold-400: #d9a85f;
  --lilac-400: #b887e8;
  --aqua-400: #6fd8d2;
  --text-primary: #fff8ec;
  --text-muted: #cdbfd2;
  --focus: #8ce7df;
}

:focus-visible { outline: 3px solid var(--focus); outline-offset: 4px; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; } }
```

Keep only tokens/reset/focus/legal primitives in `globals.css`; visual component rules live in CSS Modules. Disable tilt/hover parallax under coarse pointer.

- [ ] **Step 4: Correct metadata and truthful payment/legal copy**

Set OG dimensions to the actual `1731 × 909`. Replace all “free/coming soon/no payments” statements in RU/KG/EN with one-time 990 KGS / 30-day terms, no automatic renewal, support contact from `ADEMI_SUPPORT_EMAIL`, activation timing and a plain-language refund/contact path consistent with applicable Kyrgyz Republic law. Do not invent a legal entity name.

- [ ] **Step 5: Run the complete frontend gate**

Run:

```powershell
npm run typecheck
npm run lint
npm run test:components
npm run build
npm run test:node
```

Expected: all commands exit 0; protected corpora and secrets remain absent from client chunks.

- [ ] **Step 6: Perform production-shaped manual visual checks**

Check `/`, `/mind`, `/privacy?lang=RU`, `/terms?lang=KG`, `/safety?lang=EN` at 320 px, tablet and desktop. Repeat with reduced motion, WebGL disabled, keyboard only and a hidden tab. Confirm no layout shift in the hero, the loop pauses when hidden, focus returns from drawers/dialogs and all critical text remains legible.

- [ ] **Step 7: Commit the finished product experience**

```powershell
git add app components lib/i18n lib/client tests/components tests/rendered-html.test.mjs
git diff --cached --name-only
git commit -m "feat: finish ADEMI Mind Universe experience"
```
