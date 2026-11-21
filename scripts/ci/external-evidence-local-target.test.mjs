import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { claimTargetPointer } from "../external-evidence/local-target.mjs";

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(tmpdir(), "cortex-target-guard-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { directory, pointer: path.join(directory, "pointer") };
}

const occupied = error => error.cause?.code === "EEXIST" && /must be reconciled/.test(error.message);

test("pointer claim is private and writes the target through the acquired descriptor", async t => {
  const { pointer } = await fixture(t);
  const handle = await claimTargetPointer(pointer);
  try {
    assert.equal((await handle.stat()).mode & 0o777, 0o600);
    await handle.writeFile("/owned/target.json");
    assert.equal(await fs.readFile(pointer, "utf8"), "/owned/target.json");
  } finally { await handle.close(); }
});

test("existing pointer is refused without changing its contents", async t => {
  const { pointer } = await fixture(t);
  await fs.writeFile(pointer, "existing owner");
  await assert.rejects(claimTargetPointer(pointer), occupied);
  assert.equal(await fs.readFile(pointer, "utf8"), "existing owner");
});

for (const dangling of [false, true]) {
  test(`pointer claim refuses a ${dangling ? "dangling" : "live"} symlink`, async t => {
    const { directory, pointer } = await fixture(t);
    const victim = path.join(directory, "unrelated");
    if (!dangling) await fs.writeFile(victim, "untouched");
    await fs.symlink(victim, pointer);
    await assert.rejects(claimTargetPointer(pointer), occupied);
    assert.equal(await fs.readlink(pointer), victim);
    if (dangling) await assert.rejects(fs.readFile(victim), { code: "ENOENT" });
    else assert.equal(await fs.readFile(victim, "utf8"), "untouched");
  });
}

test("concurrent starters acquire exactly one pointer claim", async t => {
  const { pointer } = await fixture(t);
  const results = await Promise.allSettled(Array.from({ length: 16 }, () => claimTargetPointer(pointer)));
  const winners = results.filter(result => result.status === "fulfilled");
  try {
    assert.equal(winners.length, 1);
    for (const result of results.filter(result => result.status === "rejected")) assert.ok(occupied(result.reason));
    await winners[0].value.writeFile("only owner");
    assert.equal(await fs.readFile(pointer, "utf8"), "only owner");
  } finally { await Promise.all(winners.map(result => result.value.close())); }
});

test("replacing the claimed path cannot redirect the descriptor write", async t => {
  const { directory, pointer } = await fixture(t);
  const victim = path.join(directory, "unrelated");
  await fs.writeFile(victim, "untouched");
  const handle = await claimTargetPointer(pointer);
  try {
    await fs.unlink(pointer);
    await fs.symlink(victim, pointer);
    await handle.writeFile("private target path");
    assert.equal(await fs.readFile(victim, "utf8"), "untouched");
  } finally { await handle.close(); }
});

test("unexpected claim errors propagate without being relabeled as an existing owner", async t => {
  const { directory } = await fixture(t);
  await assert.rejects(claimTargetPointer(path.join(directory, "absent", "pointer")), { code: "ENOENT" });
});

function execute(script, setup) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", `
    import fs from "node:fs/promises";
    import net from "node:net";
    import { readFileSync } from "node:fs";
    import assert from "node:assert/strict";
    import { registerHooks } from "node:module";
    ${setup}
    await import(${JSON.stringify(script.href)});
  `], { encoding: "utf8", timeout: 10000 });
}

const starter = new URL("../external-evidence/start-local-target.mjs", import.meta.url);
test("starter claims its pointer before opening ports or starting any service", async t => {
  const { pointer } = await fixture(t);
  const result = execute(starter, `
    process.argv = [process.execPath, ${JSON.stringify(starter.pathname)}];
    const open = fs.open.bind(fs);
    fs.open = (name, ...args) => open(name === "/tmp/cortex-external-native-target-path" ? ${JSON.stringify(pointer)} : name, ...args);
    const access = fs.access.bind(fs);
    fs.access = (name, ...args) => access(name === "/tmp/cortex-external-native-target-path" ? ${JSON.stringify(pointer)} : name, ...args);
    net.createServer = () => {
      assert.equal(readFileSync(${JSON.stringify(pointer)}, "utf8"), "");
      throw new Error("stopped before service work");
    };
  `);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /stopped before service work/);
  assert.equal(await fs.readFile(pointer, "utf8"), "");
});

const qualification = new URL("../external-evidence/native-qualification.mjs", import.meta.url);
for (const [field, value] of [
  ["url", "https://untrusted.invalid"],
  ["url", "http://127.0.0.1:3487"],
  ["site", "https://untrusted.invalid"],
  ["site", "http://127.0.0.1:3486"],
]) {
  test(`qualification rejects untrusted ${field} ${value} before network/service work`, () => {
    const target = { url: "http://127.0.0.1:3486", site: "http://127.0.0.1:3487", [field]: value };
    const result = execute(qualification, `
      process.argv = [process.execPath, ${JSON.stringify(qualification.pathname)}, "/unused-sdk", "/unused-receipt.json"];
      fs.readFile = async name => {
        if (name === "/tmp/cortex-external-native-target-path") return "/unused-target.json";
        assert.equal(name, "/unused-target.json");
        return ${JSON.stringify(JSON.stringify(target))};
      };
      globalThis.fetch = () => { throw new Error("unexpected network request"); };
      registerHooks({ resolve(specifier, context, nextResolve) {
        if (specifier === "convex/browser") return { url: "data:text/javascript,export class ConvexHttpClient { constructor() { throw new Error('unexpected client'); } }", shortCircuit: true };
        return nextResolve(specifier, context);
      } });
    `);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /AssertionError/);
    assert.ok(result.stderr.includes(value));
    assert.doesNotMatch(result.stderr, /unexpected network request|unexpected client/);
  });
}
