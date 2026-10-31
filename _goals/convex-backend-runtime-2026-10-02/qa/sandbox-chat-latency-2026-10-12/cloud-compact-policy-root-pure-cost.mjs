import fs from "node:fs";
import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import { canonicalModelJson } from "../../../../src/domain/model-policy.ts";
import { semanticHash } from "../../../../src/domain/profile.ts";
import { DEFAULT_GATEWAY_POLICY_MANIFEST } from "../../../../convex-dev/runtimeGatewayQualifications.ts";
import { fullRootProvenanceFor, compactRootProvenance, rootProvenanceEncodings, rootProvenanceEqual, rootProvenanceMatches } from "../../../../convex-dev/runtimePolicySchema.ts";
const manifest = DEFAULT_GATEWAY_POLICY_MANIFEST, encoded = canonicalModelJson(manifest), expected = fullRootProvenanceFor(manifest, encoded, await semanticHash(encoded));
const compact = compactRootProvenance(expected), encodings = rootProvenanceEncodings(expected, canonicalModelJson), rows = manifest.policies.filter(p => p.scope === "deployment").length + manifest.qualifications.length;
const cases = {
  originalFull: async () => {
    const body = canonicalModelJson(manifest), full = fullRootProvenanceFor(manifest, body, await semanticHash(body));
    if (canonicalModelJson(expected) !== canonicalModelJson(full)) throw new Error("Unexpected full root");
    for (let i = 0; i < rows; i++) if (canonicalModelJson(expected) !== canonicalModelJson(expected)) throw new Error("Unexpected full comparison");
  },
  invocationLocalCompact: async () => {
    const body = canonicalModelJson(manifest), full = fullRootProvenanceFor(manifest, body, await semanticHash(body)), local = rootProvenanceEncodings(full, canonicalModelJson);
    if (!rootProvenanceMatches(canonicalModelJson(compact), local)) throw new Error("Unexpected compact root");
    for (let i = 0; i < rows; i++) if (!rootProvenanceEqual(canonicalModelJson(compact), canonicalModelJson(compact), local)) throw new Error("Unexpected compact comparison");
  },
  rejectedPerRowReconstruction: async () => {
    for (let i = 0; i < rows; i++) {
      const body = canonicalModelJson(manifest), full = fullRootProvenanceFor(manifest, body, await semanticHash(body)), local = rootProvenanceEncodings(full, canonicalModelJson);
      if (!rootProvenanceMatches(canonicalModelJson(compact), local)) throw new Error("Unexpected repeated reconstruction");
    }
  },
};
const summaries = {};
for (const [name, run] of Object.entries(cases)) {
  for (let i = 0; i < 2; i++) await run(); const values = [];
  for (let i = 0; i < 20; i++) { const start = performance.now(); await run(); values.push(performance.now() - start); }
  const sorted = [...values].sort((a,b)=>a-b); summaries[name] = { samples: values, medianMs: (sorted[9]+sorted[10])/2, maximumMs: sorted.at(-1) };
}
const hash = b => crypto.createHash("sha256").update(b).digest("hex"), sourceFiles = ["runtimePolicySchema.ts", "runtimeModelPolicy.ts", "agentDefinitions.ts", "runtimeMemoryRepository.ts"];
const out = { kind: "local pure serialization/hash/codec overhead only; no Convex/network/provider/SLO result", node: process.version,
  manifestId: manifest.manifestId, revision: manifest.revision, compiledManifestBytes: Buffer.byteLength(encoded), fullRootBytes: Buffer.byteLength(encodings.full), compactRootBytes: Buffer.byteLength(encodings.compact),
  deploymentPolicies: manifest.policies.filter(p=>p.scope==="deployment").length, qualifications: manifest.qualifications.length, rootsPerControlSet: rows,
  fullRepeatedRootBytes: Buffer.byteLength(encodings.full)*rows, compactRepeatedRootBytes: Buffer.byteLength(encodings.compact)*rows,
  originalRequiredCanonicalManifestHash: expected.hash, manifestBytesSha256: hash(encoded),
  counts: { actualActiveRootManifestHashes: 1, actualFreshOrIdempotentInstallManifestHashes: 1, actualCountsEvidence: "model-policy-admission.test.ts real registered25qualification-row handler digest spy", rejectedPrototypePerRowHashes: rows },
  summaries, sources: sourceFiles.map(file=>({ file: "convex-dev/"+file, sha256: hash(fs.readFileSync(new URL("../../../../convex-dev/"+file,import.meta.url))) })) };
fs.writeFileSync(new URL("cloud-compact-policy-root-pure-cost.json", import.meta.url), JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({ fullRootBytes: out.fullRootBytes, compactRootBytes: out.compactRootBytes, roots: rows, times: Object.fromEntries(Object.entries(summaries).map(([name,s])=>[name,{medianMs:s.medianMs,maximumMs:s.maximumMs}])) }));
