/** Offline inspection only; no native dispatch or installed-root claim. */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { OBSERVED_GATEWAY_POLICY_MANIFEST_V14, OBSERVED_GATEWAY_POLICY_MANIFEST_V16 } from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeGatewayMediaQualifications";
import { resolveModelPolicy } from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/model-policy";
import type { ModelOperationKey } from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/model-policy";
const q = dirname(fileURLToPath(import.meta.url)), now = Date.now();
const scope = { tenantId: "OFFLINE_NOT_AUTHORITY", tenantEpoch: 1, memorySpaceId: "OFFLINE_NOT_AUTHORITY", memorySpaceEpoch: 1,
  principalId: "OFFLINE_NOT_AUTHORITY", principalVersion: 1, membershipId: "OFFLINE_NOT_AUTHORITY", membershipVersion: 1,
  grantId: "OFFLINE_NOT_AUTHORITY", grantVersion: 1 };
const manifests = [OBSERVED_GATEWAY_POLICY_MANIFEST_V14, OBSERVED_GATEWAY_POLICY_MANIFEST_V16];
const result = manifests.map(manifest => ({ manifestId: manifest.manifestId, revision: manifest.revision,
  applicability: manifest.revision === 14 ? "Last observed installed main-target baseline; current server metadata unconfirmed" : "Current source candidate used on the separate CI dev targets, not claimed installed on main",
  selections: (["media.image.generate", "media.video.generate", "agent.respond", "memory.extract", "facts.resolve", "conversation.title", "embedding.memory", "embedding.query"] as ModelOperationKey[]).map(operationKey => {
    try {
      const snapshot = resolveModelPolicy({ context: { scope, operationKey, runBudgetId: "OFFLINE_NO_BUDGET", authorizedOverrides: [] },
        policies: manifest.policies.filter(p => !p.operationKey || p.operationKey === operationKey), qualifications: manifest.qualifications });
      const proof = manifest.dispatchEvidence.find(p => p.receiptId === snapshot.qualificationReceiptId)!;
      return { operationKey, status: "COMPILED_SELECTION_ONLY", modelId: snapshot.modelId, nativeInterface: snapshot.nativeInterface,
        qualificationReceiptId: snapshot.qualificationReceiptId, pins: snapshot.pins, checkedAt: proof.checkedAt, expiresAt: proof.expiresAt,
        expiresAtUtc: new Date(proof.expiresAt).toISOString(), currentAtInspection: proof.checkedAt <= now && now < proof.expiresAt,
        costCeilingMicroUsd: snapshot.costBound.maximumCostUnits, terminalCost: proof.terminalCost,
        ...(proof.mediaContract ? { mediaContract: proof.mediaContract } : {}) };
    } catch (error) {
      return { operationKey, status: "COMPILED_CAPABILITY_UNAVAILABLE", staticCode: error instanceof Error && error.message.includes("CAPABILITY_UNAVAILABLE") ? "CAPABILITY_UNAVAILABLE" : "OTHER_STATIC_DENIAL" };
    }
  }) }));
await writeFile(join(q, "compiled-selectors1.json"), JSON.stringify({ status: "OFFLINE_CURRENTNESS_METADATA_ONLY", observedAt: new Date(now).toISOString(), manifests: result,
  effects: { model: 0, reserve: 0, budgetAccount: 0, auth: 0, service: 0, proofDateChange: 0 }, currentInstalledRootNotClaimed: true }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "OFFLINE_CURRENTNESS_METADATA_ONLY", revisions: result.map(x => x.revision), nativeVideoAvailability: "Not established; no video qualification in either compiled manifest", effects: 0 }));
