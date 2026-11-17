import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(
  new URL("../node_modules/vinext/dist/cli.js", import.meta.url),
);

async function createIsolatedProject() {
  const isolatedRoot = await mkdtemp(path.join(tmpdir(), "ademi-local-dev-"));
  await cp(projectRoot, isolatedRoot, {
    recursive: true,
    filter(source) {
      return !new Set(["node_modules", ".vinext", ".wrangler", "dist", ".git"])
        .has(path.basename(source));
    },
  });
  await symlink(
    path.join(projectRoot, "node_modules"),
    path.join(isolatedRoot, "node_modules"),
    "junction",
  );
  return isolatedRoot;
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`vinext dev exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("vinext dev did not become ready within 45 seconds");
}

test("local development emulates Sites authentication without a 404", async (t) => {
  const port = 31_000 + (process.pid % 1_000);
  const ollamaPort = port + 1_000;
  const origin = `http://localhost:${port}`;
  const output = [];
  const ollamaRequests = [];
  const ollamaChatBodies = [];
  let modelListed = true;
  let chatAvailable = true;
  let chatResponseDelayMs = 0;
  const ollama = createServer((request, response) => {
    ollamaRequests.push(request.url);
    if (request.url === "/api/tags") {
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          models: modelListed ? [{ name: "qwen3.5:4b" }] : [],
        }),
      );
      return;
    }
    if (request.url !== "/api/chat") {
      response.writeHead(404).end();
      return;
    }
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      ollamaChatBodies.push(
        JSON.parse(Buffer.concat(chunks).toString("utf8")),
      );
      const respond = () => {
    if (!chatAvailable) {
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Ollama is restarting" }));
      return;
    }
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        model: "qwen3.5:4b",
        message: {
          role: "assistant",
          content: "Париж — столица Франции.",
        },
      }),
    );
      };
      if (chatResponseDelayMs > 0) {
        setTimeout(respond, chatResponseDelayMs);
      } else {
        respond();
      }
    });
  });
  await new Promise((resolve) => ollama.listen(ollamaPort, "127.0.0.1", resolve));
  const isolatedProjectRoot = await createIsolatedProject();
  const child = spawn(process.execPath, [cli, "dev", "--port", String(port)], {
    cwd: isolatedProjectRoot,
    env: {
      ...process.env,
      NODE_ENV: "development",
      OLLAMA_BASE_URL: `http://127.0.0.1:${ollamaPort}`,
      OLLAMA_MODEL: "qwen3.5:4b",
      OLLAMA_RESPONSE_TIMEOUT_MS: "75",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await Promise.race([
        exited,
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]);
    }
    await new Promise((resolve) => ollama.close(resolve));
    await rm(isolatedProjectRoot, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  });

  try {
    await waitForServer(origin, child);

    const signIn = await fetch(`${origin}/signin-with-chatgpt?return_to=/`, {
      redirect: "manual",
    });
    assert.equal(signIn.status, 302);
    assert.equal(signIn.headers.get("location"), "/");

    for (const legacyPath of ["/chat", "/login"]) {
      const legacyRoute = await fetch(`${origin}${legacyPath}`, {
        redirect: "manual",
      });
      assert.equal(legacyRoute.status, 302);
      assert.equal(legacyRoute.headers.get("location"), "/");
    }

    const me = await fetch(`${origin}/api/me`).then((response) => response.json());
    assert.equal(me.authenticated, true);
    assert.equal(me.user.email, "local@ademi.test");
    assert.equal(me.services.aiProvider, "ollama");
    assert.equal(me.services.aiProviderPreference, "ollama");
    // Break caught: local development advertises the sidecar-only audio
    // capability so the signed-in client can expose its voice controls.
    assert.equal(me.services.localAudio, true);

    await fetch(`${origin}/api/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptConsent: true }),
    });
    ollamaRequests.length = 0;
    const crisisResponse = await fetch(`${origin}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "I want to die", language: "EN" }),
    });
    const crisis = await crisisResponse.json();
    assert.equal(crisisResponse.status, 200);
    assert.equal(crisis.answerMode, "guided");
    assert.equal(crisis.aiProvider, null);
    assert.equal(ollamaRequests.length, 0);

    const chatResponse = await fetch(`${origin}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Какая столица Франции?",
        language: "RU",
      }),
    });
    const chat = await chatResponse.json();
    assert.equal(chatResponse.status, 200);
    assert.equal(chat.answerMode, "generative");
    assert.equal(chat.aiProvider, "ollama");
    assert.equal(chat.language, "RU");
    assert.equal(chat.text, "Париж — столица Франции.");
    assert.ok(ollamaRequests.includes("/api/chat"));

    const legacyLanguageResponse = await fetch(`${origin}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Help me prepare for a difficult conversation.",
        language: "EN",
      }),
    });
    const english = await legacyLanguageResponse.json();
    assert.equal(legacyLanguageResponse.status, 200);
    assert.equal(english.language, "EN");
    assert.equal(ollamaChatBodies.at(-1)?.messages?.[0]?.role, "system");
    assert.match(
      ollamaChatBodies.at(-1)?.messages?.[0]?.content ?? "",
      /Respond in English/i,
    );
    assert.match(
      ollamaChatBodies.at(-1)?.messages?.[0]?.content ?? "",
      /next 24 hours/i,
    );

    const kyrgyzLanguageResponse = await fetch(`${origin}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Мага татаал сүйлөшүүгө даярданууга жардам бериңиз.",
        language: "KG",
      }),
    });
    const kyrgyz = await kyrgyzLanguageResponse.json();
    assert.equal(kyrgyzLanguageResponse.status, 200);
    assert.equal(kyrgyz.language, "KG");
    assert.match(
      ollamaChatBodies.at(-1)?.messages?.[0]?.content ?? "",
      /Respond in Kyrgyz/i,
    );

    // Break caught: a slow local model must not make /api/chat return a
    // provider error or wait for the old multi-minute Ollama timeout.
    chatResponseDelayMs = 300;
    const slowStartedAt = Date.now();
    const slowResponse = await fetch(`${origin}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Help me make a small plan for this evening.",
        language: "EN",
      }),
    });
    const slowElapsedMs = Date.now() - slowStartedAt;
    const slow = await slowResponse.json();
    assert.equal(slowResponse.status, 200);
    assert.equal(slow.answerMode, "guided");
    assert.equal(slow.externalModel, false);
    assert.equal(slow.aiProvider, null);
    assert.equal(ollamaChatBodies.at(-1)?.options?.num_predict, 320);
    assert.ok(slowElapsedMs < 1_000, `slow fallback took ${slowElapsedMs}ms`);
    chatResponseDelayMs = 0;

    chatAvailable = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const unavailableResponse = await fetch(`${origin}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Проверка перезапуска модели ${attempt}`,
          language: "RU",
        }),
      });
      const unavailable = await unavailableResponse.json();
      assert.equal(unavailableResponse.status, 200);
      assert.equal(unavailable.answerMode, "guided");
      assert.equal(unavailable.externalModel, false);
      assert.equal(unavailable.aiProvider, null);
    }

    chatAvailable = true;
    const recoveredResponse = await fetch(`${origin}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Какая столица Франции после восстановления?",
        language: "RU",
      }),
    });
    const recovered = await recoveredResponse.json();
    assert.equal(recoveredResponse.status, 200);
    assert.equal(recovered.answerMode, "generative");
    assert.equal(recovered.aiProvider, "ollama");

    chatAvailable = false;
    const invalidatingResponse = await fetch(`${origin}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Проверь последний перезапуск модели",
        language: "RU",
      }),
    });
    const invalidating = await invalidatingResponse.json();
    assert.equal(invalidatingResponse.status, 200);
    assert.equal(invalidating.answerMode, "guided");
    assert.equal(invalidating.externalModel, false);
    assert.equal(invalidating.aiProvider, null);

    modelListed = false;
    const requestsBeforeMissingModelCheck = ollamaRequests.length;
    await new Promise((resolve) => setTimeout(resolve, 8_100));
    const fallbackMe = await fetch(`${origin}/api/me`).then((response) =>
      response.json(),
    );
    assert.ok(
      ollamaRequests
        .slice(requestsBeforeMissingModelCheck)
        .includes("/api/tags"),
    );
    assert.equal(fallbackMe.services.aiProvider, null);
    assert.equal(fallbackMe.services.aiProviderPreference, "ollama");
    assert.equal(fallbackMe.services.answerMode, "guided");

    const fallbackResponse = await fetch(`${origin}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Помоги составить план подготовки к экзамену",
        language: "RU",
      }),
    });
    const fallback = await fallbackResponse.json();
    assert.equal(fallbackResponse.status, 200);
    assert.equal(fallback.answerMode, "guided");
    assert.equal(fallback.aiProvider, null);
  } catch (error) {
    throw new Error(`${error.message}\n\nvinext output:\n${output.join("")}`, {
      cause: error,
    });
  }
});
