import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as promises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { assembleCatalog } from "../scripts/assemble.mjs";

async function fixture(t) {
  const root = await promises.mkdtemp(path.join(os.tmpdir(), "catalog-file-race-"));
  t.after(() => promises.rm(root, { recursive: true, force: true }));
  const target = path.join(root, "package.json");
  await promises.writeFile(target, JSON.stringify({ name: "fixture", version: "1.1.0", dependencies: { "@cortexmemory/sdk": "^0.39.0", convex: "1.46.0" } }));
  const selection = { id: "basic", version: "1.1.0", source: root, provenance: "fixture/basic", manager: "npm", envNames: [], backend: true, graph: true };
  return { root, target, selection };
}
function mockOpen(t, implementation) {
  const original = fs.promises.open;
  t.mock.method(fs.promises, "open", (...args) => implementation(original, ...args));
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
}
test("a source swapped to a symlink between traversal and open is refused without reading foreign bytes", async t => {
  const { root, target, selection } = await fixture(t);
  const foreign = path.join(root, "foreign-sentinel"); await promises.writeFile(foreign, "private foreign sentinel");
  mockOpen(t, async (original, name, ...args) => {
    if (name === target) { await promises.unlink(target); await promises.symlink(foreign, target); }
    return original(name, ...args);
  });
  await assert.rejects(assembleCatalog([selection]), { code: "CATALOG_SOURCE_LINK" });
  assert.equal(await promises.readFile(foreign, "utf8"), "private foreign sentinel");
});
test("growth while an opened source is read refuses the candidate and closes the handle", async t => {
  const { target, selection } = await fixture(t); let opened;
  mockOpen(t, async (original, name, ...args) => {
    const handle = await original(name, ...args);
    if (name === target) {
      opened = handle; const read = handle.read.bind(handle); let changed = false;
      handle.read = async (...readArgs) => {
        if (!changed) { changed = true; await promises.appendFile(target, "growth sentinel"); }
        return read(...readArgs);
      };
    }
    return handle;
  });
  await assert.rejects(assembleCatalog([selection]), { code: "CATALOG_SOURCE_CHANGED" });
  await assert.rejects(opened.stat(), { code: "EBADF" });
});
