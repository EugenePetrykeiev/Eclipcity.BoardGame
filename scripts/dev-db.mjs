import { spawnSync } from "node:child_process";

const containerName = "eclipcity-local-postgres";
const database = "eclipcity";
const user = "eclipcity";
const password = "eclipcity";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
  });

  if (result.status !== 0) {
    throw new Error(
      options.errorMessage || `${command} ${args.join(" ")} failed.`
    );
  }

  return result.stdout?.trim() || "";
}

function containerExists() {
  const names = run(
    "docker",
    [
      "ps",
      "-a",
      "--filter",
      `name=^/${containerName}$`,
      "--format",
      "{{.Names}}"
    ],
    { capture: true }
  );
  return names.split(/\r?\n/).includes(containerName);
}

function waitForDatabase() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    const result = spawnSync(
      "docker",
      ["exec", containerName, "pg_isready", "-U", user, "-d", database],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );

    if (result.status === 0) {
      console.log("[dev-db] PostgreSQL is ready on localhost:5432.");
      return;
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }

  throw new Error("[dev-db] PostgreSQL did not become ready in 30 seconds.");
}

if (containerExists()) {
  run("docker", ["start", containerName], {
    errorMessage: "[dev-db] Failed to start existing PostgreSQL container."
  });
} else {
  run(
    "docker",
    [
      "run",
      "--name",
      containerName,
      "-e",
      `POSTGRES_DB=${database}`,
      "-e",
      `POSTGRES_USER=${user}`,
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-p",
      "127.0.0.1:5432:5432",
      "-d",
      "postgres:16-alpine"
    ],
    { errorMessage: "[dev-db] Failed to create PostgreSQL container." }
  );
}

waitForDatabase();
