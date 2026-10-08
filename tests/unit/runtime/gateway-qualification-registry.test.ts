import { describe, expect, it } from "@jest/globals";
import { DEFAULT_GATEWAY_POLICY_MANIFEST } from "../../../convex-dev/runtimeGatewayQualifications";
import type { DeploymentPolicyManifest } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import { isTrustedDeploymentManifest, lookupDeploymentManifest, qualifiedTerminalModelId } from "../../../convex-dev/runtimeModelPolicyBootstrap";

describe("compiled actual Gateway qualification candidate", () => {
  it("trusts only the exact registered object/version, never an equivalent caller object or classification", () => {
    const manifest: DeploymentPolicyManifest = DEFAULT_GATEWAY_POLICY_MANIFEST;
    expect(lookupDeploymentManifest(manifest.manifestId, manifest.revision)).toBe(manifest);
    expect(isTrustedDeploymentManifest(manifest)).toBe(true);
    expect(isTrustedDeploymentManifest({ ...manifest })).toBe(false);
    expect(isTrustedDeploymentManifest({ ...manifest, classification: "fixture-synthetic" })).toBe(false);
    expect(lookupDeploymentManifest(manifest.manifestId, manifest.revision + 1)).toBeUndefined();
    expect(lookupDeploymentManifest("caller-provided-policy", manifest.revision)).toBeUndefined();
  });
  it("uses only the observed plain interfaces and retains full unknown-cost ceilings without fallback or provider extras", () => {
    const manifest: DeploymentPolicyManifest = DEFAULT_GATEWAY_POLICY_MANIFEST;
    expect(manifest.qualifications.map(q => q.modelId)).toEqual(["openai/gpt-4o-mini", "openai/gpt-4o", "openai/text-embedding-3-small"]);
    for (const qualification of manifest.qualifications) {
      expect(qualification.costBound).toMatchObject({ maximumCostUnits: 100000, coversAllProviderCharges: true });
      expect(qualification.limits).toMatchObject({ inputTokens: 8192, outputTokens: 512, toolSteps: 0, concurrency: 2 });
      expect(qualification.allowedOptions).toEqual([]);
    }
    for (const proof of manifest.dispatchEvidence) expect(proof.terminalCost).toBe("unavailable");
    expect(manifest.policies[0].rules.allowedTools).toEqual([]);
    expect(manifest.policies[0].rules.allowedOptions).toEqual([]);
    expect(manifest.policies[0].rules.fallbackModels).toEqual([]);
  });
  it("keeps the one observed embedding wire identity exact and preserves distinct title/schema policies", () => {
    const manifest: DeploymentPolicyManifest = DEFAULT_GATEWAY_POLICY_MANIFEST;
    expect(manifest.policies.find(p => "operationKey" in p && p.operationKey === "conversation.title")?.rules.modelId).toBe("openai/gpt-4o");
    expect(manifest.policies.find(p => "operationKey" in p && p.operationKey === "facts.resolve")?.rules.pins?.schemaVersion).toBe("conflicts-v1");
    const embedding = manifest.dispatchEvidence.find(p => p.nativeInterface === "embedding")!;
    expect(qualifiedTerminalModelId(embedding)).toBe("text-embedding-3-small");
    expect(qualifiedTerminalModelId({ ...embedding, terminalModelId: "foreign/text-embedding-3-small" })).toBeUndefined();
    expect(qualifiedTerminalModelId({ ...manifest.dispatchEvidence[0], terminalModelId: "gpt-4o-mini" })).toBeUndefined();
  });
});
