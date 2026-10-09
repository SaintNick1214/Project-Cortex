import { jest } from "@jest/globals";
import { ConvexClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { UsersAPI } from "../../src/users";
import { ResilienceLayer } from "../../src/resilience";

const fixtures: { client: ConvexClient; resilience: ResilienceLayer }[] = [];
afterEach(async () => {
  for (const f of fixtures.splice(0)) { f.resilience.stopQueueProcessor(); await f.client.close(); }
  jest.restoreAllMocks();
});
function fixture() {
  const client = new ConvexClient("https://example.convex.cloud", { disabled: true, logger: false });
  const resilience = new ResilienceLayer({ enabled: true, retry: { maxRetries: 0 } });
  fixtures.push({ client, resilience });
  const mutation = jest.spyOn(client, "mutation"), query = jest.spyOn(client, "query");
  return { users: new UsersAPI(client, undefined, resilience), mutation, query };
}
it.each([new ConvexError({ code: "FORBIDDEN" }), new Error("secret deployment URL and credential")])("preserves a confirmed purge when verification cannot disclose its result", async error => {
  const f = fixture(); f.mutation.mockResolvedValue({ deleted: true }); f.query.mockRejectedValue(error);
  const result = await f.users.delete("owned-user");
  expect(result).toMatchObject({ totalDeleted: 1, deletedLayers: ["user-profile"], verification: { scope: "user-profile", complete: false, issues: ["USER_PROFILE_VERIFICATION_UNAVAILABLE"] } });
  expect(f.mutation).toHaveBeenCalledTimes(1); expect(f.query).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(result)).not.toContain("secret");
});
it("returns complete verification only when the actual read confirms absence", async () => {
  const f = fixture(); f.mutation.mockResolvedValue({ deleted: true }); f.query.mockResolvedValue(null);
  expect(await f.users.delete("owned-user")).toMatchObject({ totalDeleted: 1, verification: { complete: true, issues: [] } });
  expect(f.mutation).toHaveBeenCalledTimes(1);
});
it.each([new ConvexError({ code: "FORBIDDEN" }), new Error("network outcome unknown")])("propagates a purge failure before any verification read", async error => {
  const f = fixture(); f.mutation.mockRejectedValue(error);
  await expect(f.users.delete("owned-user")).rejects.toThrow();
  expect(f.mutation).toHaveBeenCalledTimes(1); expect(f.query).not.toHaveBeenCalled();
});
it("does not fabricate deletion counts for an unconfirmed receipt", async () => {
  const f = fixture(); f.mutation.mockResolvedValue({ deleted: false }); f.query.mockResolvedValue(null);
  expect(await f.users.delete("owned-user")).toMatchObject({ totalDeleted: 0, deletedLayers: [] });
});
it("refuses a malformed receipt and does not read or fabricate success", async () => {
  const f = fixture(); f.mutation.mockResolvedValue({});
  await expect(f.users.delete("owned-user")).rejects.toThrow("confirmed receipt");
  expect(f.mutation).toHaveBeenCalledTimes(1); expect(f.query).not.toHaveBeenCalled();
});
it("dry runs do not dispatch mutation or verification", async () => {
  const f = fixture();
  expect(await f.users.delete("owned-user", { dryRun: true })).toMatchObject({ totalDeleted: 0, verification: { complete: false } });
  expect(f.mutation).not.toHaveBeenCalled(); expect(f.query).not.toHaveBeenCalled();
});
