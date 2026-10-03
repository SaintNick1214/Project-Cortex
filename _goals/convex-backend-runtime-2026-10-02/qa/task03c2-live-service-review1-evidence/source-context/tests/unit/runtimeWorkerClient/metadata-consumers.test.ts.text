import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { ConvexClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import { api } from "../../../convex-dev/_generated/api";
import { UsersAPI, UserProfileWriteReceiptError, UserValidationError } from "../../../src/users";
import { ResilienceLayer } from "../../../src/resilience";

type StoreResult = FunctionReturnType<typeof api.immutable.store>;
type Hydrated = Extract<StoreResult, { version: number }>;
type SafeReceipt = Extract<StoreResult, { updated: true }>;

// Only the fixture's owned fake document ID is branded; response shapes use the
// actual generated backend union without casts between receipts and profiles.
const documentId = "owned-immutable-document" as Id<"immutable">;
const profile = {
  _id: documentId,
  _creationTime: 10,
  type: "user",
  id: "server-user",
  tenantId: "tenant-a",
  memorySpaceId: "space-a",
  data: { name: "Existing", preferences: { theme: "dark", language: "en" } },
  version: 7,
  previousVersions: [],
  createdAt: 20,
  updatedAt: 30,
} satisfies Hydrated;
const hydrated = {
  ...profile,
  data: { name: "Server canonical", preferences: { theme: "light", language: "en" } },
  version: 8,
  updatedAt: 40,
} satisfies Hydrated;
const receipt = {
  updated: true,
  type: "user",
  id: "server-user",
  tenantId: "tenant-a",
  memorySpaceId: "space-a",
} satisfies SafeReceipt;
const createdReceipt = { ...receipt, createdId: documentId } satisfies SafeReceipt;
const tenantReceipt = { ...receipt, memorySpaceId: undefined } satisfies SafeReceipt;

function mapped(row: Hydrated) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    data: row.data,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function fixture(mode: "absent" | "disabled" | "enabled") {
  const client = new ConvexClient("https://example.convex.cloud", { disabled: true, logger: false });
  const mutation = jest.spyOn(client, "mutation");
  const query = jest.spyOn(client, "query");
  const action = jest.spyOn(client, "action");
  const onRetry = jest.fn();
  const resilience = new ResilienceLayer({
    enabled: mode === "enabled",
    retry: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 1, jitter: false },
    onRetry,
  });
  const execute = jest.spyOn(resilience, "execute");
  const users = new UsersAPI(client, undefined,
    mode === "absent" ? undefined : resilience,
    { userId: "sdk-user", tenantId: "tenant-a" });
  return { users, client, mutation, query, action, resilience, execute, onRetry };
}

describe.each(["absent", "disabled", "enabled"] as const)(
  "metadata consumers (resilience=%s)", (mode) => {
    let current: ReturnType<typeof fixture> | undefined;

    afterEach(async () => {
      await current?.client.close();
      await current?.resilience.shutdown();
      jest.restoreAllMocks();
    });

    function assertAttempts(queries: number, writes: number) {
      expect(current?.query).toHaveBeenCalledTimes(queries);
      expect(current?.mutation).toHaveBeenCalledTimes(writes);
      expect(current?.action).not.toHaveBeenCalled();
      expect(current?.execute.mock.calls.map((call) => call[1]))
        .toEqual(mode === "absent" ? [] : [
          ...Array.from({ length: queries }, () => "users:get"),
          ...Array.from({ length: writes }, () => "users:update"),
        ]);
      expect(current?.onRetry).not.toHaveBeenCalled();
    }

    it("maps only the hydrated backend profile and preserves deep merge and tenant injection", async () => {
      current = fixture(mode);
      current.query.mockResolvedValue(profile);
      current.mutation.mockResolvedValue(hydrated);
      const result = await current.users.update("caller-user", { preferences: { theme: "light" } });
      expect(result).toEqual(mapped(hydrated));
      expect(current.query).toHaveBeenCalledWith(api.immutable.get, {
        type: "user", id: "caller-user", tenantId: "tenant-a",
      });
      expect(current.mutation).toHaveBeenCalledWith(api.immutable.store, {
        type: "user", id: "caller-user", tenantId: "tenant-a",
        data: { name: "Existing", preferences: { theme: "light", language: "en" } },
      });
      assertAttempts(1, 1);
    });

    it.each([receipt, createdReceipt, tenantReceipt])("reports a committed receipt without fabricating a profile or rereading (%j)", async (safeReceipt) => {
      current = fixture(mode);
      current.query.mockResolvedValue(profile);
      current.mutation.mockResolvedValue(safeReceipt);
      const error: unknown = await current.users.update("caller-user", { privateInput: "caller-payload" })
        .catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(UserProfileWriteReceiptError);
      expect(error).not.toBeInstanceOf(UserValidationError);
      if (!(error instanceof UserProfileWriteReceiptError)) throw new Error("Expected committed receipt");
      expect(error).toMatchObject({
        name: "UserProfileWriteReceiptError",
        code: "PROFILE_WRITE_COMMITTED_READ_UNAVAILABLE",
        retryable: false,
        outcome: "committed",
        requiredCapability: "read",
      });
      expect(error.receipt).toEqual(safeReceipt);
      expect(error.receipt).not.toBe(safeReceipt);
      expect(Object.isFrozen(error.receipt)).toBe(true);
      expect(Object.keys(error).sort()).toEqual([
        "code", "name", "outcome", "receipt", "requiredCapability", "retryable",
      ]);
      expect(JSON.stringify(error)).not.toMatch(/caller-payload|caller-user|Existing|data|version|createdAt|updatedAt|cause/);
      assertAttempts(1, 1);
      if (mode !== "absent") {
        // The actual resilience operation resolves successfully before the SDK
        // interprets its committed receipt. It never observes this public error.
        await expect(current.execute.mock.results[1].value).resolves.toEqual(safeReceipt);
      }
    });

    it("copies only explicitly safe server receipt fields even if extra payload properties exist", async () => {
      current = fixture(mode);
      const extraPayload = {
        ...createdReceipt, data: { token: "backend-secret" }, version: 12,
        createdAt: 100, updatedAt: 200, cause: new Error("private-cause"),
      };
      const returned: StoreResult = extraPayload;
      current.query.mockResolvedValue(null);
      current.mutation.mockResolvedValue(returned);
      const error: unknown = await current.users.update("caller-user", { token: "caller-secret" })
        .catch((failure: unknown) => failure);
      if (!(error instanceof UserProfileWriteReceiptError)) throw new Error("Expected committed receipt");
      expect(error.receipt).toEqual(createdReceipt);
      expect(JSON.stringify(error)).not.toMatch(/backend-secret|caller-secret|private-cause|data|version|createdAt|updatedAt|cause/);
      assertAttempts(1, 1);
    });

    it.each(["getOrCreate", "merge"] as const)("propagates the committed outcome from %s without rereading after the write", async (method) => {
      current = fixture(mode);
      current.query.mockResolvedValue(method === "getOrCreate" ? null : profile);
      current.mutation.mockResolvedValue(createdReceipt);
      const error: unknown = await current.users[method]("caller-user", { name: "caller-payload" })
        .catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(UserProfileWriteReceiptError);
      expect(error).toMatchObject({ outcome: "committed", receipt: createdReceipt });
      assertAttempts(2, 1);
    });

    it("getOrCreate returns the existing profile without a write", async () => {
      current = fixture(mode);
      current.query.mockResolvedValue(profile);
      await expect(current.users.getOrCreate("caller-user", { name: "unused" })).resolves.toEqual(mapped(profile));
      assertAttempts(1, 0);
    });

    it("getOrCreate preserves the empty defaults and hydrated creation result", async () => {
      current = fixture(mode);
      current.query.mockResolvedValue(null);
      current.mutation.mockResolvedValue(hydrated);
      await expect(current.users.getOrCreate("caller-user")).resolves.toEqual(mapped(hydrated));
      expect(current.mutation).toHaveBeenCalledWith(api.immutable.store, {
        type: "user", id: "caller-user", tenantId: "tenant-a", data: {},
      });
      assertAttempts(2, 1);
    });

    it.each([true, false])("merge preserves hydrated results and default merge semantics (existing=%s)", async (exists) => {
      current = fixture(mode);
      current.query.mockResolvedValue(exists ? profile : null);
      current.mutation.mockResolvedValue(hydrated);
      await expect(current.users.merge("caller-user", { preferences: { theme: "light" } })).resolves.toEqual(mapped(hydrated));
      expect(current.mutation).toHaveBeenCalledWith(api.immutable.store, {
        type: "user", id: "caller-user", tenantId: "tenant-a",
        data: exists ? { name: "Existing", preferences: { theme: "light", language: "en" } }
          : { preferences: { theme: "light" } },
      });
      assertAttempts(2, 1);
    });

    it.each(["update", "getOrCreate", "merge"] as const)("preserves read failure before %s and never introduces a blind write", async (method) => {
      current = fixture(mode);
      const denied = new Error("PERMISSION_DENIED");
      current.query.mockRejectedValue(denied);
      await expect(current.users[method]("caller-user", { name: "unused" })).rejects.toBe(denied);
      assertAttempts(1, 0);
    });

    it.each(["update", "getOrCreate", "merge"] as const)("validates malformed profile data before %s reads or writes", async (method) => {
      current = fixture(mode);
      // Reflect exercises external runtime data without lying about its type.
      const request: Promise<unknown> = Reflect.apply(current.users[method], current.users, ["caller-user", []]);
      await expect(request).rejects.toMatchObject({ name: "UserValidationError", code: "INVALID_DATA_TYPE" });
      assertAttempts(0, 0);
    });

    it.each(["update", "getOrCreate", "merge"] as const)("validates the identifier before %s dispatch", async (method) => {
      current = fixture(mode);
      await expect(current.users[method](" ", {})).rejects.toMatchObject({ name: "UserValidationError", code: "INVALID_USER_ID_FORMAT" });
      assertAttempts(0, 0);
    });

    it("preserves ordinary mutation failure identity", async () => {
      current = fixture(mode);
      const failure = new Error("PERMISSION_DENIED");
      current.query.mockResolvedValue(profile);
      current.mutation.mockRejectedValue(failure);
      await expect(current.users.update("caller-user", {})).rejects.toBe(failure);
      assertAttempts(1, 1);
    });

    it("bulk update rejects the exact committed receipt instead of reporting an unsuccessful count", async () => {
      current = fixture(mode);
      current.query.mockResolvedValue(profile);
      current.mutation.mockResolvedValue(receipt);
      const error: unknown = await current.users.updateMany(["caller-user", "untouched-user"], { data: {} })
        .catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(UserProfileWriteReceiptError);
      expect(error).toMatchObject({ outcome: "committed", receipt });
      assertAttempts(2, 1);
      expect(current.mutation.mock.calls[0][1]).toMatchObject({ id: "caller-user" });
    });

    it("bulk propagation preserves earlier committed writes and stops before later items", async () => {
      current = fixture(mode);
      current.query.mockResolvedValue(profile);
      current.mutation.mockResolvedValueOnce(hydrated).mockResolvedValueOnce(createdReceipt);
      const error: unknown = await current.users.updateMany(["first-user", "second-user", "third-user"], { data: { status: "active" } })
        .catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(UserProfileWriteReceiptError);
      expect(error).toMatchObject({ outcome: "committed", receipt: createdReceipt });
      expect(current.query).toHaveBeenCalledTimes(4);
      expect(current.mutation.mock.calls.map((call) => call[1])).toEqual([
        expect.objectContaining({ id: "first-user" }), expect.objectContaining({ id: "second-user" }),
      ]);
      expect(current.execute.mock.calls.map((call) => call[1])).toEqual(mode === "absent" ? [] : [
        "users:get", "users:get", "users:update", "users:get", "users:get", "users:update",
      ]);
      expect(current.onRetry).not.toHaveBeenCalled();
      expect(current.action).not.toHaveBeenCalled();
    });

    it("bulk updates preserve ordinary failures, missing rows and successful counts", async () => {
      current = fixture(mode);
      current.query.mockRejectedValueOnce(new Error("PERMISSION_DENIED"))
        .mockResolvedValueOnce(null).mockResolvedValueOnce(profile).mockResolvedValueOnce(profile);
      current.mutation.mockResolvedValue(hydrated);
      await expect(current.users.updateMany(["denied", "missing", "success"], { data: {} })).resolves.toEqual({ updated: 1, userIds: ["success"] });
      assertAttempts(4, 1);
    });

    it("bulk dry run preserves selected IDs without any reads or writes", async () => {
      current = fixture(mode);
      await expect(current.users.updateMany(["caller-user"], { data: {} }, { dryRun: true }))
        .resolves.toEqual({ updated: 0, userIds: ["caller-user"] });
      assertAttempts(0, 0);
    });

    it("bulk validation rejects malformed updates before any attempt", async () => {
      current = fixture(mode);
      const request: Promise<unknown> = Reflect.apply(current.users.updateMany, current.users, [["caller-user"], { data: [] }]);
      await expect(request).rejects.toMatchObject({ name: "UserValidationError", code: "INVALID_DATA_TYPE" });
      assertAttempts(0, 0);
    });
  },
);

it("preserves actual resilience retry behavior for an ordinary transient mutation failure", async () => {
  const current = fixture("enabled");
  try {
    current.query.mockResolvedValue(profile);
    current.mutation.mockRejectedValueOnce(new Error("Server Error"))
      .mockRejectedValueOnce(new Error("Server Error")).mockResolvedValueOnce(hydrated);
    await expect(current.users.update("caller-user", {})).resolves.toEqual(mapped(hydrated));
    expect(current.query).toHaveBeenCalledTimes(1);
    expect(current.mutation).toHaveBeenCalledTimes(3);
    expect(current.execute.mock.calls.map((call) => call[1])).toEqual(["users:get", "users:update"]);
    expect(current.onRetry).toHaveBeenCalledTimes(2);
    expect(current.action).not.toHaveBeenCalled();
  } finally {
    await current.client.close();
    await current.resilience.shutdown();
    jest.restoreAllMocks();
  }
});
