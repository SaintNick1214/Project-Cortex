/** Native persisted-state assertions for public refusals. Provisioning stays in the
 * caller's fixed runtime fixture plan; caller labels never create authority. */
import { ConvexClient } from "convex/browser";
import type {
  FunctionReference,
  FunctionArgs,
  FunctionReturnType,
} from "convex/server";
import type { createRuntimeFixture } from "./runtime-fixture";

export type RuntimeFixture = Awaited<ReturnType<typeof createRuntimeFixture>>;
export async function expectRefusalNoEffects(
  run: () => Promise<unknown>,
  fixtures: RuntimeFixture[],
  table: Parameters<RuntimeFixture["ownedRows"]>[0],
  code: string,
) {
  const before = await Promise.all(
    fixtures.map((fixture) => fixture.ownedRows(table)),
  );
  const result = run();
  await expect(result).rejects.toThrow(code);
  if (code === "CAPABILITY_NOT_READY") {
    const error: unknown = await result.catch((failure: unknown) => failure);
    expect((error as Error).message).toContain('"outcome":"not_dispatched"');
  }
  expect(
    await Promise.all(fixtures.map((fixture) => fixture.ownedRows(table))),
  ).toEqual(before);
}

/** Exercise genuine registered public refusal handlers when historical SDK
 * paging services are absent. This transport has only the fixture's fixed grant. */
export async function queryPublic<
  Q extends FunctionReference<"query", "public">,
>(
  fixture: RuntimeFixture,
  reference: Q,
  args: FunctionArgs<Q>,
): Promise<FunctionReturnType<Q>> {
  const client = new ConvexClient(process.env.CONVEX_URL!, {
    logger: false,
    unsavedChangesWarning: false,
  });
  fixture.initializeTransport(client);
  try {
    return await client.query(reference, args);
  } finally {
    await client.close();
  }
}
export async function mutatePublic<
  M extends FunctionReference<"mutation", "public">,
>(
  fixture: RuntimeFixture,
  reference: M,
  args: FunctionArgs<M>,
): Promise<FunctionReturnType<M>> {
  const client = new ConvexClient(process.env.CONVEX_URL!, {
    logger: false,
    unsavedChangesWarning: false,
  });
  fixture.initializeTransport(client);
  try {
    return await client.mutation(reference, args);
  } finally {
    await client.close();
  }
}

/** RecallItem is a flattened view and need not repeat tenantId. Compare every
 * returned logical ID with real native source rows in the fixture's owned scope. */
export async function expectOwnedRecallItems(
  items: Array<{ id: string }>,
  fixture: RuntimeFixture,
) {
  const rows = [
    ...(await fixture.ownedRows("memories")),
    ...(await fixture.ownedRows("facts")),
  ];
  const ids = new Set(
    rows.flatMap((row) => {
      const source = row as { memoryId?: string; factId?: string };
      return [source.memoryId, source.factId].filter(
        (id): id is string => typeof id === "string",
      );
    }),
  );
  for (const item of items) expect(ids.has(item.id)).toBe(true);
}
