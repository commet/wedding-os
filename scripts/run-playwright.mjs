import { spawnSync } from "node:child_process";

const [port, ...args] = process.argv.slice(2);

if (!port) {
  console.error("Usage: node scripts/run-playwright.mjs <port> [playwright args...]");
  process.exit(1);
}

const result = spawnSync("npx", ["playwright", "test", ...args], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, PLAYWRIGHT_PORT: port },
});

process.exit(result.status ?? 1);
