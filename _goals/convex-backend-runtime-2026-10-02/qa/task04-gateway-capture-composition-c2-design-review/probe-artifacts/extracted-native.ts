function integer(value: number, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum) fail("INVALID_INPUT");
  return value;
}
function purpose(key: ModelOperationKey): RuntimeCapability {
  return key === "embedding.query" ? "read" : key === "memory.extract" || key === "facts.resolve" || key === "embedding.memory" ? "write" : "run";
}
async function checkSource(ctx: ReadCtx, reference: RuntimeAuthorityReference, key: ModelOperationKey, source?: Source) {
  if (!source) {
    if (key === "memory.extract" || key === "embedding.memory" || key === "facts.resolve") fail("FORBIDDEN");
    return;
  }
  integer(source.sourceRevision, 1);
  const capability = purpose(key) === "write" ? "write" : "read";
  const row = await new ConvexMemoryRepository(ctx, reference, capability).getSource(source.sourceId);
  if (!row || row.lineage.sourceEventId !== source.sourceEventId || row.lineage.sourceRevision !== source.sourceRevision || row.contentHash !== source.contentHash) fail("FORBIDDEN");
  if (await semanticHash(row.content) !== source.contentHash) fail("FORBIDDEN");
}