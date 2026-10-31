import { describe, it, expect } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SCHEMA_COMPOSER } from "../template-backend.js";

const require = createRequire(import.meta.url);
const core = fileURLToPath(new URL("../../../../../", import.meta.url));

describe("actual schema composer ES2021 compilation and own-table semantics", () => {
  it("compiles the emitted and both immutable 1.2 schemas without raising ES2021 libs, and runs their collision guards", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-composer-es2021-"));
    try {
      fs.writeFileSync(path.join(root, "package.json"), '{"type":"commonjs"}');
      fs.mkdirSync(path.join(root, "node_modules"));
      fs.symlinkSync(path.dirname(require.resolve("convex/package.json")), path.join(root, "node_modules/convex"), "dir");
      fs.writeFileSync(path.join(root, "cortex.schema.ts"), `import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export default defineSchema({ owned: defineTable({ value: v.string() }) }, { schemaValidation: true });
`);
      fs.writeFileSync(path.join(root, "app.schema.ts"), `import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
const table = defineTable({ value: v.string() });
const scenario = process.env.COMPOSER_CASE;
const tables: Record<string, typeof table> = scenario?.startsWith("null-") ? Object.create(null) : { other: table };
if (scenario?.startsWith("shadow-")) Object.defineProperty(tables, "hasOwnProperty", { value: table, enumerable: true });
if (scenario?.endsWith("duplicate")) tables.owned = table;
if (scenario === "inherited") Object.setPrototypeOf(tables, { owned: table });
export default defineSchema(tables, { schemaValidation: true });
`);
      fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: {
        target: "ES2021", lib: ["ES2021", "DOM"], module: "Node16", moduleResolution: "Node16", types: ["node"], strict: true,
        esModuleInterop: true, skipLibCheck: true, outDir: "out", typeRoots: [path.dirname(path.dirname(require.resolve("@types/node/package.json")))],
      }, include: ["*.ts"] }));
      const compile = () => spawnSync(process.execPath, [require.resolve("typescript/bin/tsc"), "--project", path.join(root, "tsconfig.json")], { cwd: root, encoding: "utf8", timeout: 30000 });
      fs.writeFileSync(path.join(root, "schema.ts"), SCHEMA_COMPOSER.replace("Object.prototype.hasOwnProperty.call(appSchema.tables, name)", "Object.hasOwn(appSchema.tables, name)"));
      const before = compile();
      expect(before.error).toBeUndefined();
      expect(before.status).toBe(2);
      expect(before.stdout).toContain("TS2550");
      expect(before.stdout).toContain("hasOwn");
      fs.writeFileSync(path.join(root, "schema.ts"), SCHEMA_COMPOSER);
      for (const [name, source] of [
        ["vercel", "packages/cortex-templates/payloads/vercel-ai-quickstart/1.2.0/convex/schema.ts"],
        ["chat", "packages/cortex-templates/payloads/chat-sdk/1.2.0/convex/schema.ts"],
      ]) fs.copyFileSync(path.join(core, source), path.join(root, `${name}.ts`));
      const after = compile();
      expect({ status: after.status, error: after.error, diagnostics: after.stdout + after.stderr }).toEqual({ status: 0, error: undefined, diagnostics: "" });
      for (const entry of ["schema", "vercel", "chat"]) {
        for (const scenario of ["ordinary", "duplicate", "shadow-duplicate", "shadow-clear", "null-duplicate", "null-clear", "inherited"]) {
          const code = `const schema = require('./out/${entry}.js').default; console.log(JSON.stringify({ keys: Object.keys(schema.tables), valid: schema.schemaValidation }));`;
          const result = spawnSync(process.execPath, ["-e", code], { cwd: root, env: { ...process.env, COMPOSER_CASE: scenario }, encoding: "utf8", timeout: 10000 });
          expect(result.error).toBeUndefined();
          if (scenario.endsWith("duplicate")) {
            expect(result.status).toBe(1);
            expect(result.stderr).toContain("Duplicate canonical table: owned");
            expect(result.stdout).toBe("");
          } else {
            expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: "" });
            const schema = JSON.parse(result.stdout) as { keys: string[]; valid: boolean };
            expect(schema.valid).toBe(true);
            expect(schema.keys).toEqual(scenario === "null-clear" ? ["owned"] : scenario === "shadow-clear" ? ["owned", "other", "hasOwnProperty"] : ["owned", "other"]);
          }
        }
      }
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }, 60000);
});
