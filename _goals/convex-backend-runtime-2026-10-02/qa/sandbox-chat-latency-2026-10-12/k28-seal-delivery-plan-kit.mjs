import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const proofs = '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs';
const qa = path.dirname(fileURLToPath(import.meta.url));
const base = path.join(proofs, 'sandbox-env');
const kit = path.join(proofs, 'manual-sandbox-delivery-plan-2026-10-14');
const sourceCommit = process.argv[2];
assert.equal(sourceCommit, 'a773bd545c22e3c6eeb228b800d4c3a679375c5b');
assert.equal(process.version, 'v24.15.0');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = await fs.readFile(path.join(kit, 'image/archives/manifest.json'));
const manifest = JSON.parse(manifestBytes);
const identity = JSON.parse(await fs.readFile(path.join(qa, 'kit-checks-delivery-plan/docker-image-identity.json')));
const packaging = JSON.parse(await fs.readFile(path.join(qa, 'kit-checks-delivery-plan/packaging-final-receipt.json')));
assert.equal(manifest.sourceCommit, sourceCommit);
assert.equal(manifest.backend.files, 170);
assert.equal(manifest.backend.allSourceOutputHashesMatch, true);
assert.equal(manifest.packages.find(p => p.role === 'catalog').version, '1.3.3');
assert.equal(identity.os, 'linux'); assert.equal(identity.architecture, 'arm64'); assert.equal(identity.user, 'sandbox');
assert.equal(identity.labels['dev.cortex.manual-sandbox.source'], sourceCommit);
assert.equal(identity.labels['dev.cortex.manual-sandbox.path'], kit);
assert.equal(identity.labels['dev.cortex.manual-sandbox'], identity.kitIdentity.id);
assert.equal(packaging.status, 'PACKAGING_COMPLETE');
assert.equal(packaging.sourceCommit, sourceCommit); assert.equal(packaging.kit, kit);
assert.equal(packaging.counts.isolatedBuilds, 3); assert.equal(packaging.counts.packs, 4); assert.equal(packaging.counts.imageBuilds, 1);
assert.equal(packaging.consumers.length, 4); assert(packaging.consumers.every(result => result.exitCode === 0));
const actual = JSON.parse((await promisify(execFile)('/Applications/Docker.app/Contents/Resources/bin/docker', ['image', 'inspect', identity.imageId], { maxBuffer: 100000 })).stdout)[0];
assert.equal(actual.Id, identity.imageId); assert.equal(actual.Os, 'linux'); assert.equal(actual.Architecture, 'arm64'); assert.equal(actual.Config.User, 'sandbox');
for (const [key, value] of Object.entries(identity.labels)) assert.equal(actual.Config.Labels[key], value);
const reviewPath = path.join(qa, 'k28-independent-review.md'), review = await fs.readFile(reviewPath);
const verdict = JSON.parse(await fs.readFile(path.join(qa, 'k28-independent-review.json')));
assert.equal(verdict.verdict, 'PASS'); assert.equal(verdict.sourceOnly, true); assert.equal(verdict.fullGoalAcceptance, false);
assert.deepEqual(verdict.breakingFindings, []);
assert.equal(verdict.verifiedInputs.packetSha256, sha(await fs.readFile(path.join(qa, verdict.verifiedInputs.packet))));
assert.equal((await fs.readFile(path.join(kit, 'image-id.txt'), 'utf8')).trim(), identity.imageId);
assert.equal((await fs.stat(path.join(kit, 'image-id.txt'))).mode & 0o777, 0o600);
const approvalPath = path.join(base, 'procedure-approval.json');
const originalApproval = await fs.readFile(approvalPath), approval = JSON.parse(originalApproval);
assert.equal(approval.maximumPaidRequests, 8); assert.equal(approval.maximumUnknownLiabilityUnits, 2700000); assert.equal(approval.perRunHumanReview, false);
let docker = await fs.readFile(path.join(base, 'docker.mjs'), 'utf8');
let runner = await fs.readFile(path.join(base, 'runner.mjs'), 'utf8');
let tests = await fs.readFile(path.join(base, 'local.test.mjs'), 'utf8');
const originals = { 'procedure-approval-before-delivery-plan.json': originalApproval, 'docker-before-delivery-plan.mjs': docker,
  'runner-before-delivery-plan.mjs': runner, 'local-test-before-delivery-plan.mjs': tests };
const oldImage = /export const IMAGE_ID = '([^']+)'/.exec(docker)[1];
assert.equal(oldImage, 'sha256:7b2568d008df68301e7dd81692f532092c725cd549f656fc566f91254e73a83c');
assert(!docker.includes('PRIOR_PROMPT_TRUST_IMAGE_ID'));
function once(text, old, value) { assert.equal(text.split(old).length, 2, 'Expected one original anchor: ' + old); return text.replace(old, value); }
for (const [name, value] of Object.entries({ IMAGE_ID: identity.imageId, SOURCE_COMMIT: sourceCommit, BACKEND_MANIFEST_SHA256: manifest.backend.manifestSha256 })) {
  const pattern = new RegExp("export const " + name + " = '[^']+'"); assert(pattern.test(docker));
  docker = docker.replace(pattern, "export const " + name + " = '" + value + "'");
}
docker = once(docker, 'export const LABEL =', "export const PRIOR_PROMPT_TRUST_IMAGE_ID = '" + oldImage + "';\nexport const LABEL =");
docker = once(docker, 'PRIOR_MANAGED_SOURCE_IMAGE_ID].includes(imageId)', 'PRIOR_MANAGED_SOURCE_IMAGE_ID, PRIOR_PROMPT_TRUST_IMAGE_ID].includes(imageId)');
for (const entry of manifest.packages) {
  assert.equal(sha(await fs.readFile(path.join(kit, 'image/archives', entry.filename))), entry.sha256);
  const pattern = new RegExp("(" + entry.role + ": \\{[^\\n]+sha256: ')[^']+"); assert(pattern.test(docker));
  docker = docker.replace(pattern, (_, prefix) => prefix + entry.sha256);
}
runner = once(runner, "const KIT_NAME = 'manual-sandbox-prompt-trust-2026-10-14';", "const KIT_NAME = 'manual-sandbox-delivery-plan-2026-10-14';");
tests = once(tests, 'PRIOR_MANAGED_SOURCE_IMAGE_ID, SOURCE_COMMIT', 'PRIOR_MANAGED_SOURCE_IMAGE_ID, PRIOR_PROMPT_TRUST_IMAGE_ID, SOURCE_COMMIT');
tests = once(tests, 'PRIOR_MANAGED_SOURCE_IMAGE_ID])', 'PRIOR_MANAGED_SOURCE_IMAGE_ID, PRIOR_PROMPT_TRUST_IMAGE_ID])');
tests = once(tests, 'manual-sandbox-prompt-trust-2026-10-14', 'manual-sandbox-delivery-plan-2026-10-14');
// Validate all applicability anchors before the first launcher mutation.
for (const [name, bytes] of Object.entries(originals)) await fs.writeFile(path.join(qa, name), bytes, { flag: 'wx' });
await fs.writeFile(path.join(base, 'docker.mjs'), docker);
await fs.writeFile(path.join(base, 'runner.mjs'), runner);
await fs.writeFile(path.join(base, 'local.test.mjs'), tests);
approval.procedureHistory.push({ approvalSha256: sha(originalApproval), reviewSha256: approval.reviewSha256, sourceCommit: approval.candidateSourceCommit, methods: 8, unknownLiabilityUnits: 2700000 });
approval.reviewPath = reviewPath; approval.reviewSha256 = sha(review); approval.candidateSourceCommit = sourceCommit;
for (const row of approval.files) row.sha256 = sha(await fs.readFile(path.resolve(base, row.path)));
approval.sourceAcceptance = { kind: 'NORMAL_REVIEWED_SOURCE_PIN_INTEGRATION', sourceCommit, kit, imageId: identity.imageId,
  artifactReceiptSha256: sha(manifestBytes), reviewHashes: { ...(approval.sourceAcceptance?.reviewHashes ?? {}), 'k28-independent-review.md': sha(review) } };
approval.priorManualObservations.push({ sessionId: 'acd3400a-4d6a-4589-bbaa-9c7fac860369', environment: 'CLEANED', cleanupReceipt: path.join(qa, 'k27-cleanup-final.json'),
  subsecondOutcomes: '0PASS/4FAIL', semanticMarkers: '4PASS/0FAIL', browserMs: [4381.899999976158, 3199.3000000715256], cliMs: [8836.408003999999, 9348.042045999995],
  wholeMemory: 'PASS5factsAcross4positiveInputs/8matchingVectors/contiguous8', scopedFunctional: 'capture/replay/recall/isolation/toolreconnect/quietauth/strict11PASS; original approvalwaitFAIL preserved',
  actualCharges: 'UNKNOWN', launcherChildExit: 130, originalFailuresPreserved: true });
await fs.writeFile(approvalPath, JSON.stringify(approval, null, 2) + '\n');
const { verifyProcedure } = await import(path.join(base, 'qualification.mjs'));
const procedure = await verifyProcedure();
const { verifyArtifacts } = await import(path.join(base, 'docker.mjs'));
const artifacts = await verifyArtifacts(kit);
const receipt = { observedAt: new Date().toISOString(), scope: 'NORMAL_REVIEWED_SOURCE_AND_ARTIFACT_PIN_INTEGRATION', digest: procedure.digest, artifacts, image: identity,
  maximumPaidRequests: 8, maximumUnknownLiabilityUnits: 2700000, priorApprovalSha256: sha(originalApproval), oldImageExactCleanupRetained: oldImage,
  sourceSelection: 'K28 watch-only opaque revision acknowledgement and guarded public recall native parents; original authority/accounting/4-4-4-4-16/canonical rows retained',
  serviceCalls: 0, paidCalls: 0, nativeQualified: false };
await fs.writeFile(path.join(qa, 'procedure-delivery-plan-resealed.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ digest: procedure.digest, image: identity.imageId, sourceCommit, maximumPaidRequests: 8 }));
