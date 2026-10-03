/** Registered modern memory endpoints. Only the two foreground actions are public. */
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { RuntimeAuthority, RuntimeAuthorityReference, RuntimeAuthorityRequirement } from "../src/auth/verified";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { commitDerivedInput, sourceContent } from "./runtimeMemorySchema";
import { ConvexMemoryRepository, createActionMemoryRepository, memoryError, memoryScope } from "./runtimeMemoryRepository";
import { explicitSourceLineage, recallMemory, rememberMemory, unconfiguredMemoryModel } from "./runtimeMemoryServices";

const scopedArgs = { reference: runtimeAuthorityReference, capability: v.union(v.literal("read"), v.literal("write")) };
export const checkAuthority = internalQuery({ args: scopedArgs,
  handler: async (ctx, args) => await new ConvexMemoryRepository(ctx, args.reference, args.capability).authority() });
export const readSource = internalQuery({ args: { ...scopedArgs, sourceId: v.string() },
  handler: async (ctx, args) => await new ConvexMemoryRepository(ctx, args.reference, args.capability).getSource(args.sourceId) });
export const writeSource = internalMutation({ args: { ...scopedArgs, source: sourceContent },
  handler: async (ctx, args) => await new ConvexMemoryRepository(ctx, args.reference, args.capability, ctx.db).putSource(args.source) });
export const writeDerived = internalMutation({ args: { ...scopedArgs, input: commitDerivedInput },
  handler: async (ctx, args) => await new ConvexMemoryRepository(ctx, args.reference, args.capability, ctx.db).commitDerived(args.input) });
export const readFacts = internalQuery({ args: { ...scopedArgs, query: v.object({
  subject: v.optional(v.string()), factType: v.optional(v.union(v.literal("preference"), v.literal("identity"), v.literal("knowledge"),
    v.literal("relationship"), v.literal("event"), v.literal("observation"), v.literal("custom"))), limit: v.number(),
}) }, handler: async (ctx, args) => await new ConvexMemoryRepository(ctx, args.reference, args.capability).listFacts(args.query) });
export const readVectorMatches = internalQuery({ args: { ...scopedArgs, hits: v.array(v.object({ id: v.id("runtimeMemoryVectors"), score: v.number() })) },
  handler: async (ctx, args) => await new ConvexMemoryRepository(ctx, args.reference, args.capability).hydrateVectors(args.hits) });

const authorize = makeFunctionReference<"query", { requirement: RuntimeAuthorityRequirement }, RuntimeAuthority>("runtimeAuth:authorize") as unknown as
  FunctionReference<"query", "internal", { requirement: RuntimeAuthorityRequirement }, RuntimeAuthority>;
/** Inspect own data descriptors only; control failures never invoke diagnostic getters. */
function controlFields(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const fields: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string") return undefined;
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor) || !descriptor.enumerable) return undefined;
    fields[key] = descriptor.value;
  }
  return fields;
}

/** Full native authorization result is projected to its strictly smaller RPC reference. */
function memoryAuthorityReference(value: unknown): Readonly<RuntimeAuthorityReference> {
  const fields = controlFields(value);
  const required = ["principalId", "principalVersion", "membershipId", "membershipVersion",
    "grantId", "grantVersion", "tenantId", "tenantEpoch", "actorKind", "userId", "capabilities", "resourceAccess"];
  const optional = ["memorySpaceId", "memorySpaceEpoch"];
  if (!fields || required.some((key) => !Object.prototype.hasOwnProperty.call(fields, key))
    || Object.keys(fields).some((key) => !required.includes(key) && !optional.includes(key))) throw new Error();
  const stringField = (key: string): string => {
    const field = fields[key];
    if (typeof field !== "string" || !field) throw new Error();
    return field;
  };
  const versionField = (key: string): number => {
    const field = fields[key];
    if (typeof field !== "number" || !Number.isSafeInteger(field) || field < 1) throw new Error();
    return field;
  };
  if ((fields.actorKind !== "user" && fields.actorKind !== "service")
    || (fields.resourceAccess !== "own" && fields.resourceAccess !== "space" && fields.resourceAccess !== "tenant")
    || typeof fields.userId !== "string" || !fields.userId || !Array.isArray(fields.capabilities)) throw new Error();
  // No result metadata is forwarded; even its capability array must contain plain native values.
  if (Object.getPrototypeOf(fields.capabilities) !== Array.prototype) throw new Error();
  const capabilities = Object.getOwnPropertyDescriptors(fields.capabilities as object);
  const length = Object.getOwnPropertyDescriptor(fields.capabilities, "length");
  if (!length || !("value" in length) || typeof length.value !== "number" || !Number.isSafeInteger(length.value)
    || length.value < 0 || Reflect.ownKeys(capabilities).length !== length.value + 1) throw new Error();
  const allowed = ["read", "write", "run", "admin", "tool", "storage:read", "storage:write"];
  for (const key of Reflect.ownKeys(capabilities)) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key)) throw new Error();
    const descriptor = capabilities[key]!;
    if (!("value" in descriptor) || typeof descriptor.value !== "string" || !allowed.includes(descriptor.value)) throw new Error();
  }
  const reference: RuntimeAuthorityReference = {
    principalId: stringField("principalId"), principalVersion: versionField("principalVersion"),
    membershipId: stringField("membershipId"), membershipVersion: versionField("membershipVersion"),
    grantId: stringField("grantId"), grantVersion: versionField("grantVersion"),
    tenantId: stringField("tenantId"), tenantEpoch: versionField("tenantEpoch"),
    ...(Object.prototype.hasOwnProperty.call(fields, "memorySpaceId") ? { memorySpaceId: stringField("memorySpaceId") } : {}),
    ...(Object.prototype.hasOwnProperty.call(fields, "memorySpaceEpoch") ? { memorySpaceEpoch: versionField("memorySpaceEpoch") } : {}),
  };
  return Object.freeze(reference);
}

/** Only exact source-backed static control envelopes survive the foreground boundary. */
function foregroundControlFailure(error: unknown): never {
  let known: { code: string; message: string } | undefined;
  try {
    if (error !== null && typeof error === "object" && Object.getPrototypeOf(error) === ConvexError.prototype) {
      const errorDescriptors = Object.getOwnPropertyDescriptors(error);
      const allowedErrorKeys = ["name", "message", "stack", "data"];
      if (Reflect.ownKeys(errorDescriptors).some((key) => {
        if (typeof key === "symbol") return key !== Symbol.for("ConvexError");
        // Error.stack is a native lazy accessor in Node24; diagnostics are never read or forwarded.
        if (key === "stack" || key === "message") return false;
        return !allowedErrorKeys.includes(key) || !("value" in errorDescriptors[key]!);
      })) throw new Error();
      const descriptor = errorDescriptors.data;
      const fields = descriptor && "value" in descriptor ? controlFields(descriptor.value) : undefined;
      const keys = ["version", "code", "message", "retryable", "outcome"];
      if (fields && Object.keys(fields).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(fields, key))
        && fields.version === 1 && fields.retryable === false && fields.outcome === "not_dispatched") {
        const messages: Record<string, readonly string[]> = {
          UNAUTHENTICATED: ["Verified identity required"],
          FORBIDDEN: ["Access denied", "A concrete authorized memory space is required"],
          INVALID_INPUT: ["Invalid authority configuration"],
          AUTHORITY_LOOKUP_AMBIGUOUS: ["Authority lookup is ambiguous"],
          CAPABILITY_UNAVAILABLE: ["Memory capability unavailable."],
        };
        if (typeof fields.code === "string" && Object.prototype.hasOwnProperty.call(messages, fields.code)
          && typeof fields.message === "string" && messages[fields.code]!.includes(fields.message)) {
          known = { code: fields.code, message: fields.message };
        }
      }
    }
  } catch { /* Uninspectable control values stay opaque. */ }
  if (known) return memoryError(known.code, known.message);
  return memoryError("INTERNAL_FAILURE", "Memory control failed.");
}

/** Catch only pre-dispatch controls, never future functional or billable service failures. */
async function memoryForegroundControl(ctx: Pick<ActionCtx, "runQuery" | "runMutation" | "vectorSearch">,
  requirement: RuntimeAuthorityRequirement) {
  try {
    const authority = await ctx.runQuery(authorize, { requirement });
    const reference = memoryAuthorityReference(authority);
    if (requirement.capability !== "read" && requirement.capability !== "write") throw new Error();
    const controlCtx: Pick<ActionCtx, "runQuery" | "runMutation" | "vectorSearch"> = {
      runQuery: async (ref, args) => {
        const current = await ctx.runQuery(ref, args);
        // The repository discards this result; validate the native recheck reply before readiness.
        const currentReference = memoryAuthorityReference(current);
        if (Object.keys(reference).some((key) => currentReference[key as keyof RuntimeAuthorityReference]
          !== reference[key as keyof RuntimeAuthorityReference])) throw new Error();
        return current;
      },
      runMutation: ctx.runMutation.bind(ctx), vectorSearch: ctx.vectorSearch.bind(ctx),
    };
    const repository = createActionMemoryRepository(controlCtx, reference, requirement.capability);
    await repository.recheckAuthority();
    memoryError("CAPABILITY_UNAVAILABLE", "Memory capability unavailable.");
    return { authority, repository };
  } catch (error) { return foregroundControlFailure(error); }
}
const requestArgs = { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()), text: v.string(), requestId: v.string() };
export const remember = action({ args: requestArgs, handler: async (ctx, args) => {
  const { authority, repository } = await memoryForegroundControl(ctx, { capability: "write", tenantId: args.tenantId, memorySpaceId: args.memorySpaceId });
  return await rememberMemory({ repository, model: unconfiguredMemoryModel(), clock: { now: () => Date.now() } },
    { text: args.text, lineage: explicitSourceLineage(memoryScope(authority), args.requestId) });
} });
export const recall = action({ args: { ...requestArgs, limit: v.optional(v.number()) }, handler: async (ctx, args) => {
  const { authority } = await memoryForegroundControl(ctx, { capability: "read", tenantId: args.tenantId, memorySpaceId: args.memorySpaceId });
  return await recallMemory({ repository: createActionMemoryRepository(ctx, authority, "read"),
    model: unconfiguredMemoryModel(), clock: { now: () => Date.now() } }, { text: args.text, requestId: args.requestId, limit: args.limit ?? 10 });
} });
