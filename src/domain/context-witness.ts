/** Cached context retains the separate data permissions used to produce it. */
export type ContextSourcePermission = "canViewFacts" | "canViewMemories";
export type ContextSourceWitness = {
  sourceId: string; sourceEventId: string; sourceRevision: number; contentHash: string;
  permissions?: ContextSourcePermission[];
};
const permissions: ContextSourcePermission[] = ["canViewFacts", "canViewMemories"];
/** Untagged historical context could contain both kinds of data. */
export function contextWitnessPermissions(witness: ContextSourceWitness): ContextSourcePermission[] {
  return permissions.filter(permission => !witness.permissions?.length || witness.permissions.includes(permission));
}
export function mergeContextWitness(prior: ContextSourceWitness | undefined, next: ContextSourceWitness): ContextSourceWitness | null {
  if (prior && (prior.sourceId !== next.sourceId || prior.sourceEventId !== next.sourceEventId
    || prior.sourceRevision !== next.sourceRevision || prior.contentHash !== next.contentHash)) return null;
  const needed = new Set([...contextWitnessPermissions(next), ...(prior ? contextWitnessPermissions(prior) : [])]);
  return { sourceId: next.sourceId, sourceEventId: next.sourceEventId, sourceRevision: next.sourceRevision,
    contentHash: next.contentHash, permissions: permissions.filter(permission => needed.has(permission)) };
}
