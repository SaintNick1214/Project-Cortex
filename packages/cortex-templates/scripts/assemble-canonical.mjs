/** Deliberate release assembly. Never invoked by CLI build or package lifecycle. */
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { assembleCatalog, writeAssembly, stableJson } from "./assemble.mjs";

const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const core = path.resolve(packageRoot, "../..");
/** @type {import('../contract.js').TemplateSource[]} */
const selections = [];
for (const [id, relative, manager] of [
  ["basic", "packages/cortex-cli/templates/basic", "npm"],
  ["vercel-ai-quickstart", "packages/vercel-ai-provider/quickstart", "npm"],
  ["chat-sdk", "packages/cortex-cli/templates/chat-sdk-quickstart", "pnpm"],
]) {
  const source = path.join(core, relative);
  // Only explicitly documented examples are read. Real dotenv files are excluded before traversal.
  const example = ".env.local.example";
  const bytes = await fs.readFile(path.join(source, example), "utf8");
  const envNames = [...new Set([...bytes.matchAll(/^([A-Z][A-Z0-9_]*)\s*=/gm)].map(match => match[1]))].sort();
  selections.push({ id: /** @type {import('../contract.js').TemplateId} */ (id),
    manager: /** @type {import('../contract.js').PackageManager} */ (manager), version: "1.1.0", source,
    provenance: `${relative}@1.1.0`, envExamples: [example], envNames, backend: true, graph: true });
}
const assembly = await assembleCatalog(selections, "1.0.0");
const destination = process.argv[2];
if (destination) {
  const result = await writeAssembly(path.resolve(destination), assembly);
  process.stdout.write(`${stableJson(result)}\n`);
} else {
  // Stage one new package outside the canonical trees; replace only this package's owned data.
  const temporary = path.join(path.dirname(packageRoot), `.cortex-catalog-${randomUUID()}`);
  const backups = [];
  const published = [];
  try {
    await writeAssembly(temporary, assembly);
    for (const name of ["payloads", "catalog.json"]) {
      const target = path.join(packageRoot, name), backup = path.join(temporary, `previous-${name}`);
      try {
        const stat = await fs.lstat(target);
        if (stat.isSymbolicLink() || (name === "payloads" ? !stat.isDirectory() : !stat.isFile())) throw new Error("CATALOG_OUTPUT_KIND");
        await fs.rename(target, backup); backups.push({ target, backup });
      } catch (error) { if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error; }
      await fs.rename(path.join(temporary, name), target); published.push(target);
    }
    process.stdout.write(`${stableJson({ catalogHash: assembly.receipt.catalogHash, templates: assembly.catalog.templates.length })}\n`);
  } catch (error) {
    for (const target of published.reverse()) await fs.rm(target, { recursive: true, force: true });
    for (const { target, backup } of backups.reverse()) await fs.rename(backup, target);
    throw error;
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}
