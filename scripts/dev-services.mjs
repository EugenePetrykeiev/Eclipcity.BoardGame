import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const backendCommand = existsSync(resolve(rootDir, ".venv/bin/uvicorn"))
  ? ".venv/bin/uvicorn"
  : "uvicorn";

const services = [
  {
    name: "backend",
    command: backendCommand,
    args: [
      "src.backend.main:app",
      "--reload",
      "--host",
      "localhost",
      "--port",
      "8000"
    ]
  },
  {
    name: "frontend",
    command: npmCommand,
    args: ["run", "dev:frontend"]
  }
];

const children = new Set();
let isShuttingDown = false;

function prefixOutput(name, stream) {
  let buffered = "";

  return (chunk) => {
    buffered += chunk.toString();
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        stream.write(`[${name}] ${line}\n`);
      }
    }
  };
}

function stopAll(signal = "SIGTERM") {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const service of services) {
  const child = spawn(service.command, service.args, {
    cwd: rootDir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  children.add(child);
  child.stdout.on("data", prefixOutput(service.name, process.stdout));
  child.stderr.on("data", prefixOutput(service.name, process.stderr));

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (!isShuttingDown && code !== 0) {
      console.error(
        `[services] ${service.name} stopped unexpectedly with ${signal || `code ${code}`}.`
      );
      stopAll();
      process.exitCode = code || 1;
    }
  });

  child.on("error", (error) => {
    console.error(`[services] Failed to start ${service.name}: ${error.message}`);
    stopAll();
    process.exitCode = 1;
  });
}

console.log("[services] Backend:  http://localhost:8000/docs");
console.log("[services] Frontend: http://localhost:5173/");
console.log("[services] Press Ctrl+C to stop both services.");

process.on("SIGINT", () => {
  stopAll("SIGINT");
});

process.on("SIGTERM", () => {
  stopAll("SIGTERM");
});
