import { isDeploymentOperatorClient } from "../common/deploymentOperator";
import type { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { FactRecord } from "../types";

export interface ScopedPage<T> {
  page: T[];
  isDone: boolean;
  continueCursor: string;
  splitCursor?: string | null;
  pageStatus?: "SplitRequired" | "SplitRecommended" | null;
}
export interface PageRange {
  cursor: string | null;
  endCursor: string | null;
}
export class FactsDiscoveryError extends Error {
  constructor(
    readonly stage: string,
    readonly originalCause: unknown,
  ) {
    super(`Facts discovery failed at ${stage}`);
    this.name = "FactsDiscoveryError";
  }
}
function isPageEnvelope(value: unknown): value is ScopedPage<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const page = value as Record<string, unknown>;
  return (
    Array.isArray(page.page) &&
    typeof page.isDone === "boolean" &&
    typeof page.continueCursor === "string" &&
    (page.splitCursor === undefined ||
      page.splitCursor === null ||
      typeof page.splitCursor === "string") &&
    (page.pageStatus === undefined ||
      page.pageStatus === null ||
      page.pageStatus === "SplitRequired" ||
      page.pageStatus === "SplitRecommended")
  );
}
/** Native end-range splitting. Discard provisional split pages, preserve parent tail. */
export async function* scopedPages<T>(
  load: (range: PageRange) => Promise<unknown>,
  stage: string,
): AsyncGenerator<T[]> {
  const queue: PageRange[] = [{ cursor: null, endCursor: null }];
  const requested = new Set<string>();
  while (queue.length) {
    let range = queue.shift()!;
    const seen = new Set<string>();
    for (;;) {
      const key = JSON.stringify([range.cursor, range.endCursor]);
      if (requested.has(key))
        throw new FactsDiscoveryError(
          stage,
          new Error("Repeated page request range"),
        );
      requested.add(key);
      let value: unknown;
      try {
        value = await load(range);
      } catch (error) {
        throw new FactsDiscoveryError(stage, error);
      }
      if (!isPageEnvelope(value))
        throw new FactsDiscoveryError(
          stage,
          new Error("Invalid page envelope"),
        );
      const p = value as ScopedPage<T>;
      if (p.pageStatus === "SplitRequired") {
        if (
          !p.splitCursor ||
          p.splitCursor === range.cursor ||
          p.splitCursor === range.endCursor
        )
          throw new FactsDiscoveryError(
            stage,
            new Error("Invalid split cursor"),
          );
        queue.unshift({ cursor: p.splitCursor, endCursor: range.endCursor });
        range = { cursor: range.cursor, endCursor: p.splitCursor };
        continue;
      }
      yield p.page;
      // Native isDone describes the full query; an end-bounded child can finish
      // before that query does. Preserve its yielded rows and queued parent tail.
      if (
        p.isDone ||
        (range.endCursor !== null && p.continueCursor === range.endCursor)
      ) break;
      if (
        !p.continueCursor ||
        p.continueCursor === range.cursor ||
        seen.has(p.continueCursor)
      )
        throw new FactsDiscoveryError(stage, new Error("Non-advancing cursor"));
      seen.add(p.continueCursor);
      range = { ...range, cursor: p.continueCursor };
    }
  }
}
export async function collectCandidates(
  client: ConvexClient,
  name: "list" | "queryBySubject" | "findByStructure",
  args: Record<string, unknown>,
  cap: number,
): Promise<FactRecord[]> {
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > 256) throw new FactsDiscoveryError(name, new Error("Invalid candidate cap"));
  if (!isDeploymentOperatorClient(client)) {
    // The public list validator accepts the same bounded candidate selectors,
    // including tenantId; only the server's verified grant supplies authority.
    const selected = Object.fromEntries(Object.entries(args).filter(([key]) => key !== "limit"));
    return client.mutation(makeFunctionReference<"mutation", Record<string, unknown>, FactRecord[]>("facts:list"), {...selected, includeSuperseded: false, limit: cap});
  }
  const result: FactRecord[] = [];
  for await (const page of scopedPages<FactRecord>(async (range) => {
    const value: unknown = await client.query(
      makeFunctionReference<"query">("facts:candidatePage"),
      {
        ...Object.fromEntries(
          Object.entries(args).filter(([key]) => key !== "limit"),
        ),
        operation: name,
        paginationOpts: { ...range, numItems: Math.min(cap, 256) },
      },
    );
    return value;
  }, name)) {
    result.push(...page.slice(0, cap - result.length));
    if (result.length >= cap) break;
  }
  return result;
}
export function resolveFactScope(
  contextTenant: string | undefined,
  selected: string | undefined,
): string | undefined {
  if (
    contextTenant !== undefined &&
    selected !== undefined &&
    contextTenant !== selected
  )
    throw new Error("FACT_HISTORY_SCOPE_MISMATCH");
  return selected ?? contextTenant;
}
