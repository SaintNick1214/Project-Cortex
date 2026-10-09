/** Native persisted-state assertions for public refusals. Provisioning stays in the
 * caller's fixed runtime fixture plan; caller labels never create authority. */
import { ConvexClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { CascadeDeletionError } from "../../src/users";
import { ErasureError } from "../../src/users/erasure";
import type {
  FunctionReference,
  FunctionArgs,
  FunctionReturnType,
} from "convex/server";
import type { createRuntimeFixture } from "./runtime-fixture";

export type RuntimeFixture = Awaited<ReturnType<typeof createRuntimeFixture>>;

/** Managed deployments redact diagnostics, but retain native errorData. Some SDK
 * APIs serialize that data into a complete JSON Error.message. Validate the exact
 * structured code in either representation; diagnostic substrings never suffice. */
export async function expectConvexRefusal(result: Promise<unknown>, code: string) {
  const outcome = await result.then(
    () => ({ fulfilled: true as const }),
    (error: unknown) => ({ fulfilled: false as const, error }),
  );
  expect(outcome.fulfilled).toBe(false);
  if (outcome.fulfilled) throw new Error("Expected a typed native Convex refusal");
  let data: unknown;
  if (outcome.error instanceof ConvexError) {
    data = outcome.error.data;
  } else {
    expect(outcome.error).toBeInstanceOf(Error);
    if (!(outcome.error instanceof Error))
      throw new Error("Expected structured native refusal data");
    try {
      data = JSON.parse(outcome.error.message);
    } catch {
      throw new Error("Expected structured native refusal data");
    }
    expect(data).toMatchObject({ message: expect.any(String) });
  }
  expect(data).toMatchObject({ code });
  if (code === "CAPABILITY_NOT_READY")
    expect(data).toMatchObject({ outcome: "not_dispatched" });
}

export async function expectRefusalNoEffects(
  run: () => Promise<unknown>,
  fixtures: RuntimeFixture[],
  table: Parameters<RuntimeFixture["ownedRows"]>[0],
  code: string,
) {
  const before = await Promise.all(
    fixtures.map((fixture) => fixture.ownedRows(table)),
  );
  if (code === "ERASURE_ADMIN_TRANSPORT_REQUIRED") {
    // This is a local pre-dispatch contract, not a server ConvexError. User
    // cascade wraps only the genuine ErasureError in CascadeDeletionError.
    const result = await run().then(
      () => ({ fulfilled: true as const }),
      (error: unknown) => ({ fulfilled: false as const, error }),
    );
    expect(result.fulfilled).toBe(false);
    if (result.fulfilled) throw new Error("Expected an erasure transport refusal");
    const error =
      result.error instanceof CascadeDeletionError
        ? result.error.cause
        : result.error;
    expect(error).toBeInstanceOf(ErasureError);
    if (!(error instanceof ErasureError))
      throw new Error("Expected a typed erasure transport refusal");
    expect(error.code).toBe(code);
  } else {
    await expectConvexRefusal(run(), code);
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
