import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const python = process.env.ADEMI_PYTHON ?? "py";
const pythonArgs = process.env.ADEMI_PYTHON
  ? [
      "-m",
      "uvicorn",
      "local_ai.voice_service:app",
      "--host",
      "127.0.0.1",
      "--port",
      "8091",
    ]
  : [
      "-3.12",
      "-m",
      "uvicorn",
      "local_ai.voice_service:app",
      "--host",
      "127.0.0.1",
      "--port",
      "8091",
    ];
const vinextCli = fileURLToPath(
  new URL("../node_modules/vinext/dist/cli.js", import.meta.url),
);
const spawnOptions = { cwd: process.cwd(), stdio: "inherit", windowsHide: true };

let shuttingDown = false;
let exitCode = 0;
let sidecarUnavailable = false;

const sidecar = spawn(python, pythonArgs, spawnOptions);
const app = spawn(process.execPath, [vinextCli, "dev", ...process.argv.slice(2)], spawnOptions);
const children = [sidecar, app];

function stopChildren(signal) {
  for (const child of children) {
    if (!child.killed && child.exitCode === null) {
      child.kill(signal);
    }
  }
}

function shutdown(signal, nextExitCode = 0) {
  if (shuttingDown) return;

  shuttingDown = true;
  exitCode = nextExitCode;
  stopChildren(signal);

  const forceExit = setTimeout(() => process.exit(exitCode), 5_000);
  forceExit.unref();
}

function reportSidecarFailure(reason) {
  if (shuttingDown || sidecarUnavailable) return;

  sidecarUnavailable = true;
  console.error(
    `Local voice service unavailable: ${reason}. The web app will continue without voice input or playback.`,
  );
}

function handleSidecarExit(code) {
  reportSidecarFailure(
    `stopped unexpectedly${code === null ? "" : ` (code ${code})`}`,
  );
}

function handleApplicationFailure(reason, nextExitCode = 1) {
  if (shuttingDown) return;

  console.error(`ADEMI application ${reason}.`);
  shutdown("SIGTERM", nextExitCode);
}

function handleApplicationExit(code) {
  handleApplicationFailure(
    `stopped unexpectedly${code === null ? "" : ` (code ${code})`}`,
    code && code !== 0 ? code : 1,
  );
}

sidecar.once("error", (error) => reportSidecarFailure(`could not start: ${error.message}`));
sidecar.once("exit", handleSidecarExit);
app.once("error", (error) => handleApplicationFailure(`could not start: ${error.message}`));
app.once("exit", handleApplicationExit);

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

process.on("exit", () => stopChildren("SIGTERM"));
