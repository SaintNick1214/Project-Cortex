import "./accepted-reader-compat";
import { expect, test } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("native catalog composes accepted selected22 and later five file closures while preserving historical inventory", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-artifact-inventory-"));
  try {
    const output = execFileSync(process.execPath, ["_goals/convex-backend-runtime-2026-10-02/qa/task03-foundation-catalog-repair/compose.mjs", directory], { encoding: "utf8" });
    const composition = JSON.parse(output);
    expect(composition.counts).toEqual({ selected22: 22, approvedLaterFileDeclarations: 5, approvedLaterStats: 2, artifactModuleRegistrations: 27, registryModuleRegistrations: 48 });
    expect(composition.negativeControls).toBe(4);
    const result = composition.historicalOriginalInventory;
    expect(result.counts).toEqual({ registered: 22, public: 21, internal: 1, unresolved: 0, pendingFileRegistrations: 5 });
    expect(result.endpoints.every((row: { accepted03ADisposition: string }) => ["guard", "internalize"].includes(row.accepted03ADisposition))).toBe(true);
    expect(result.frozenFilePaths.every((row: { unchanged: boolean }) => row.unchanged)).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(directory, "historical-artifact", "output", "public-path-inventory.json"), "utf8"))).toEqual(result);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  expect(fs.existsSync(directory)).toBe(false);
});
