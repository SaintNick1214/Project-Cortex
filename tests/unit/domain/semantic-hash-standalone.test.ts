import { expect, it } from "@jest/globals";
import { createHash, webcrypto } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

it("actual profile loads as an isolated policy-preflight mjs with no common sibling and preserves exact hash bytes", async () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const temp = await mkdtemp(join(root, ".semantic-hash-standalone-"));
  try {
    const output = join(temp, ".sandbox-policy-preflight"); await mkdir(output);
    await expect(access(join(temp, "common"))).rejects.toMatchObject({ code: "ENOENT" });
    const source = await readFile(join(root, "src/domain/profile.ts"), "utf8");
    // Exact syntax-only producer settings from the standalone installed policy preflight.
    const emitted = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
    const file = join(output, "profile.mjs"); await writeFile(file, emitted);
    const values = ["", "abc", "\ufeffsource", "é/e\u0301/🧠", "x\ud800y\udfff", "a".repeat(55), "b".repeat(64), "x".repeat(32768), "x".repeat(180000), "a".repeat(1000000)];
    const program = `import {readFileSync} from "node:fs";
const values=JSON.parse(readFileSync(0,"utf8"));
const {semanticHash}=await import(process.argv[1]);
const pending=values.map(value=>semanticHash(value));
if(!pending.every(value=>value instanceof Promise))throw Error("Async hash API changed");
console.log(JSON.stringify(await Promise.all(pending)));`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", program, pathToFileURL(file).href], {
      input: JSON.stringify(values), encoding: "utf8", timeout: 10000,
    });
    expect(result.error).toBeUndefined(); expect(result.signal).toBeNull();
    if (result.status !== 0) throw new Error(`Actual isolated profile import/hash failed: ${result.stderr}`);
    const hashes: unknown = JSON.parse(result.stdout);
    const node = values.map(value => createHash("sha256").update(value, "utf8").digest("hex"));
    const previous = await Promise.all(values.map(async value => Buffer.from(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).toString("hex")));
    expect(hashes).toEqual(node); expect(hashes).toEqual(previous);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
