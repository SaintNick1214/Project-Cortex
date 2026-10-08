import { describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import * as immutable from "../../../convex-dev/immutable";
import * as mutable from "../../../convex-dev/mutable";
import * as users from "../../../convex-dev/users";
import * as sessions from "../../../convex-dev/sessions";
const internal = new Set(["immutable:purgeAll", "mutable:purgeAll", "sessions:expireIdle", "sessions:incrementMessageCount", "sessions:incrementMemoryCount"]);
describe("import-aware AST and native Convex registration visibility", () => {
  it("actual framework registrations are exactly 41=36+5 with no public reference credentials", () => {
    const paths: string[] = [];
    for (const [module, exports] of Object.entries({ immutable, mutable, users, sessions })) for (const [name, value] of Object.entries(exports)) {
      const registration = value as unknown as { _handler?: unknown; isPublic?: boolean; isInternal?: boolean; exportArgs(): string };
      if (!registration._handler) continue; const path = `${module}:${name}`; paths.push(path);
      expect(registration.isInternal === true).toBe(internal.has(path)); expect(registration.isPublic === true).toBe(!internal.has(path));
      if (registration.isPublic) expect(JSON.parse(registration.exportArgs()).value.reference).toBeUndefined();
    }
    expect(paths).toHaveLength(41); expect(paths.filter((path) => internal.has(path))).toHaveLength(5);
  });
  it("retained import-aware AST finds the exact baseline paths with zero unresolved", () => {
    const base = "_goals/convex-backend-runtime-2026-10-02/qa";
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-metadata-inventory-"));
    try {
      const result = spawnSync(process.execPath, [`${base}/task03b2a/inventory.mjs`, temporary], { encoding: "utf8", timeout: 10000 }); expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: "" });
      const actual = JSON.parse(fs.readFileSync(path.join(temporary, "public-path-inventory.json"), "utf8"));
      const original = JSON.parse(fs.readFileSync(`${base}/task03a/public-path-inventory.json`, "utf8"));
      const selected = original.endpoints.filter((row: { path: string }) => /^(immutable|mutable|users|sessions):/.test(row.path));
      expect(actual.completeness.unresolved).toEqual([]); expect(actual.completeness.counts).toMatchObject({ registered: 41, public: 36, internal: 5, registeredBuilderCalls: 41, resolvedExports: 41 });
      expect(actual.endpoints.map((row: { path: string }) => row.path).sort()).toEqual(selected.map((row: { path: string }) => row.path).sort());
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
});
