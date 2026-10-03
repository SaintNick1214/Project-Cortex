import fs from "node:fs";
import { spawnSync } from "node:child_process";

const output = "_goals/convex-backend-runtime-2026-10-02/qa/task03a/checks";
fs.mkdirSync(output, { recursive: true });
const npm12 = ["exec", "--offline", "--package=npm@12.2.0", "--", "npm"];
const tool = (...args) => [...npm12, "exec", "--offline", "--", ...args];
const checks = [
  { name: "npm-version", command: "npm", args: [...npm12, "--version"] },
  { name: "node-version", command: "node", args: ["--version"] },
  { name: "inventory", command: "node", args: ["work/backend-runtime/task03a/inventory.mjs"] },
  { name: "backend-strict", command: "npm", args: tool("tsc", "--project", "work/backend-runtime/task03a/tsconfig.backend.json", "--noEmit") },
  { name: "root-strict", command: "npm", args: tool("tsc", "--project", "work/backend-runtime/task03a/tsconfig.root.json", "--noEmit") },
  { name: "scoped-eslint", command: "npm", args: tool("eslint", "convex-dev/runtimeAuth.ts", "convex-dev/runtimeAuthSchema.ts", "convex-dev/schema.ts", "src/auth/verified.ts", "tests/unit/runtimeAuth", "--report-unused-disable-directives") },
  { name: "unit", command: "npm", args: tool("node", "--experimental-vm-modules", "node_modules/jest/bin/jest.js", "--testPathPatterns=tests/unit/runtimeAuth", "--runInBand", "--forceExit"),
    environment: { CONVEX_URL: "http://127.0.0.1:1", CONVEX_TEST_MODE: "local" } },
  { name: "diff-check", command: "git", args: ["diff", "--check"] },
];
const receipts = [];
for (const check of checks) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(check.command, check.args, { cwd: process.cwd(), encoding: "utf8",
    env: { ...process.env, ...check.environment }, timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
  fs.writeFileSync(`${output}/${check.name}.stdout.log`, result.stdout ?? "");
  fs.writeFileSync(`${output}/${check.name}.stderr.log`, result.stderr ?? "");
  const receipt = { ...check, cwd: process.cwd(), startedAt, finishedAt: new Date().toISOString(),
    exitCode: result.status, signal: result.signal, error: result.error?.message,
    stdout: `${output}/${check.name}.stdout.log`, stderr: `${output}/${check.name}.stderr.log` };
  receipts.push(receipt);
  process.stdout.write(`${check.name}: ${result.status === 0 ? "PASS" : "FAIL"}\n`);
}
fs.writeFileSync(`${output}/commands.json`, JSON.stringify(receipts, null, 2) + "\n");
if (receipts.some((receipt) => receipt.exitCode !== 0)) process.exitCode = 1;
