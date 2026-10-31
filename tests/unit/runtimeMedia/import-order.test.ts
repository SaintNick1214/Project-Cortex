import { afterEach, expect, test } from "@jest/globals";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ts from "typescript";

const run = promisify(execFile);
const owned: string[] = [];
afterEach(async () => { await Promise.all(owned.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

test.each(["media-jobs", "model-policy", "transcript"])("fresh native ESM evaluation from %s initializes the exact media schemas", async entry => {
  const root = await mkdtemp(join(tmpdir(), "cortex-media-import-")); owned.push(root);
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  await symlink(resolve("node_modules"), join(root, "node_modules"), "dir");
  // Transpile separate modules, retaining native import order and module cycles.
  // Jest's already-loaded module graph cannot exercise this initialization boundary.
  for (const name of ["media-jobs", "media-schemas", "model-policy", "transcript", "assets", "profile", "extraction", "memory-effort"]) {
    const source = await readFile(resolve(`src/domain/${name}.ts`), "utf8");
    const emitted = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 } });
    await writeFile(join(root, `${name}.js`), emitted.outputText);
  }
  const probe = `await import('./${entry}.js');
    const media = await import('./media-jobs.js');
    const policy = await import('./model-policy.js');
    const envelope = {version:1,prompt:'A circle.',options:{kind:'image',n:1,size:'1024x1024',quality:'low',outputFormat:'png'}};
    media.mediaEnvelopeSchema.parse(envelope);
    if (media.mediaEnvelopeSchema.safeParse({...envelope,options:{...envelope.options,n:2}}).success) throw new Error('altered options accepted');
    if (media.mediaInputBound(envelope,{version:1,options:envelope.options,inputProtocol:'none',maximumInputAssetBytes:0,maximumResultBytes:20000000,callbacks:false,terminalIdentity:'requested-only',usage:'optional'},'openai/gpt-image-1') <= 0) throw new Error('missing bound');
    if (policy.canonicalModelJson(envelope) !== policy.canonicalModelJson(media.mediaEnvelopeSchema.parse(envelope))) throw new Error('contract changed');`;
  await writeFile(join(root, "probe.mjs"), probe);
  const output = await run(process.execPath, [join(root, "probe.mjs")], { timeout: 10000 });
  expect(output.stderr).toBe("");
});
