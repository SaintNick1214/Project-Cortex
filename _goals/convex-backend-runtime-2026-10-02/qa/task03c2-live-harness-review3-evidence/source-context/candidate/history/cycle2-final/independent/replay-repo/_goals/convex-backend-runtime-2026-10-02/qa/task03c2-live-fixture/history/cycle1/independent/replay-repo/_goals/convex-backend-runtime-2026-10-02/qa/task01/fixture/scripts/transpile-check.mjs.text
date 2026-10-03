import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { evidenceFile, fixtureDirectory, repo } from "./paths.mjs";

evidenceFile("type-only-transpile.json");
const before=readFileSync(resolve(repo,"_goals/convex-backend-runtime-2026-10-02/qa/task01-security/evidence/source-history/inference-before.text"),"utf8");
const after=readFileSync(resolve(fixtureDirectory,"convex/inference.ts"),"utf8");
assert.equal(before.replace('import type { Id } from "./_generated/dataModel";\n',""),after);
const compilerOptions={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,sourceMap:false,inlineSourceMap:false};
const original=ts.transpileModule(before,{compilerOptions,fileName:"inference.ts"}).outputText;
const current=ts.transpileModule(after,{compilerOptions,fileName:"inference.ts"}).outputText;
assert.equal(current,original);
const hash=value=>createHash("sha256").update(value).digest("hex");
writeFileSync(evidenceFile("type-only-transpile.json"),JSON.stringify({version:1,status:"PASS",typescript:ts.version,removedOnlyUnusedTypeImport:true,generatedJavaScriptByteIdentical:true,bytes:Buffer.byteLength(current),beforeJavaScriptSha256:hash(original),afterJavaScriptSha256:hash(current),beforeTypeScriptSha256:hash(before),afterTypeScriptSha256:hash(after),paidRepeatOrRedeployNeeded:false},null,2));
console.log(JSON.stringify({status:"PASS",removedOnlyUnusedTypeImport:true,generatedJavaScriptByteIdentical:true}));
