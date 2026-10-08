import { describe, expect, it } from "@jest/globals";
import { DEFAULT_GATEWAY_POLICY_MANIFEST, TEXT_GATEWAY_POLICY_MANIFEST_V3 } from "../../../convex-dev/runtimeGatewayQualifications";
import type { DeploymentPolicyManifest } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import { isTrustedDeploymentManifest, lookupDeploymentManifest, qualifiedTerminalModelId } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import { AGENT_NATIVE_TOOLS, AGENT_TOOL_REGISTRY_VERSION } from "../../../src/domain/agent-tools";
import { resolveModelPolicy } from "../../../src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { memoryFixture } from "../runtimeMemory/fixture";

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
  it("preserves the three earlier qualifications and retains full unknown-cost ceilings without fallback or provider extras", () => {
    const manifest: DeploymentPolicyManifest = DEFAULT_GATEWAY_POLICY_MANIFEST;
    expect(manifest.qualifications.slice(0, 3)).toEqual(TEXT_GATEWAY_POLICY_MANIFEST_V3.qualifications);
    expect(manifest.dispatchEvidence.slice(0, 3)).toEqual(TEXT_GATEWAY_POLICY_MANIFEST_V3.dispatchEvidence);
    expect(lookupDeploymentManifest(TEXT_GATEWAY_POLICY_MANIFEST_V3.manifestId, TEXT_GATEWAY_POLICY_MANIFEST_V3.revision)).toBe(TEXT_GATEWAY_POLICY_MANIFEST_V3);
    expect(isTrustedDeploymentManifest(TEXT_GATEWAY_POLICY_MANIFEST_V3)).toBe(true);
    expect(isTrustedDeploymentManifest({ ...TEXT_GATEWAY_POLICY_MANIFEST_V3 })).toBe(false);
    for (const qualification of manifest.qualifications) {
      expect(qualification.costBound).toMatchObject({ maximumCostUnits: 100000, coversAllProviderCharges: true });
      expect(qualification.limits).toMatchObject({ outputTokens: 512, concurrency: 2 });
      expect(qualification.allowedOptions).toEqual([]);
    }
    for (const proof of manifest.dispatchEvidence) expect(proof.terminalCost).toBe("unavailable");
    expect(manifest.policies[0].rules.allowedTools).toEqual(AGENT_NATIVE_TOOLS.map(tool => tool.name));
    expect(manifest.policies[0].rules.allowedOptions).toEqual([]);
    expect(manifest.policies[0].rules.fallbackModels).toEqual([]);
  });
  it("resolves Agent tools separately from plain memory and matching-profile embedding calls", () => {
    const manifest: DeploymentPolicyManifest = DEFAULT_GATEWAY_POLICY_MANIFEST;
    const resolve = (operationKey: "agent.respond" | "memory.extract" | "embedding.query") => resolveModelPolicy({
      context: { scope: memoryFixture().reference, operationKey, runBudgetId: "registry-scope", authorizedOverrides: [],
        ...(operationKey === "embedding.query" ? { semanticProfile: DEFAULT_EMBEDDING_PROFILE } : {}) },
      policies: manifest.policies.filter(policy => !("operationKey" in policy) || policy.operationKey === operationKey),
      qualifications: manifest.qualifications,
    });
    const agent = resolve("agent.respond");
    expect(agent.pins.toolRegistryVersion).toBe(AGENT_TOOL_REGISTRY_VERSION);
    expect(agent.limits).toMatchObject({ inputTokens: 32768, toolSteps: 4 });
    expect(agent.capabilities).toContain("tools");
    const proof = manifest.dispatchEvidence.find(entry => entry.receiptId === agent.qualificationReceiptId)!;
    expect(proof.supportsStream).toBe(true);
    expect(JSON.parse(proof.toolContract!.toolsCanonical)).toEqual(AGENT_NATIVE_TOOLS);
    expect(resolve("memory.extract").limits).toMatchObject({ inputTokens: 8192, toolSteps: 0 });
    expect(resolve("memory.extract").capabilities).not.toContain("tools");
    expect(resolve("embedding.query").semanticProfile).toEqual(DEFAULT_EMBEDDING_PROFILE);
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
