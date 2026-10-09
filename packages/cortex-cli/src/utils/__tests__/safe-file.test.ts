import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FileHandle } from "node:fs/promises";

const actual = await import("node:fs/promises");
let beforeOpen: ((file: string) => void) | undefined;
let afterOpen: ((handle: FileHandle) => void) | undefined;
jest.unstable_mockModule("node:fs/promises", () => ({
  ...actual,
  open: async (...args: Parameters<typeof actual.open>) => {
    beforeOpen?.(String(args[0]));
    const handle = await actual.open(...args);
    afterOpen?.(handle);
    return handle;
  },
}));
const { readRegularFile, readRegularFileSync, UnsafeFileError } = await import("../safe-file.js");
const { readAdmissionFile } = await import("../bootstrap-admission.js");
const { readBackendProjectFile } = await import("../schema-sync.js");
const { resolveInstalledConvex } = await import("../convex-runner.js");
const { resolveTemplateCatalog } = await import("../templates/resolver.js");
const { setupGraph } = await import("../graph/service.js");
let root: string;
beforeEach(() => { root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cortex-file-race-"))); });
afterEach(() => { beforeOpen = undefined; afterOpen = undefined; jest.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });
function file(name = "selected.json", bytes = "selected", mode = 0o600): string {
  const target = path.join(root, name); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, { mode }); return target;
}
function swapToLink(target: string): void {
  const foreign = file("foreign.json", "foreign sentinel");
  fs.unlinkSync(target); fs.symlinkSync(foreign, target);
}

it("sync and async readers return the opened file bytes and its executable metadata", async () => {
  const target = file("run.sh", "selected script", 0o700);
  for (const result of [readRegularFileSync(target), await readRegularFile(target)]) {
    expect(result.bytes.toString()).toBe("selected script"); expect(result.stat.mode & 0o777).toBe(0o700);
  }
});
it("a backend path swapped after path preflight refuses a symlink instead of reading its target", () => {
  const target = file(); const original = fs.openSync;
  jest.spyOn(fs, "openSync").mockImplementation((name, flags, mode) => {
    if (String(name) === target) swapToLink(target);
    return original(name, flags, mode);
  });
  expect(() => readBackendProjectFile(root, "selected.json")).toThrow("Expected regular file");
  expect(fs.readFileSync(path.join(root, "foreign.json"), "utf8")).toBe("foreign sentinel");
});
it("a pinned Convex manifest swapped after path preflight refuses before selecting a binary", () => {
  const target = file("node_modules/convex/package.json", '{"name":"convex","version":"1.46.0","bin":"bin.js"}');
  file("node_modules/convex/bin.js", "selected"); const original = fs.openSync;
  jest.spyOn(fs, "openSync").mockImplementation((name, flags, mode) => {
    if (String(name) === target) swapToLink(target);
    return original(name, flags, mode);
  });
  expect(() => resolveInstalledConvex(root)).toThrow("Installed Convex manifest must be a regular file");
});
it("template package file substitution at open refuses a link after directory preflight", async () => {
  const target = file("package.json", '{"name":"@cortexmemory/templates","version":"1.1.0"}');
  beforeOpen = name => { if (name === target) swapToLink(target); };
  await expect(resolveTemplateCatalog(root)).rejects.toThrow("TEMPLATE_PACKAGE_KIND_OR_BUDGET");
});
it("graph ownership observations refuse a substituted symlink after path preflight", async () => {
  const target = file(".cortex/graph/compose.json", "{}");
  beforeOpen = name => { if (name === target) swapToLink(target); };
  await expect(setupGraph(root, { graph: "neo4j", dryRun: true })).rejects.toThrow("GRAPH_USER_FILES_CONFLICT");
});
it("graph credential reads validate the opened file's private mode and close on refusal", async () => {
  const target = file("graph-input.json", '{"NEO4J_USERNAME":"neo4j","NEO4J_PASSWORD":"selected"}');
  let opened: FileHandle | undefined;
  beforeOpen = name => { if (name === target) fs.chmodSync(target, 0o644); };
  afterOpen = handle => { opened = handle; };
  await expect(setupGraph(root, { graph: "neo4j", graphMode: "existing", graphUri: "bolt://127.0.0.1:45510", credentialsFile: target, dryRun: true })).rejects.toThrow("GRAPH_FILE_INVALID");
  await expect(opened!.stat()).rejects.toMatchObject({ code: "EBADF" });
});
it("admission validates the opened replacement's private permissions before accepting bytes", async () => {
  const target = file(); let opened: FileHandle | undefined;
  beforeOpen = name => { if (name === target) fs.chmodSync(target, 0o644); };
  afterOpen = handle => { opened = handle; };
  await expect(readAdmissionFile(target, true)).rejects.toThrow("ADMISSION_METADATA_PERMISSIONS");
  await expect(opened!.stat()).rejects.toMatchObject({ code: "EBADF" });
});
it("admission retains stable fingerprint, missing-file and symlink refusals", async () => {
  const target = file(); const result = await readAdmissionFile(target, true);
  expect(result?.bytes.toString()).toBe("selected"); expect(result?.fingerprint.path).toBe(target);
  expect(await readAdmissionFile(path.join(root, "missing"))).toBeUndefined();
  swapToLink(target); await expect(readAdmissionFile(target)).rejects.toThrow("ADMISSION_SOURCE_UNSAFE");
});
it("bounded reads reject growth on the open descriptor and close it on failure", async () => {
  const target = file(); let opened: FileHandle | undefined;
  afterOpen = handle => {
    opened = handle; const original = handle.read.bind(handle); let changed = false;
    handle.read = ((...args: Parameters<typeof handle.read>) => {
      if (!changed) { changed = true; fs.appendFileSync(target, "unexpected growth"); }
      return original(...args);
    }) as typeof handle.read;
  };
  await expect(readRegularFile(target, { maxBytes: 8 })).rejects.toBeInstanceOf(UnsafeFileError);
  await expect(opened!.stat()).rejects.toMatchObject({ code: "EBADF" });
});
it("single-link, regular-kind and budget policies are checked on the opened descriptor", async () => {
  const target = file(); fs.linkSync(target, path.join(root, "alias"));
  expect(() => readRegularFileSync(target, { singleLink: true })).toThrow(UnsafeFileError);
  await expect(readRegularFile(target, { singleLink: true })).rejects.toBeInstanceOf(UnsafeFileError);
  expect(() => readRegularFileSync(root)).toThrow(UnsafeFileError);
  await expect(readRegularFile(root)).rejects.toBeInstanceOf(UnsafeFileError);
  expect(() => readRegularFileSync(target, { maxBytes: 1 })).toThrow(UnsafeFileError);
  await expect(readRegularFile(target, { maxBytes: 1 })).rejects.toBeInstanceOf(UnsafeFileError);
});
