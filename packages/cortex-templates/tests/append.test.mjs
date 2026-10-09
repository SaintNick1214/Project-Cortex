import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assembleCatalog, appendExistingCatalog, writeAssembly } from "../scripts/assemble.mjs";

test("append retains old bytes and selects a distinct version; same-version changes fail before publication", async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-catalog-append-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const source = path.join(temporary, "source"); await fs.mkdir(source);
  const select = version => ({id:"basic",version,source,provenance:`fixture/basic@${version}`,manager:"npm",envNames:[],backend:true,graph:false});
  const manifest = version => JSON.stringify({name:"fixture",version,type:"module",dependencies:{"@cortexmemory/sdk":"^0.38.0",convex:"1.46.0"}});
  await fs.writeFile(path.join(source,"package.json"),manifest("1.2.0")); await fs.writeFile(path.join(source,"main.js"),"export const value = 1;\n");
  const old = await assembleCatalog([select("1.2.0")],"1.1.0"); const published = path.join(temporary,"catalog"); await writeAssembly(published,old);
  const oldCatalog = await fs.readFile(path.join(published,"catalog.json"));
  await fs.writeFile(path.join(source,"package.json"),manifest("1.3.0")); await fs.writeFile(path.join(source,"main.js"),"export const value = 2;\n");
  const next = await assembleCatalog([select("1.3.0")],"1.2.0"), combined = await appendExistingCatalog(next,published);
  assert.deepEqual(combined.catalog.templates.map(item=>item.version),["1.2.0","1.3.0"]);
  assert.equal(combined.payloads.get("payloads/basic/1.2.0/main.js").bytes.toString(),"export const value = 1;\n");
  assert.equal(combined.payloads.get("payloads/basic/1.3.0/main.js").bytes.toString(),"export const value = 2;\n");
  assert.deepEqual(await fs.readFile(path.join(published,"catalog.json")),oldCatalog);
  await fs.writeFile(path.join(source,"package.json"),manifest("1.2.0"));
  const changed = await assembleCatalog([select("1.2.0")],"1.2.0");
  await assert.rejects(appendExistingCatalog(changed,published),/CATALOG_IMMUTABLE_VERSION_CHANGED/);
  assert.deepEqual(await fs.readFile(path.join(published,"catalog.json")),oldCatalog);
  await fs.writeFile(path.join(published,"payloads/basic/1.2.0/main.js"),"tamper");
  await assert.rejects(appendExistingCatalog(next,published),/CATALOG_EXISTING_CHANGED/);
});
