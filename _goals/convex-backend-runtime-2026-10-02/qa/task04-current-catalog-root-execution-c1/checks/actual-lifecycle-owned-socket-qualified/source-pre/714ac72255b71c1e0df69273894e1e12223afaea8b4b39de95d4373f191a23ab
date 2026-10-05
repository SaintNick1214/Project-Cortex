import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { ConvexClient } from "convex/browser";
import {
  GovernanceAPI,
  GovernanceCapabilityError,
  GovernanceValidationError,
} from "../../../src/governance";
import { ResilienceLayer } from "../../../src/resilience";
import type { EnforcementOptions } from "../../../src/types";

function fixture(withResilience: boolean) {
  // A disabled real client allocates no WebSocket and throws if dispatch occurs.
  // The real SDK boundary and validators remain in use.
  const client = new ConvexClient("https://example.convex.cloud", {
    disabled: true,
    logger: false,
  });
  const mutation = jest.spyOn(client, "mutation");
  const query = jest.spyOn(client, "query");
  const action = jest.spyOn(client, "action");
  const resilience = new ResilienceLayer({ enabled: false });
  const execute = jest.spyOn(resilience, "execute");
  const api = new GovernanceAPI(
    client,
    undefined,
    withResilience ? resilience : undefined,
  );
  return { api, client, mutation, query, action, resilience, execute };
}

describe.each([false, true])("manual governance client enforcement (resilience=%s)", (withResilience) => {
  let current: ReturnType<typeof fixture> | undefined;

  afterEach(async () => {
    await current?.client.close();
    await current?.resilience.shutdown();
    jest.restoreAllMocks();
  });

  function assertNotDispatched() {
    expect(current?.mutation).not.toHaveBeenCalled();
    expect(current?.query).not.toHaveBeenCalled();
    expect(current?.action).not.toHaveBeenCalled();
    expect(current?.execute).not.toHaveBeenCalled();
  }

  it.each<EnforcementOptions>([
    { scope: { organizationId: "tenant-a" } },
    {
      scope: { memorySpaceId: "space-a" },
      layers: ["vector", "immutable"],
      rules: ["retention", "purging"],
    },
    {
      scope: { organizationId: "tenant-a", memorySpaceId: "space-a" },
      layers: ["conversations", "mutable"],
      rules: ["retention"],
    },
  ])("rejects valid options with an actionable typed capability outcome (%j)", async (options) => {
    current = fixture(withResilience);
    const error: unknown = await current.api.enforce(options).catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(GovernanceCapabilityError);
    expect(error).not.toBeInstanceOf(GovernanceValidationError);
    expect(error).toMatchObject({
      name: "GovernanceCapabilityError",
      code: "BACKEND_ENFORCEMENT_ONLY",
      retryable: false,
      outcome: "not_dispatched",
      requiredExecution: "trusted_backend_worker",
      enforcementAdapter: "SIMULATION",
    });
    if (!(error instanceof GovernanceCapabilityError)) throw new Error("Expected capability error");
    expect(error.message).toContain("requires a trusted backend worker");
    expect(error.message).toContain("simulation only");
    expect(error.message).toContain("automatic retention deletion is not implemented");
    assertNotDispatched();
  });

  it.each([
    { options: undefined, code: "MISSING_OPTIONS" },
    { options: null, code: "MISSING_OPTIONS" },
    { options: {}, code: "MISSING_SCOPE" },
    { options: { scope: {} }, code: "INVALID_SCOPE" },
    { options: { scope: { organizationId: " " } }, code: "INVALID_SCOPE" },
    { options: { scope: { memorySpaceId: "space-a" }, layers: [] }, code: "INVALID_LAYERS" },
    { options: { scope: { memorySpaceId: "space-a" }, layers: ["invalid"] }, code: "INVALID_LAYERS" },
    { options: { scope: { memorySpaceId: "space-a" }, layers: "vector" }, code: "INVALID_LAYERS" },
    { options: { scope: { memorySpaceId: "space-a" }, rules: [] }, code: "INVALID_RULES" },
    { options: { scope: { memorySpaceId: "space-a" }, rules: ["invalid"] }, code: "INVALID_RULES" },
    { options: { scope: { memorySpaceId: "space-a" }, rules: "retention" }, code: "INVALID_RULES" },
  ])("preserves $code validation before capability rejection or any dispatch (%j)", async ({ options, code }) => {
    current = fixture(withResilience);
    // Exercise untrusted runtime input at the real API boundary.
    const error: unknown = await current.api.enforce(options as EnforcementOptions)
      .catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(GovernanceValidationError);
    expect(error).not.toBeInstanceOf(GovernanceCapabilityError);
    expect(error).toMatchObject({ name: "GovernanceValidationError", code });
    assertNotDispatched();
  });
});
