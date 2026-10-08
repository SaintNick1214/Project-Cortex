import "./accepted-reader-compat";
import { expect, test } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("native AST resolves exact selected22, preserves five file registrations and owns temporary output", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-artifact-inventory-"));
  try {
    const output = execFileSync(process.execPath, ["_goals/convex-backend-runtime-2026-10-02/qa/task03b2c1/inventory.mjs", directory], { encoding: "utf8" });
    const result = JSON.parse(output);
    expect(result.counts).toEqual({ registered: 22, public: 21, internal: 1, unresolved: 0, pendingFileRegistrations: 5 });
    expect(result.endpoints.every((row: { accepted03ADisposition: string }) => ["guard", "internalize"].includes(row.accepted03ADisposition))).toBe(true);
    expect(result.frozenFilePaths.every((row: { unchanged: boolean }) => row.unchanged)).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(directory, "public-path-inventory.json"), "utf8"))).toEqual(result);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  expect(fs.existsSync(directory)).toBe(false);
});
