import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { ConvexClient } from "convex/browser";
import { SessionsAPI, SessionCapabilityError } from "../../../src/sessions";
import { AuthValidationError } from "../../../src/auth";
import { ResilienceLayer } from "../../../src/resilience";
import type { ExpireSessionsOptions } from "../../../src/sessions/types";

function fixture(mode: "absent" | "disabled" | "enabled", tenantId?: string) {
  const client = new ConvexClient("https://example.convex.cloud", {
    disabled: true,
    logger: false,
  });
  const mutation = jest.spyOn(client, "mutation");
  const query = jest.spyOn(client, "query");
  const action = jest.spyOn(client, "action");
  const resilience = new ResilienceLayer({ enabled: mode === "enabled" });
  const execute = jest.spyOn(resilience, "execute");
  const sessions = new SessionsAPI(client, undefined,
    mode === "absent" ? undefined : resilience,
    tenantId === undefined ? undefined : { userId: "sdk-user", tenantId });
  return { sessions, client, mutation, query, action, resilience, execute };
}

describe.each(["absent", "disabled", "enabled"] as const)(
  "session maintenance boundary (resilience=%s)", (mode) => {
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

    it.each<ExpireSessionsOptions | undefined>([
      undefined,
      {},
      { idleTimeout: 15 * 60 * 1000 },
      { tenantId: "tenant-a" },
      { tenantId: "tenant-a", idleTimeout: 0 },
    ])("returns a typed undispatched outcome for valid options %j", async (options) => {
      current = fixture(mode);
      const error: unknown = await current.sessions.expireIdle(options)
        .catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(SessionCapabilityError);
      expect(error).toMatchObject({
        name: "SessionCapabilityError",
        code: "BACKEND_MAINTENANCE_ONLY",
        retryable: false,
        outcome: "not_dispatched",
        requiredExecution: "trusted_backend_worker",
      });
      if (!(error instanceof SessionCapabilityError)) throw new Error("Expected capability error");
      expect(error.message).toContain("requires a trusted backend worker");
      expect(Object.keys(error).sort()).toEqual([
        "code", "name", "outcome", "requiredExecution", "retryable",
      ]);
      expect(JSON.stringify(error)).not.toMatch(/operator|credentials|FunctionReference/);
      assertNotDispatched();
    });

    it.each<ExpireSessionsOptions | undefined>([
      undefined,
      {},
      { tenantId: "tenant-a", idleTimeout: 1000 },
    ])("accepts the configured tenant selector before capability rejection %j", async (options) => {
      current = fixture(mode, "tenant-a");
      await expect(current.sessions.expireIdle(options)).rejects.toBeInstanceOf(SessionCapabilityError);
      assertNotDispatched();
    });

    it("preserves tenant mismatch validation before reading the timeout or dispatching", async () => {
      current = fixture(mode, "tenant-a");
      const timeoutRead = jest.fn(() => 1000);
      const options: ExpireSessionsOptions = {
        tenantId: "tenant-b",
        get idleTimeout() { return timeoutRead(); },
      };
      const error: unknown = await current.sessions.expireIdle(options)
        .catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(AuthValidationError);
      expect(error).not.toBeInstanceOf(SessionCapabilityError);
      expect(error).toMatchObject({ code: "TENANT_SCOPE_MISMATCH", field: "tenantId" });
      expect(timeoutRead).not.toHaveBeenCalled();
      assertNotDispatched();
    });
  },
);
