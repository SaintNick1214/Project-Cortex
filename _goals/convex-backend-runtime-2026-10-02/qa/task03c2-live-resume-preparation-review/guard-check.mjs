import assert from "node:assert/strict";
import { chmodSync, linkSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { canonical, livePreflight, localPreflight, root, scratch, validateTarget, writeEvidence } from "./guard-adapter.mjs";
localPreflight();
const startedAt = new Date().toISOString();
const request = JSON.parse(readFileSync(resolve(root, "project-request.json"), "utf8"));
const target = { ...request, projectId: 1, deploymentName: "offline-fixture-123", deploymentUrl: "https://offline-fixture-123.convex.cloud",
  active: true, retired: false, deleted: false, isolationVerified: true, createdAt: startedAt,
  privateEnvironmentFile: "work/backend-runtime/task03c2-live-fixture/deploy.env" };
const values = { CONVEX_DEPLOY_KEY: "dev:offline-fixture-123|OFFLINE_STANDIN_NOT_A_CREDENTIAL", CONVEX_DEPLOYMENT: "dev:offline-fixture-123", CONVEX_URL: target.deploymentUrl };
const counts = { network: 0, subprocess: 0, output: 0 };
const results = [];
const afterGuard = (fn) => { fn(); counts.network++; counts.subprocess++; counts.output++; };
function rejects(name, fn) { assert.throws(() => afterGuard(fn)); assert.deepEqual(counts, { network: 0, subprocess: 0, output: 0 }); results.push({ name, rejected: true, effects: 0 }); }
assert.equal(validateTarget(target, request, values), target);
for (const [name, patch] of [
  ["product-purpose", { purpose: "product" }], ["retired", { retired: true }], ["inactive", { active: false }], ["deleted", { deleted: true }],
  ["production-kind", { deploymentType: "prod" }], ["production-flag", { productionDeployment: true }], ["shared-ci", { sharedCiTarget: true }],
  ["wrong-name", { projectName: "Unrelated project" }], ["wrong-slug", { projectSlug: "unrelated-project" }], ["wrong-project-id", { projectId: 0 }],
  ["wrong-origin", { deploymentUrl: "https://unrelated.invalid" }], ["name-url-mismatch", { deploymentName: "wrong-fixture-123" }],
  ["old-task01", { deploymentName: "efficient-ox-979", deploymentUrl: "https://efficient-ox-979.convex.cloud" }],
  ["old-security", { deploymentName: "fiery-setter-784", deploymentUrl: "https://fiery-setter-784.convex.cloud" }],
  ["wrong-private-env", { privateEnvironmentFile: "work/unrelated.env" }], ["not-verified", { isolationVerified: false }],
]) rejects(name, () => validateTarget({ ...target, ...patch }, request, values));
for (const [name, patch] of [
  ["prod-key", { CONVEX_DEPLOY_KEY: "prod:offline-fixture-123|STANDIN" }], ["wrong-key", { CONVEX_DEPLOY_KEY: "dev:wrong-fixture-123|STANDIN" }],
  ["empty-key", { CONVEX_DEPLOY_KEY: "dev:offline-fixture-123|" }], ["wrong-selector", { CONVEX_DEPLOYMENT: "prod:offline-fixture-123" }],
  ["wrong-url", { CONVEX_URL: "https://unrelated.invalid" }], ["override-access", { CONVEX_OVERRIDE_ACCESS_TOKEN: "STANDIN" }],
  ["model-key", { OPENAI_API_KEY: "STANDIN" }], ["self-hosted", { CONVEX_SELF_HOSTED_URL: "http://localhost:3210" }],
]) rejects(name, () => validateTarget(target, request, { ...values, ...patch }));
rejects("inherited-wrong-selector", () => validateTarget(target, request, values, { CONVEX_DEPLOYMENT: "prod:offline-fixture-123" }));
rejects("inherited-wrong-key", () => validateTarget(target, request, values, { CONVEX_DEPLOY_KEY: "dev:wrong-fixture-123|STANDIN" }));
rejects("inherited-self-hosted", () => validateTarget(target, request, values, { CONVEX_SELF_HOSTED_URL: "http://localhost:3210" }));
rejects("missing-parent-target", () => livePreflight());

const sandbox = resolve(scratch, `guard-cases-${randomUUID()}`);
mkdirSync(sandbox, { mode: 0o700 });
const privatePath = resolve(sandbox, "private.txt"); writeFileSync(privatePath, "offline path standin\n", { mode: 0o600, flag: "wx" });
try {
  canonical(privatePath, scratch, { privateFile: true, existing: true });
  const alias = resolve(sandbox, "directory-alias"); symlinkSync(resolve(root, "../task01/evidence"), alias);
  rejects("directory-symlink-absent-child", () => canonical(resolve(alias, "absent.json"), scratch));
  const fileAlias = resolve(sandbox, "file-alias.txt"); symlinkSync(privatePath, fileAlias);
  rejects("private-symlink", () => canonical(fileAlias, scratch, { privateFile: true, existing: true }));
  const hardlink = resolve(sandbox, "private-hardlink.txt"); linkSync(privatePath, hardlink);
  rejects("private-hardlink", () => canonical(hardlink, scratch, { privateFile: true, existing: true }));
  rejects("private-linked-original", () => canonical(privatePath, scratch, { privateFile: true, existing: true }));
  rmSync(hardlink); chmodSync(privatePath, 0o644);
  rejects("private-wrong-mode", () => canonical(privatePath, scratch, { privateFile: true, existing: true }));
  rejects("private-outside-root", () => canonical(resolve(root, "project-request.json"), scratch, { privateFile: true, existing: true }));
  for (const kind of ["symlink", "hardlink"]) {
    const basename = `alias-${randomUUID()}.json`; const path = resolve(scratch, "evidence", basename);
    if (kind === "symlink") symlinkSync(privatePath, path); else linkSync(privatePath, path);
    try { rejects(`output-${kind}`, () => localPreflight(basename)); } finally { rmSync(path); }
  }
  const priorName = `prior-${randomUUID()}.json`, priorPath = localPreflight(priorName);
  writeFileSync(priorPath, "{}\n", { flag: "wx", mode: 0o600 });
  try { rejects("output-prior-evidence-overwrite", () => localPreflight(priorName)); } finally { rmSync(priorPath); }
} finally { rmSync(sandbox, { recursive: true }); }
writeEvidence(`guards-${randomUUID()}.json`, { startedAt, completedAt: new Date().toISOString(), discovered: results.length, passed: results.length, skipped: 0, counts, results }, false);
process.stdout.write(JSON.stringify({ discovered: results.length, passed: results.length, skipped: 0, counts }) + "\n");
