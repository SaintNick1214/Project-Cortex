/** Shared native fence for execution, paid admission, delivery and transcript reuse. */
import type { QueryCtx } from "./_generated/server";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import { contextWitnessPermissions } from "../src/domain/context-witness";
import type { ContextSourceWitness } from "../src/domain/context-witness";
import { ConvexMemoryRepository, memoryError } from "./runtimeMemoryRepository";

export async function checkContextSourceWitnesses(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference,
  witnesses: readonly ContextSourceWitness[], deadlines?: number[]): Promise<void> {
  const repository = new ConvexMemoryRepository(ctx, reference, "read");
  for (const witness of witnesses) for (const permission of contextWitnessPermissions(witness)) {
    const source = await repository.getSource(witness.sourceId, permission, deadlines);
    if (!source || source.lineage.sourceEventId !== witness.sourceEventId || source.lineage.sourceRevision !== witness.sourceRevision
      || source.contentHash !== witness.contentHash) memoryError("STALE_CONTEXT", "Cached context source is no longer current");
  }
}
