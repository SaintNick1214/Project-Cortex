/** Backend-issued authority references. Host JWT claims and AuthContext are not grants. */
export const RUNTIME_CAPABILITIES = [
  "read", "write", "run", "admin", "tool", "storage:read", "storage:write",
] as const;

export type RuntimeCapability = (typeof RUNTIME_CAPABILITIES)[number];
export type RuntimeActorKind = "user" | "service";
/** Cross-principal access is explicit; an admin capability is never a wildcard. */
export type RuntimeResourceAccess = "own" | "space" | "tenant";

/** Persist this reference for background work, never a JWT or provider credential. */
export interface RuntimeAuthorityReference {
  principalId: string;
  principalVersion: number;
  membershipId: string;
  membershipVersion: number;
  grantId: string;
  grantVersion: number;
  tenantId: string;
  tenantEpoch: number;
  memorySpaceId?: string;
  memorySpaceEpoch?: number;
}

export interface RuntimeAuthority extends RuntimeAuthorityReference {
  actorKind: RuntimeActorKind;
  /** Trusted operator binding for existing metadata APIs; never a caller claim. */
  userId: string;
  capabilities: RuntimeCapability[];
  resourceAccess: RuntimeResourceAccess;
}

export type RuntimeResourceType =
  | "tenant" | "memorySpace" | "conversation" | "memory" | "fact"
  | "artifact" | "attachment" | "source" | "run" | "context" | "storage";

/** A trusted backend adapter constructs this from the canonical persisted resource. */
export interface RuntimeResource {
  resourceType: RuntimeResourceType;
  resourceId: string;
  tenantId?: string;
  memorySpaceId?: string;
  ownerPrincipalId?: string;
}

/** Caller scope selectors narrow authority; their omission never means global access. */
export interface RuntimeAuthorityRequirement {
  capability: RuntimeCapability;
  tenantId?: string;
  memorySpaceId?: string;
  resource?: RuntimeResource;
  actorKind?: RuntimeActorKind;
}
