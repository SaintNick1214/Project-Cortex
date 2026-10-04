/** Deployment artifact is the trust root. No tenant/JWT/env payload can create these attestations. */
import type { TrustedModelPolicyRecord, TrustedModelQualification } from "../src/domain/model-policy";

export interface QualifiedDispatchEvidence {
  readonly receiptId: string;
  readonly evidenceHash: string;
  readonly providerVersion: string;
  readonly nativeInterface: TrustedModelQualification["nativeInterface"];
  readonly modelId: string;
  /** Reviewed guarantee over full serialized final request plus protocol overhead. Absent proof denies. */
  readonly inputBound: { readonly ruleId: "plain-chat-cookbook-utf8-v1" | "default-embedding-utf8-v1"; readonly revision: number;
    readonly featureEnvelope: "plain-chat-v1" | "default-embedding-v1"; readonly nativeTransformHash: string; readonly documentHash: string; readonly proofHash: string };
  readonly resultBound: { readonly maximumPrivateResultBytes: number; readonly maximumOutputTokens: number; readonly maximumEmbeddingValues: 1; readonly proofHash: string };
  readonly checkedAt: number;
  readonly expiresAt: number;
  /** This rule requires actual evidence that this Gateway aggregate is complete and denominated in USD. */
  readonly terminalCost: "gateway-aggregate-usd-v1" | "unavailable";
  readonly terminalProof: "provider-terminal-v1";
  readonly priceRevision: string;
  readonly boundRevision: string;
}
export interface DeploymentPolicyManifest {
  readonly manifestId: string;
  readonly revision: number;
  readonly artifactRevision: string;
  readonly evidenceHash: string;
  readonly acceptanceHash: string;
  readonly classification: "reviewed-actual" | "fixture-synthetic";
  readonly budgetWindowMs: number;
  readonly policies: readonly TrustedModelPolicyRecord[];
  readonly qualifications: readonly TrustedModelQualification[];
  readonly dispatchEvidence: readonly QualifiedDispatchEvidence[];
}
/** Empty until independently reviewed ACTUAL cost/token/interface evidence is installed. */
const manifests: readonly DeploymentPolicyManifest[] = Object.freeze([]);
export function lookupDeploymentManifest(manifestId: string, revision: number): DeploymentPolicyManifest | undefined {
  const selected = manifests.filter((entry) => entry.manifestId === manifestId && entry.revision === revision);
  return selected.length === 1 ? selected[0] : undefined;
}

/** Trust comes from this installed registry, never a string/boolean supplied by application callers. */
export function isTrustedDeploymentManifest(manifest: DeploymentPolicyManifest): boolean {
  return manifest.classification === "reviewed-actual" && manifests.some((entry) => entry === manifest);
}
