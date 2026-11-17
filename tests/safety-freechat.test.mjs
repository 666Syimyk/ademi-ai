import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadSafetyModule() {
  const source = await readFile(
    new URL("../lib/server/safety.ts", import.meta.url),
    "utf8",
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
  );
}

test("free mode catches high-confidence imminent harm wording in RU, KG, and EN", async () => {
  const { assessSafety } = await loadSafetyModule();
  const messages = [
    "Я сейчас застрелюсь",
    "Я покончу с собой сегодня",
    "Я выпрыгну из окна",
    "Я уже выпил все таблетки",
    "Я прямо сейчас причиню вред ребенку",
    "Муж приставил нож и обещает зарезать меня сегодня",
    "I just took all my pills",
    "I will hurt my baby",
    "My husband has a gun outside my door and says I am not leaving alive",
    "Мен бүгүн өз жанымды кыям",
    "Мен азыр таблеткалардын баарын ичтим",
    "Мен аны бүгүн өлтүрүп салам",
    "Күйөөм колуна бычак алып, мени азыр союп салам деди",
  ];

  for (const message of messages) {
    assert.equal(
      assessSafety(message).level,
      "crisis",
      `expected crisis routing for: ${message}`,
    );
  }
});

test("urgent medical preflight is deterministic and localized", async () => {
  const { assessSafety, urgentMedicalResponse } = await loadSafetyModule();
  const cases = [
    ["RU", "У меня сильная боль в груди, и я теряю сознание"],
    ["KG", "Көкүрөгүм катуу ооруп, эсимди жоготуп жатам"],
    ["EN", "I have severe chest pain and I am fainting"],
    ["RU", "Я задыхаюсь"],
    ["KG", "Мен дем ала албай жатам"],
    ["EN", "I cannot breathe"],
  ];

  for (const [language, message] of cases) {
    const assessment = assessSafety(message);
    assert.equal(assessment.category, "urgent_medical", message);
    assert.match(urgentMedicalResponse(language), /112/);
  }
  assert.match(urgentMedicalResponse("RU"), /экстренн|немедленно/i);
  assert.match(urgentMedicalResponse("KG"), /шашылыш|дароо/i);
  assert.match(urgentMedicalResponse("EN"), /emergency|call/i);
});

test("natural short follow-ups retain immediate crisis guidance", async () => {
  const { shouldRepeatCrisisGuidance } = await loadSafetyModule();
  const cases = [
    ["Can you stay with me?", "I want to die"],
    ["Please help", "I want to die"],
    ["I'm still scared", "I want to die"],
    ["Пожалуйста, помоги", "Я хочу убить себя"],
    ["Не оставляй меня", "Я хочу убить себя"],
    ["Мага жардам берчи", "Өлгүм келет"],
    ["Мен дагы эле коркуп жатам", "Өлгүм келет"],
  ];

  for (const [message, previous] of cases) {
    assert.equal(
      shouldRepeatCrisisGuidance(message, previous),
      true,
      `expected crisis continuity for: ${message}`,
    );
  }
});

test("the entire submitted message is assessed before the ordinary length limit", async () => {
  const [{ assessSafety }, route] = await Promise.all([
    loadSafetyModule(),
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
  ]);
  const marker = "I want to die";
  const message = `${"x".repeat(4500)} ${marker} ${"y".repeat(4500)}`;

  assert.equal(assessSafety(message).level, "crisis");
  assert.match(route, /const localSafety = assessSafety\(message\)/);
  assert.doesNotMatch(route, /const safetyInput\s*=/);
  assert.doesNotMatch(route, /message\.slice\(-4000\)/);

  const assessment = route.indexOf("const localSafety = assessSafety(message)");
  const crisis = route.indexOf('if (localSafety.level === "crisis")');
  const urgent = route.indexOf(
    'if (localSafety.category === "urgent_medical")',
  );
  const length = route.indexOf("if (message.length > 4000)");
  assert.ok(assessment >= 0 && crisis >= 0 && urgent >= 0 && length >= 0);
  assert.ok(assessment < crisis);
  assert.ok(crisis < urgent);
  assert.ok(urgent < length);
});

test("recognized emergencies bypass ordinary gates while authentication remains required", async () => {
  const route = await readFile(
    new URL("../app/api/chat/route.ts", import.meta.url),
    "utf8",
  );
  const auth = route.indexOf("const user = await getAppUser()");
  const assessment = route.indexOf("const localSafety = assessSafety(message)");
  const crisis = route.indexOf('if (localSafety.level === "crisis")');
  const urgent = route.indexOf(
    'if (localSafety.category === "urgent_medical")',
  );
  const repeat = route.indexOf("shouldRepeatCrisisGuidance(message");
  const account = route.indexOf('user.accountStatus === "suspended"');
  const consent = route.indexOf("user.consentVersion !== CONSENT_VERSION");
  const quota = route.indexOf("await reserveChatQuota(user.id)");
  const database = route.indexOf("const db = getDb()");

  for (const position of [
    auth,
    assessment,
    crisis,
    urgent,
    repeat,
    account,
    consent,
    quota,
    database,
  ]) {
    assert.ok(position >= 0);
  }
  assert.ok(auth < assessment);
  for (const emergency of [crisis, urgent, repeat]) {
    assert.ok(emergency < account);
    assert.ok(emergency < consent);
    assert.ok(emergency < quota);
    assert.ok(emergency < database);
  }
  assert.match(route, /safetyJson\(crisisResponse\(language\), null, language\)/);
  assert.doesNotMatch(route, /hasCourseAccess/);
  assert.doesNotMatch(route, /subscription_required/);
});

test("one complete bounded prior user turn is accepted for crisis continuity", async () => {
  const route = await readFile(
    new URL("../app/api/chat/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /\.slice\(-1\)/);
  assert.match(route, /content\.slice\(0, 4000\)/);
  assert.doesNotMatch(route, /content\.slice\(0, 500\)/);
});
