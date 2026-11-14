/** Local prerelease staging only. Never publishes or mutates the source checkout. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

export const CANDIDATE_VERSION = "0.40.0-external-evidence.0";
export const BASE_REVISION = "e774b9e25da73191d8f3a27b169b3229fb6e0397";
const includedDocs = ["docs/external-evidence.md", "docs/external-evidence-integration.md"];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const allowed = name => /^(?:src|convex-dev|scripts|tests|docs)\//.test(name) || !name.includes("/");
const excluded = name => /(?:^|\/)(?:node_modules|dist|\.git|_goals|_research|coverage)(?:\/|$)/.test(name) || /(?:^|\/)\.env(?:\.|$)/.test(name);
function command(binary, args, cwd, maximum = 64 * 1024 * 1024) {
  return execFileSync(binary, args, { cwd, encoding: "utf8", maxBuffer: maximum, stdio: ["ignore", "pipe", "pipe"] });
}
async function write(root, name, bytes) { await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true }); await fs.writeFile(path.join(root, name), bytes); }
async function sources(root) {
  const tracked = command("git", ["ls-files", "-z", "--", "src", "convex-dev", "scripts", "tests", "docs", ":/*"], root).split("\0").filter(Boolean);
  const extra = command("git", ["ls-files", "--others", "--exclude-standard", "-z"], root).split("\0").filter(Boolean);
  const names = [...new Set([...tracked, ...extra])].filter(name => allowed(name) && !excluded(name)).sort();
  const files = [];
  for (const name of names) {
    let stat;
    try { stat = await fs.lstat(path.join(root, name)); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    if (!stat.isFile()) { if (stat.isSymbolicLink()) continue; throw new Error("Unexpected source file kind: " + name); }
    const bytes = await fs.readFile(path.join(root, name));
    files.push({ path: name, sha256: hash(bytes), size: bytes.length });
  }
  return { files, extra: extra.filter(name => allowed(name) && !excluded(name)) };
}
function overlay(originalPackage, originalLock) {
  const pkg = structuredClone(originalPackage), lock = structuredClone(originalLock);
  assert.equal(pkg.version, "0.39.0"); assert.equal(lock.version, pkg.version); assert.equal(lock.packages[""].version, pkg.version);
  pkg.version = CANDIDATE_VERSION; lock.version = CANDIDATE_VERSION; lock.packages[""].version = CANDIDATE_VERSION;
  for (const name of includedDocs) if (!pkg.files.includes(name)) pkg.files.push(name);
  return { pkg, lock, changes: [
    { path: "package.json", pointer: "/version", before: originalPackage.version, after: CANDIDATE_VERSION },
    { path: "package.json", pointer: "/files", before: originalPackage.files, after: pkg.files },
    { path: "package-lock.json", pointer: "/version", before: originalLock.version, after: CANDIDATE_VERSION },
    { path: "package-lock.json", pointer: "/packages//version", before: originalLock.packages[""].version, after: CANDIDATE_VERSION },
  ] };
}

/** Includes every changed product/test/doc/script file, including untracked additions. */
export async function sourcePatch(root) {
  assert.equal(command("git", ["rev-parse", "HEAD"], root).trim(), BASE_REVISION);
  const inventory = await sources(root);
  let patch = command("git", ["diff", "--binary", "--no-ext-diff", "HEAD", "--", "src", "convex-dev", "scripts", "tests", "docs", "package.json", "package-lock.json"], root);
  for (const name of inventory.extra.sort()) {
    const stat = await fs.lstat(path.join(root, name));
    if (!stat.isFile()) continue;
    const child = spawnSync("git", ["diff", "--no-index", "--binary", "--no-ext-diff", "--", "/dev/null", name], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (child.error) throw child.error;
    assert.ok(child.status === 0 || child.status === 1, child.stderr);
    patch += child.stdout;
  }
  return { patch, inventory };
}

async function verifyReconstruction(root, patch) {
  const temporary = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "cortex-external-reconstruct-")));
  try {
    const names = [...new Set([...patch.matchAll(/^(?:\+\+\+ b\/|--- a\/)(.+)$/gm)].map(match => match[1]))].sort();
    for (const name of names) {
      assert.ok(allowed(name) && !excluded(name) && !name.split("/").includes(".."));
      const base = spawnSync("git", ["show", BASE_REVISION + ":" + name], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
      if (base.status === 0) await write(temporary, name, base.stdout);
      else assert.match(String(base.stderr), /does not exist|exists on disk, but not in/);
    }
    const patchFile = path.join(temporary, "candidate.patch"); await fs.writeFile(patchFile, patch);
    const gitDirectory = command("git", ["rev-parse", "--absolute-git-dir"], root).trim();
    // git apply resolves relative paths from cwd even with --work-tree supplied.
    // Execute inside the temporary tree and bind only the read-only Git metadata.
    command("git", ["--git-dir=" + gitDirectory, "--work-tree=" + temporary, "apply", "--check", patchFile], temporary);
    command("git", ["--git-dir=" + gitDirectory, "--work-tree=" + temporary, "apply", patchFile], temporary);
    for (const name of names) {
      const expected = await fs.readFile(path.join(root, name)).catch(error => { if (error.code === "ENOENT") return null; throw error; });
      const actual = await fs.readFile(path.join(temporary, name)).catch(error => { if (error.code === "ENOENT") return null; throw error; });
      assert.deepEqual(actual, expected, "Base + patch reconstruction mismatch: " + name);
    }
    return { verified: true, changedFiles: names.length, method: "Read exact base file bytes into a separate temporary work tree, git apply --check then git apply source.patch, compare every reconstructed changed file byte-for-byte with captured checkout." };
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

export async function prepareCandidate(root, artifacts) {
  root = await fs.realpath(root); artifacts = path.resolve(artifacts);
  const capture = await sourcePatch(root);
  const stage = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "cortex-external-package-")));
  // A source-only staging directory outside every Git worktree prevents npm/tsup
  // from accidentally attributing this uncommitted candidate to an ancestor HEAD.
  const probe = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: stage, encoding: "utf8" });
  assert.notEqual(probe.status, 0, "Stage unexpectedly belongs to a Git checkout");
  for (const file of capture.inventory.files) {
    const bytes = await fs.readFile(path.join(root, file.path));
    assert.equal(hash(bytes), file.sha256, "Source changed during capture: " + file.path);
    await write(stage, file.path, bytes);
  }
  const pkg = JSON.parse(await fs.readFile(path.join(stage, "package.json"), "utf8"));
  const lock = JSON.parse(await fs.readFile(path.join(stage, "package-lock.json"), "utf8"));
  const selected = overlay(pkg, lock);
  await write(stage, "package.json", json(selected.pkg)); await write(stage, "package-lock.json", json(selected.lock));
  await fs.symlink(await fs.realpath(path.join(root, "node_modules")), path.join(stage, "node_modules"), "dir");
  await fs.mkdir(artifacts, { recursive: true });
  const stageState = { stage, sourceRoot: root, artifacts, version: CANDIDATE_VERSION, baseRevision: BASE_REVISION,
    sourcePatchSha256: hash(capture.patch), inventorySha256: hash(json(capture.inventory.files)), overlay: selected.changes };
  await write(artifacts, "candidate-stage.json", json(stageState));
  return stageState;
}

export async function buildAndPack(state) {
  const logPath = path.join(state.artifacts, "candidate-build.log");
  const built = spawnSync("npm", ["run", "build", "--workspaces=false"], { cwd: state.stage, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
  await fs.writeFile(logPath, (built.stdout ?? "") + (built.stderr ?? ""));
  if (built.error) throw built.error;
  assert.equal(built.status, 0, "Candidate build failed; inspect " + logPath);
  const pack = JSON.parse(command("npm", ["pack", "--workspaces=false", "--ignore-scripts", "--json", "--pack-destination", state.artifacts], state.stage))[0];
  const archive = path.join(state.artifacts, pack.filename);
  const listing = command("tar", ["-tzf", archive], state.stage).trim().split("\n");
  assert.ok(listing.every(name => name.startsWith("package/") && !name.includes("\\") && !name.split("/").includes("..")));
  assert.ok(listing.every(name => !/(?:^|\/)(?:node_modules|tests|\.git|_goals|_research)(?:\/|$)/.test(name) && !/(?:^|\/)\.env(?:\.|$)/.test(name)));
  for (const doc of includedDocs) assert.ok(listing.includes("package/" + doc), "Missing packaged guide: " + doc);
  const extracted = path.join(state.stage, "packed-sdk");
  await fs.rm(extracted, { recursive: true, force: true }); await fs.mkdir(extracted);
  command("tar", ["-xzf", archive, "--strip-components=1", "-C", extracted], state.stage);
  const manifestBytes = await fs.readFile(path.join(extracted, "dist/backend/v1/manifest.json"));
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.sdkVersion, CANDIDATE_VERSION); assert.equal(manifest.distributionId, "cortex-backend-v1-sdk-" + CANDIDATE_VERSION);
  for (const file of manifest.files) {
    assert.equal(hash(await fs.readFile(path.join(extracted, "dist/backend/v1", file.path))), file.sha256, "Backend manifest mismatch: " + file.path);
    assert.equal(hash(await fs.readFile(path.join(state.stage, file.sourcePath))), file.sourceSha256, "Source closure mismatch: " + file.sourcePath);
  }
  for (const name of ["runtimeExternalSources.ts", "runtimeExternalSourcesSchema.ts", "runtimeChanges.ts", "runtimeChangesSchema.ts", "runtimeChangesStore.ts", "runtimeExternalErasure.ts", "runtimeSourceDependencies.ts", "runtimeSourceConsumerErasure.ts"]) assert.ok(manifest.files.some(file => file.path === name), "External evidence closure missing: " + name);
  const metadata = JSON.parse(await fs.readFile(path.join(extracted, "package.json"), "utf8"));
  assert.equal(metadata.version, CANDIDATE_VERSION); assert.equal(metadata.gitHead, undefined);
  const result = { ...state, archive, extracted, archiveSha256: hash(await fs.readFile(archive)), archiveSize: (await fs.stat(archive)).size,
    backendManifestSha256: hash(manifestBytes), backendFiles: manifest.files.length, backendTables: manifest.tables.length,
    packFiles: pack.files.map(file => ({ path: file.path, size: file.size, mode: file.mode })) };
  await write(state.artifacts, "candidate-stage.json", json(result));
  await write(state.artifacts, "package-files.json", json(result.packFiles));
  return result;
}

/** Called only after final source/doc freeze. Rebuild if source bytes changed. */
export async function finalizeCandidate(state) {
  const capture = await sourcePatch(state.sourceRoot);
  const reconstruction = await verifyReconstruction(state.sourceRoot, capture.patch);
  const before = new Map((await sources(state.sourceRoot)).files.map(file => [file.path, file]));
  // A provisional stage must not retain a file deleted before the final freeze.
  for (const directory of ["src", "convex-dev", "scripts", "tests", "docs"]) await fs.rm(path.join(state.stage, directory), { recursive: true, force: true });
  for (const file of capture.inventory.files) {
    const current = await fs.readFile(path.join(state.sourceRoot, file.path));
    assert.equal(hash(current), file.sha256, "Source changed while finalizing: " + file.path);
    await write(state.stage, file.path, current);
  }
  const pkg = JSON.parse(await fs.readFile(path.join(state.sourceRoot, "package.json"), "utf8"));
  const lock = JSON.parse(await fs.readFile(path.join(state.sourceRoot, "package-lock.json"), "utf8"));
  const selected = overlay(pkg, lock);
  await write(state.stage, "package.json", json(selected.pkg)); await write(state.stage, "package-lock.json", json(selected.lock));
  const final = await buildAndPack({ ...state, overlay: selected.changes, sourcePatchSha256: hash(capture.patch), inventorySha256: hash(json(capture.inventory.files)) });
  const after = await sources(state.sourceRoot);
  assert.deepEqual(after.files, [...before.values()], "Source changed during final build");
  const sourceInventory = [];
  for (const file of capture.inventory.files) {
    const staged = await fs.readFile(path.join(state.stage, file.path));
    const expected = file.path === "package.json" ? Buffer.from(json(selected.pkg)) : file.path === "package-lock.json" ? Buffer.from(json(selected.lock)) : await fs.readFile(path.join(state.sourceRoot, file.path));
    assert.equal(hash(staged), hash(expected), "Undeclared staging source change: " + file.path);
    sourceInventory.push({ ...file, stagedSha256: hash(staged), overlay: file.path === "package.json" || file.path === "package-lock.json" });
  }
  await write(state.artifacts, "source.patch", capture.patch);
  await write(state.artifacts, "source-inventory.json", json(sourceInventory));
  await write(state.artifacts, "packaging-overlay.json", json({ version: 1, changes: selected.changes }));
  const receipt = { schemaVersion: 1, version: CANDIDATE_VERSION, source: { baseRevision: BASE_REVISION, committed: false,
    patch: "source.patch", patchSha256: hash(capture.patch), inventory: "source-inventory.json", inventorySha256: hash(json(sourceInventory)),
    sourceByteEquivalence: "All active captured source bytes equal checkout bytes; only root package.json/version+files and lock root versions differ as declared.", reconstruction },
    overlay: { file: "packaging-overlay.json", sha256: hash(json({ version: 1, changes: selected.changes })), workspaceManifestUnmodified: true, dependencyPinsUnmodified: true },
    package: { name: "@cortexmemory/sdk", version: CANDIDATE_VERSION, file: path.basename(final.archive), sha256: final.archiveSha256, size: final.archiveSize,
      backendManifestSha256: final.backendManifestSha256, backendFiles: final.backendFiles, backendTables: final.backendTables,
      includesDocs: includedDocs, privateFixturesIncluded: false, dependencySymlinksIncluded: false, gitHead: null },
    builder: { node: process.version, npm: command("npm", ["--version"], state.stage).trim(), declaredPackageManager: pkg.packageManager,
      packageManagerDeviation: "Repository declares npm 12.2.0; the actual builder version above was used. No installation or dependency resolution was performed for staging; the already installed locked dependencies were borrowed.",
      build: "npm run build --workspaces=false", pack: "npm pack --workspaces=false --ignore-scripts --json", stageOutsideGit: true },
    versionSurfaces: { packageMetadata: CANDIDATE_VERSION, backendManifest: CANDIDATE_VERSION, sourceWorkspace: "0.39.0", runtimeSdkVersionConstant: "No SDK_VERSION or hardcoded 0.39.0 exists in src/; public protocol version:1 is unchanged.", publishedCliFixedSdkVersion: "0.39.0", cliDisposition: "CLI fixed-version installer/schema commands intentionally unchanged and separately tested to reject this prerelease; backend install --sdk-path accepts the digest-bound candidate." },
    provenance: "Uncommitted local candidate identified by base revision + source patch hash + declared packaging overlay; no commit or publication.",
    limitations: ["Build dependencies borrowed from isolated existing install; clean consumer installation is qualified separately.", "No JWT, provider, ANN or production deployment certification is implied by this package receipt."] };
  await write(state.artifacts, "artifact-receipt.json", json(receipt));
  for (const doc of includedDocs) await write(state.artifacts, path.basename(doc), await fs.readFile(path.join(state.stage, doc)));
  await write(state.artifacts, "RECONSTRUCT.md", `# Local external evidence candidate\n\nVersion: ${CANDIDATE_VERSION}. This is an unpublished local artifact.\n\nThe exact uncommitted source is identified by base revision \`${BASE_REVISION}\`, \`source.patch\` SHA-256 \`${hash(capture.patch)}\`, and \`packaging-overlay.json\`. Verify \`SHA256SUMS\` before use.\n\nReconstruct in a separate checkout of the Project-Cortex repository at that base revision:\n\n1. Apply \`git apply /absolute/path/source.patch\`. The patch includes untracked product code, tests, qualification scripts and both guides. It excludes generated build output and the local node_modules symlink.\n2. Inspect \`packaging-overlay.json\`. On a separate staging copy, set only the root package version and the two root lock versions to \`${CANDIDATE_VERSION}\`, and append the two named guide files to the package files allowlist. Do not change workspace dependency pins.\n3. Use Node >=24.15 (observed builder ${process.version}), install the repository's locked dependencies in the reconstructed, unoverlaid 0.39 checkout, reuse that installed dependency tree from the separate staging copy, then run \`npm run build --workspaces=false\`. This order preserves the existing 0.39 workspace compatibility pins while building the 0.40 staging overlay. The observed builder npm version and its deviation from the declared packageManager are in \`artifact-receipt.json\`. Staging here borrowed the isolated installed dependency tree; no dependency update occurred.\n4. Run \`npm pack --workspaces=false --ignore-scripts --json\`. Compare all source/backend manifest hashes and package contents. npm tar bytes can depend on the npm version; the supplied tarball hash is the consumable identity.\n5. Run \`node scripts/external-evidence/verify-package.mjs /absolute/path/cortexmemory-sdk-${CANDIDATE_VERSION}.tgz /absolute/path/new-receipts\` to qualify that artifact in a fresh consumer. The fixture seeds a consumer lock from qualified repository versions for offline installation and explicitly includes optional model peers for the legacy root browser check. No model is contacted.\n\nInstall the supplied tarball with \`npm install /absolute/path/cortexmemory-sdk-${CANDIDATE_VERSION}.tgz\`. Follow \`external-evidence-integration.md\` for the published CLI0.39 additive \`backend install --sdk-path\` route and reviewed upgrade behavior. CLI0.39's fixed-version install/init/schema commands do not accept this prerelease. No deployment, production data change, commit or package publication is authorized or performed by these scripts.\n`);
  const checksums = [path.basename(final.archive), "source.patch", "source-inventory.json", "packaging-overlay.json", "artifact-receipt.json", "package-files.json", "external-evidence.md", "external-evidence-integration.md", "RECONSTRUCT.md"];
  await write(state.artifacts, "SHA256SUMS", (await Promise.all(checksums.map(async name => hash(await fs.readFile(path.join(state.artifacts, name))) + "  " + name))).join("\n") + "\n");
  return final;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, sourceOrState, artifacts] = process.argv.slice(2);
  if (mode === "prepare") {
    const state = await buildAndPack(await prepareCandidate(sourceOrState, artifacts));
    console.log(JSON.stringify({ state: path.join(state.artifacts, "candidate-stage.json"), sdkDirectory: state.extracted, archive: state.archive, provisional: true }));
  } else if (mode === "finalize") {
    const state = await finalizeCandidate(JSON.parse(await fs.readFile(sourceOrState, "utf8")));
    console.log(JSON.stringify({ sdkDirectory: state.extracted, archive: state.archive, archiveSha256: state.archiveSha256, final: true }));
  } else if (mode === "check-source") {
    const capture = await sourcePatch(sourceOrState);
    console.log(JSON.stringify(await verifyReconstruction(sourceOrState, capture.patch)));
  } else throw new Error("Use prepare <source-root> <artifact-directory>, finalize <candidate-stage.json>, or check-source <source-root>");
}
