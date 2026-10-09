import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { createRuntimeFixture } from "./runtime-fixture";
import { createNamedTestRunContext } from "./isolation";

type Invocation = [name: string, kind: "query" | "mutation", args: Record<string, unknown>];

/** Current source closure from 9b811b04d. The former success catalog is retained
 * under _DEPRECATED/tests/legacy-transcript and contributes no current coverage. */
export function unavailableTranscriptContract(domain: "conversationShares" | "conversationSnapshots", operations: Invocation[]) {
  const run = createNamedTestRunContext(domain);
  const tenantId = run.runId, memorySpaceId = run.memorySpaceId("runtime");
  let fixture: Awaited<ReturnType<typeof createRuntimeFixture>>;
  const dispatch = (client: ConvexHttpClient | ReturnType<typeof fixture.cortex.getClient>, kind: Invocation[1], name: string, args: Record<string, unknown>) =>
    kind === "query" ? client.query(makeFunctionReference<"query">(`${domain}:${name}`), args)
      : client.mutation(makeFunctionReference<"mutation">(`${domain}:${name}`), args);
  beforeAll(async () => { fixture = await createRuntimeFixture(tenantId, memorySpaceId, run.userId("owner")); });
  afterAll(async () => { await fixture?.close(); });

  it.each(operations)("%s refuses canonical transcript capability after genuine identity/grants, before effects", async (name, kind, args) => {
    expect(await fixture.ownedRows(domain)).toEqual([]);
    await expect(dispatch(fixture.cortex.getClient(), kind, name, { ...args, tenantId, memorySpaceId }))
      .rejects.toMatchObject({ data: { code: "CAPABILITY_NOT_READY", outcome: "not_dispatched", retryable: false } });
    expect(await fixture.ownedRows(domain)).toEqual([]);
  });

  it("rejects an ordinary public client before revealing transcript capability", async () => {
    const [name, kind, args] = operations[0];
    const ordinary = new ConvexHttpClient(process.env.CONVEX_URL!, { logger: false });
    await expect(dispatch(ordinary, kind, name, { ...args, tenantId, memorySpaceId }))
      .rejects.toMatchObject({ data: { code: "UNAUTHENTICATED", outcome: "not_dispatched" } });
    expect(await fixture.ownedRows(domain)).toEqual([]);
  });

  it("rejects a forged tenant selector without accessing a foreign source", async () => {
    const [name, kind, args] = operations[0];
    await expect(dispatch(fixture.cortex.getClient(), kind, name, { ...args, tenantId: run.runId + "-foreign", memorySpaceId }))
      .rejects.toMatchObject({ data: { code: "FORBIDDEN", outcome: "not_dispatched" } });
    expect(await fixture.ownedRows(domain)).toEqual([]);
  });
}
