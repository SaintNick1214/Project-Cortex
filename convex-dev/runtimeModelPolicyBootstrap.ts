/** Deployment artifact is the trust root. No tenant/JWT/env payload can create these attestations. */
import type { TrustedModelPolicyRecord, TrustedModelQualification } from "../src/domain/model-policy";
import type { EmbeddingProfile } from "../src/domain/profile";
import type { QualifiedMediaContractV1 } from "../src/domain/media-jobs";
import { AGENT_GATEWAY_POLICY_MANIFEST_V5, DEFAULT_GATEWAY_POLICY_MANIFEST, TEXT_GATEWAY_POLICY_MANIFEST_V3 } from "./runtimeGatewayQualifications";
import { OBSERVED_GATEWAY_POLICY_MANIFEST_V14, OBSERVED_GATEWAY_POLICY_MANIFEST_V15 } from "./runtimeGatewayMediaQualifications";

export interface QualifiedDispatchEvidence {
  readonly receiptId: string;
  readonly evidenceHash: string;
  readonly providerVersion: string;
  readonly nativeInterface: TrustedModelQualification["nativeInterface"];
  readonly modelId: string;
  /** Exact observed terminal wire identity, independently qualified by the installed
   * artifact. Omission retains the canonical modelId fence. No general aliases. */
  readonly terminalModelId?: string;
  /** Reviewed guarantee over full serialized final request plus protocol overhead. Absent proof denies. */
  readonly inputBound: { readonly ruleId: "plain-chat-cookbook-utf8-v1" | "default-embedding-utf8-v1" | "profile-embedding-utf8-v1" | "agent-tools-chat-utf8-v1" | "private-frame-video-json-v1" | "media-native-utf8-v1"; readonly revision: number;
    readonly featureEnvelope: "plain-chat-v1" | "default-embedding-v1" | "profile-embedding-v1" | "agent-tools-chat-v1" | "agent-tools-chat-v2" | "private-frame-video-v1" | "media-image-v1" | "media-video-async-v1"; readonly nativeTransformHash: string; readonly documentHash: string; readonly proofHash: string };
  readonly mediaContract?: QualifiedMediaContractV1;
  readonly embeddingProfile?: EmbeddingProfile;
  readonly supportsStream?: true;
  readonly toolContract?: { readonly registryVersion: string; readonly toolsCanonical: string; readonly maximumToolCalls: number };
  readonly resultBound: { readonly maximumPrivateResultBytes: number; readonly maximumOutputTokens: number; readonly maximumEmbeddingValues: 1; readonly proofHash: string };
  readonly checkedAt: number;
  readonly expiresAt: number;
  /** This rule requires actual evidence that this Gateway aggregate is complete and denominated in USD. */
  readonly terminalCost: "gateway-aggregate-usd-v1" | "unavailable";
  readonly terminalProof: "provider-terminal-v1";
  readonly priceRevision: string;
  readonly boundRevision: string;
}
export function qualifiedTerminalModelId(proof: QualifiedDispatchEvidence): string | undefined {
  if (proof.terminalModelId === undefined) return proof.modelId;
  // Gateway embeddings currently retain OpenAI's unprefixed terminal name.
  // This is allowed only when that exact mapping is attested by the trust root.
  if (proof.nativeInterface === "embedding" && proof.modelId === "openai/text-embedding-3-small"
    && proof.terminalModelId === "text-embedding-3-small") return proof.terminalModelId;
  if (proof.nativeInterface === "embedding" && proof.inputBound.featureEnvelope === "profile-embedding-v1"
    && proof.modelId === "openai/text-embedding-3-large" && proof.embeddingProfile?.modelId === proof.modelId
    && proof.terminalModelId === "text-embedding-3-large") return proof.terminalModelId;
  return undefined;
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
/** Compiled actual-service candidate; its evidence binding is reviewed with the
 * complete product batch before acceptance. No caller/environment registration. */
const manifests: readonly DeploymentPolicyManifest[] = Object.freeze([TEXT_GATEWAY_POLICY_MANIFEST_V3, AGENT_GATEWAY_POLICY_MANIFEST_V5, DEFAULT_GATEWAY_POLICY_MANIFEST, OBSERVED_GATEWAY_POLICY_MANIFEST_V14, OBSERVED_GATEWAY_POLICY_MANIFEST_V15]);
export function lookupDeploymentManifest(manifestId: string, revision: number): DeploymentPolicyManifest | undefined {
  const selected = manifests.filter((entry) => entry.manifestId === manifestId && entry.revision === revision);
  return selected.length === 1 ? selected[0] : undefined;
}

/** Trust comes from this installed registry, never a string/boolean supplied by application callers. */
export function isTrustedDeploymentManifest(manifest: DeploymentPolicyManifest): boolean {
  return manifest.classification === "reviewed-actual" && manifests.some((entry) => entry === manifest);
}
