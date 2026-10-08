/** Fixed administrative transport for the complete user-export protocol.
 * This transport is separate from the ordinary SDK identity/client.
 */
import { ConvexHttpClient } from "convex/browser";
import type { Id } from "../../convex-dev/_generated/dataModel";
import { convexToJson, jsonToConvex, type Value } from "convex/values";
import { createHash } from "crypto";

export const USER_EXPORT_DOMAINS = [
  "immutable",
  "mutable",
  "conversations",
  "memories",
  "facts",
  "factHistory",
  "contexts",
  "sessions",
  "artifacts",
  "attachments",
  "conversationShares",
  "conversationSnapshots",
  "memorySpaces",
  "agents",
  "governancePolicies",
  "governanceEnforcement",
  "graphSyncQueue",
] as const;
export type UserExportDomain = (typeof USER_EXPORT_DOMAINS)[number];
export type UserExportScope =
  | { kind: "tenantless" }
  | { kind: "tenant"; tenantId: string };
export type UserExportNode = {
  [D in UserExportDomain]: { domain: D; id: Id<D> };
}[UserExportDomain];
export type UserExportFileNode = Extract<
  UserExportNode,
  { domain: "artifacts" | "attachments" }
>;
export interface UserExportIdentity {
  userId: string;
  scope: UserExportScope;
}
export interface UserExportEdgeWitness {
  childNode: UserExportNode;
  childFingerprint: string;
  kind: string;
  ordinal: number;
  parentNode?: UserExportNode;
  parentFingerprint?: string;
  status: "admissible" | "foreignOwner" | "missing" | "unresolved";
  observationTime: number;
}
export interface UserExportProjection {
  node: UserExportNode;
  fingerprint?: string;
  logicalId?: string;
  memorySpaceId?: string;
  disposition:
    | "root"
    | "unownedCandidate"
    | "membershipProjection"
    | "excluded";
  rootReason?: string;
  edgeDescriptors: {
    ordinal: number;
    kind: string;
    domain: UserExportDomain;
    purpose: "inclusion" | "support" | "reference" | "legacy";
    storedLogicalTarget?: string;
    storedDocumentTarget?: string;
    unresolved?: boolean;
  }[];
}
interface Envelope extends UserExportIdentity {
  protocolVersion: 1;
  observationTime: number;
}
export interface UserExportInspectResponse extends Envelope {
  kind: "inspect";
  capability: "transport-only" | "complete-export";
  supportedDomains: UserExportDomain[];
  profile: UserExportNode | null;
}
export interface UserExportPageResponse extends Envelope {
  kind: "page";
  page: UserExportProjection[];
  continueCursor: string;
  isDone: boolean;
  pageStatus?: "SplitRequired" | "SplitRecommended" | null;
  splitCursor?: string | null;
}
export interface UserExportEdgeResponse extends Envelope {
  kind: "edge";
  witness: UserExportEdgeWitness;
}
export interface UserExportNodeResponse extends Envelope {
  kind: "node";
  node: UserExportNode;
  fingerprint: string;
  disposition: "record" | "membershipProjection";
  record: Value;
}
export interface UserExportFileResponse extends Envelope {
  kind: "file";
  node: UserExportFileNode;
  fingerprint: string;
  file: {
    storageId: Id<"_storage">;
    url: string;
    size: number;
    mimeType: string;
    sha256: string;
    version?: number;
  };
}
export interface UserExportCallOptions {
  signal?: AbortSignal;
}
export interface UserExportTransportOptions {
  url: string;
  deploymentKey: string;
  timeoutMs?: number;
}
export interface UserExportPageRequest extends UserExportIdentity {
  selection: {
    kind: "rootProjections" | "closureProjections";
    domain: UserExportDomain;
  };
  cursor: string | null;
  endCursor?: string | null;
  numItems: number;
}
export interface UserExportEdgeRequest extends UserExportIdentity {
  node: UserExportNode;
  edgeOrdinal: number;
  expectedFingerprint: string;
}
export interface UserExportNodeRequest extends UserExportIdentity {
  node: UserExportNode;
  expectedFingerprint: string;
  witness?: UserExportEdgeWitness;
}
export interface UserExportFileRequest
  extends Omit<UserExportNodeRequest, "node"> {
  node: UserExportFileNode;
  version?: number;
}
export interface UserExportTransport {
  inspect(
    request: UserExportIdentity,
    options?: UserExportCallOptions,
  ): Promise<UserExportInspectResponse>;
  page(
    request: UserExportPageRequest,
    options?: UserExportCallOptions,
  ): Promise<UserExportPageResponse>;
  inspectEdge(
    request: UserExportEdgeRequest,
    options?: UserExportCallOptions,
  ): Promise<UserExportEdgeResponse>;
  readNode(
    request: UserExportNodeRequest,
    options?: UserExportCallOptions,
  ): Promise<UserExportNodeResponse>;
  resolveFile(
    request: UserExportFileRequest,
    options?: UserExportCallOptions,
  ): Promise<UserExportFileResponse>;
}
type Operation = keyof UserExportTransport;
const FUNCTIONS: Record<Operation, string> = {
  inspect: "userExport:inspect",
  page: "userExport:page",
  inspectEdge: "userExport:inspectEdge",
  readNode: "userExport:readNode",
  resolveFile: "userExport:resolveFile",
};
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024 + 64 * 1024;
const MAX_REQUEST_BYTES = 64 * 1024;
const _CODES = [
  "EXPORT_AUTHORIZATION",
  "EXPORT_PROTOCOL",
  "EXPORT_CANCELLED",
  "EXPORT_DEADLINE",
  "EXPORT_TRANSPORT",
  "EXPORT_STAGE_UNIMPLEMENTED",
  "EXPORT_RESPONSE_TOO_LARGE",
  "EXPORT_REQUEST_TOO_LARGE",
  "EXPORT_CHANGED",
  "EXPORT_SCOPE",
  "EXPORT_INELIGIBLE",
  "EXPORT_REFERENCE_AMBIGUOUS",
  "EXPORT_PROFILE_NOT_FOUND",
  "EXPORT_PROFILE_AMBIGUOUS",
  "EXPORT_BUDGET",
  "EXPORT_FILE_METADATA",
  "FACT_HISTORY_PROVENANCE_UNRESOLVED",
] as const;
export class UserExportTransportError extends Error {
  constructor(
    readonly code: (typeof _CODES)[number],
    readonly stage: Operation | "serialize",
  ) {
    super(`${code} at ${stage}`);
    this.name = "UserExportTransportError";
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function node(value: unknown): value is UserExportNode {
  return (
    object(value) &&
    typeof value.domain === "string" &&
    USER_EXPORT_DOMAINS.some((d) => d === value.domain) &&
    typeof value.id === "string" &&
    value.id.length > 0
  );
}
function fingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function scope(value: unknown): value is UserExportScope {
  return (
    object(value) &&
    (value.kind === "tenantless"
      ? Object.keys(value).length === 1
      : value.kind === "tenant" &&
        typeof value.tenantId === "string" &&
        value.tenantId.trim().length > 0 &&
        Object.keys(value).length === 2)
  );
}
function witness(value: unknown): value is UserExportEdgeWitness {
  return (
    object(value) &&
    node(value.childNode) &&
    fingerprint(value.childFingerprint) &&
    typeof value.kind === "string" &&
    value.kind.length > 0 &&
    Number.isInteger(value.ordinal) &&
    Number(value.ordinal) >= 0 &&
    finite(value.observationTime) &&
    ["admissible", "foreignOwner", "missing", "unresolved"].includes(
      String(value.status),
    ) &&
    (value.parentNode === undefined || node(value.parentNode)) &&
    (value.parentFingerprint === undefined ||
      fingerprint(value.parentFingerprint)) &&
    (value.status !== "admissible" ||
      (node(value.parentNode) && fingerprint(value.parentFingerprint)))
  );
}
function validRequest(
  operation: Operation,
  value: unknown,
): value is UserExportIdentity & Record<string, unknown> {
  if (
    !object(value) ||
    typeof value.userId !== "string" ||
    !value.userId.trim() ||
    !scope(value.scope)
  )
    return false;
  const allowed = [
    "userId",
    "scope",
    ...(operation === "page"
      ? ["selection", "cursor", "endCursor", "numItems"]
      : operation === "inspectEdge"
        ? ["node", "edgeOrdinal", "expectedFingerprint"]
        : operation === "readNode"
          ? ["node", "expectedFingerprint", "witness"]
          : operation === "resolveFile"
            ? ["node", "expectedFingerprint", "witness", "version"]
            : []),
  ];
  if (Object.keys(value).some((k) => !allowed.includes(k))) return false;
  if (operation === "inspect") return true;
  if (operation === "page")
    return (
      object(value.selection) &&
      ["rootProjections", "closureProjections"].includes(
        String(value.selection.kind),
      ) &&
      USER_EXPORT_DOMAINS.some(
        (d) => d === (value.selection as Record<string, unknown>).domain,
      ) &&
      Number.isInteger(value.numItems) &&
      Number(value.numItems) >= 1 &&
      Number(value.numItems) <= 100 &&
      (value.cursor === null || typeof value.cursor === "string") &&
      (value.endCursor === undefined ||
        value.endCursor === null ||
        typeof value.endCursor === "string")
    );
  if (!node(value.node) || !fingerprint(value.expectedFingerprint))
    return false;
  if (operation === "inspectEdge")
    return (
      Number.isInteger(value.edgeOrdinal) && Number(value.edgeOrdinal) >= 0
    );
  if (value.witness !== undefined && !witness(value.witness)) return false;
  return (
    operation !== "resolveFile" ||
    (["attachments", "artifacts"].includes(value.node.domain) &&
      (value.version === undefined ||
        (Number.isInteger(value.version) && Number(value.version) >= 1)))
  );
}
function validateResponse(
  operation: Operation,
  request: UserExportIdentity,
  value: unknown,
): void {
  const bad = () => {
    throw new UserExportTransportError("EXPORT_PROTOCOL", operation);
  };
  if (
    !object(value) ||
    value.protocolVersion !== 1 ||
    value.userId !== request.userId ||
    !scope(value.scope) ||
    value.scope.kind !== request.scope.kind ||
    (value.scope.kind === "tenant" &&
      request.scope.kind === "tenant" &&
      value.scope.tenantId !== request.scope.tenantId) ||
    !finite(value.observationTime)
  )
    return bad();
  if (operation === "inspect") {
    if (
      value.kind !== "inspect" ||
      !["transport-only", "complete-export"].includes(
        String(value.capability),
      ) ||
      !Array.isArray(value.supportedDomains) ||
      value.supportedDomains.length !== USER_EXPORT_DOMAINS.length ||
      !USER_EXPORT_DOMAINS.every((d) =>
        (value.supportedDomains as unknown[]).includes(d),
      ) ||
      (value.profile !== null && !node(value.profile))
    )
      bad();
  } else if (operation === "page") {
    if (
      value.kind !== "page" ||
      !Array.isArray(value.page) ||
      typeof value.continueCursor !== "string" ||
      typeof value.isDone !== "boolean" ||
      ![undefined, null, "SplitRequired", "SplitRecommended"].includes(
        value.pageStatus as
          | null
          | undefined
          | "SplitRequired"
          | "SplitRecommended",
      ) ||
      (value.splitCursor !== undefined &&
        value.splitCursor !== null &&
        typeof value.splitCursor !== "string")
    )
      return bad();
    for (const p of value.page)
      if (
        !object(p) ||
        !node(p.node) ||
        ![
          "root",
          "unownedCandidate",
          "membershipProjection",
          "excluded",
        ].includes(String(p.disposition)) ||
        (p.fingerprint !== undefined && !fingerprint(p.fingerprint)) ||
        !Array.isArray(p.edgeDescriptors) ||
        p.edgeDescriptors.some(
          (e) =>
            !object(e) ||
            !Number.isInteger(e.ordinal) ||
            Number(e.ordinal) < 0 ||
            typeof e.kind !== "string" ||
            !USER_EXPORT_DOMAINS.includes(e.domain as UserExportDomain) ||
            !["inclusion", "support", "reference", "legacy"].includes(
              String(e.purpose),
            ),
        )
      )
        bad();
  } else if (operation === "inspectEdge") {
    if (value.kind !== "edge" || !witness(value.witness)) bad();
  } else if (operation === "readNode") {
    if (
      value.kind !== "node" ||
      !node(value.node) ||
      !fingerprint(value.fingerprint) ||
      !["record", "membershipProjection"].includes(String(value.disposition)) ||
      !("record" in value)
    )
      bad();
  } else if (
    value.kind !== "file" ||
    !node(value.node) ||
    !["attachments", "artifacts"].includes(value.node.domain) ||
    !fingerprint(value.fingerprint) ||
    !object(value.file) ||
    typeof value.file.storageId !== "string" ||
    typeof value.file.url !== "string" ||
    !finite(value.file.size) ||
    value.file.size < 0 ||
    !Number.isInteger(value.file.size) ||
    typeof value.file.mimeType !== "string" ||
    !fingerprint(value.file.sha256)
  )
    bad();
}
/** Only explicit deployment administration; never uses actingAsIdentity or ordinary SDK auth. */
export function createUserExportTransport(
  options: UserExportTransportOptions,
): UserExportTransport {
  const invalid = () => {
    throw new UserExportTransportError("EXPORT_PROTOCOL", "inspect");
  };
  if (
    typeof options.url !== "string" ||
    typeof options.deploymentKey !== "string" ||
    !options.deploymentKey.trim()
  )
    invalid();
  let url: URL;
  try {
    url = new URL(options.url);
  } catch {
    return invalid();
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  )
    invalid();
  const timeout = options.timeoutMs ?? 30000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 30000) invalid();
  async function call(
    operation: Operation,
    request: unknown,
    callOptions: UserExportCallOptions = {},
  ): Promise<unknown> {
    if (!validRequest(operation, request))
      throw new UserExportTransportError("EXPORT_PROTOCOL", operation);
    const controller = new AbortController();
    const deadline = { expired: false };
    const cancel = () => controller.abort();
    if (callOptions.signal?.aborted)
      throw new UserExportTransportError("EXPORT_CANCELLED", operation);
    callOptions.signal?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(() => {
      deadline.expired = true;
      controller.abort();
    }, timeout);
    try {
      const guardedFetch: typeof fetch = async (input, init) => {
        if (
          new TextEncoder().encode(String(init?.body ?? "")).byteLength >
          MAX_REQUEST_BYTES
        )
          throw new UserExportTransportError(
            "EXPORT_REQUEST_TOO_LARGE",
            operation,
          );
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
          redirect: "error",
        });
        const reader = response.body?.getReader();
        if (!reader)
          throw new UserExportTransportError("EXPORT_PROTOCOL", operation);
        const chunks: Uint8Array[] = [];
        let size = 0;
        let bodyComplete = false;
        try {
          for (;;) {
            const item = await reader.read();
            if (item.done) {
              bodyComplete = true;
              break;
            }
            size += item.value.byteLength;
            if (size > MAX_RESPONSE_BYTES)
              throw new UserExportTransportError(
                "EXPORT_RESPONSE_TOO_LARGE",
                operation,
              );
            chunks.push(item.value);
          }
        } finally {
          if (!bodyComplete) controller.abort();
          await cancelExportReader(reader, operation, controller.signal.aborted);
        }
        if (response.status === 401 || response.status === 403)
          throw new UserExportTransportError("EXPORT_AUTHORIZATION", operation);
        const body = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          body.set(chunk, offset);
          offset += chunk.length;
        }
        return new Response(body, {
          status: response.status,
          headers: response.headers,
        });
      };
      const client: unknown = new ConvexHttpClient(url.origin, {
        logger: false,
        skipConvexDeploymentUrlCheck: true,
        fetch: guardedFetch,
      });
      // Internal methods are runtime capabilities; keep their structural boundary here.
      if (
        !object(client) ||
        typeof client.setAdminAuth !== "function" ||
        typeof client.function !== "function"
      )
        throw new UserExportTransportError("EXPORT_TRANSPORT", operation);
      const internal = client as unknown as {
        setAdminAuth(key: string): void;
        function(
          name: string,
          component: undefined,
          args: Record<string, unknown>,
        ): Promise<unknown>;
      };
      internal.setAdminAuth(options.deploymentKey);
      const result = await internal.function(
        FUNCTIONS[operation],
        undefined,
        request,
      );
      if (deadline.expired || callOptions.signal?.aborted)
        throw new UserExportTransportError(
          deadline.expired ? "EXPORT_DEADLINE" : "EXPORT_CANCELLED",
          operation,
        );
      validateResponse(operation, request, result);
      return result;
    } catch (error) {
      if (deadline.expired || callOptions.signal?.aborted)
        throw new UserExportTransportError(
          deadline.expired ? "EXPORT_DEADLINE" : "EXPORT_CANCELLED",
          operation,
        );
      if (error instanceof UserExportTransportError) throw error;
      const code =
        object(error) && object(error.data) ? error.data.code : undefined;
      if (typeof code === "string" && _CODES.some((known) => known === code))
        throw new UserExportTransportError(
          code as (typeof _CODES)[number],
          operation,
        );
      throw new UserExportTransportError("EXPORT_TRANSPORT", operation);
    } finally {
      clearTimeout(timer);
      callOptions.signal?.removeEventListener("abort", cancel);
    }
  }
  const transport: UserExportTransport = {
    inspect: (r, o) =>
      call("inspect", r, o) as Promise<UserExportInspectResponse>,
    page: (r, o) => call("page", r, o) as Promise<UserExportPageResponse>,
    inspectEdge: (r, o) =>
      call("inspectEdge", r, o) as Promise<UserExportEdgeResponse>,
    readNode: (r, o) =>
      call("readNode", r, o) as Promise<UserExportNodeResponse>,
    resolveFile: (r, o) =>
      call("resolveFile", r, o) as Promise<UserExportFileResponse>,
  };
  return Object.freeze(transport);
}

export interface UserExportReachableNode {
  projection: UserExportProjection;
  spanningWitness?: UserExportEdgeWitness;
  supportWitness?: UserExportEdgeWitness;
  reverseFactWitness?: UserExportEdgeWitness;
}
export interface UserExportClosure {
  identity: UserExportIdentity;
  inspect: UserExportInspectResponse;
  reachable: UserExportReachableNode[];
  witnesses: UserExportEdgeWitness[];
  diagnostics: UserExportEdgeWitness[];
  projectionCount: number;
  pageCount: number;
  pageObservations: {
    domain: UserExportDomain;
    selection: "rootProjections" | "closureProjections";
    observationTime: number;
  }[];
}
/** Defensive scope selection only; not authentication. */
export function resolveUserExportIdentity(
  userId: string,
  tenantId?: string,
  contextTenantId?: string,
): UserExportIdentity {
  if (
    typeof userId !== "string" ||
    !userId.trim() ||
    [tenantId, contextTenantId].some(
      (x) => x !== undefined && (typeof x !== "string" || !x.trim()),
    )
  )
    throw new UserExportTransportError("EXPORT_PROTOCOL", "inspect");
  if (
    tenantId !== undefined &&
    contextTenantId !== undefined &&
    tenantId !== contextTenantId
  )
    throw new UserExportTransportError("EXPORT_SCOPE", "inspect");
  const selected = tenantId ?? contextTenantId;
  return {
    userId,
    scope:
      selected === undefined
        ? { kind: "tenantless" }
        : { kind: "tenant", tenantId: selected },
  };
}
function nodeKey(value: UserExportNode) {
  return value.domain + ":" + value.id;
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (object(value))
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + stable(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
function checkCancellation(options: UserExportCallOptions) {
  if (options.signal?.aborted)
    throw new UserExportTransportError("EXPORT_CANCELLED", "page");
}
async function cancelExportReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  operation: Operation,
  aborted: boolean,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // An already-aborted native fetch may reject cancellation with AbortError.
    // Every other rejection or unsettled cancellation is incomplete cleanup.
    await Promise.race([
      reader.cancel().catch((error: unknown) => {
        if (aborted && object(error) && error.name === "AbortError") return;
        throw new UserExportTransportError("EXPORT_TRANSPORT", operation);
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new UserExportTransportError("EXPORT_DEADLINE", operation)),
          1000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
/** Projection selection only. Does not read payloads/download files or complete an export. */
export async function discoverUserExportClosure(
  transport: UserExportTransport,
  selected: UserExportIdentity,
  options: UserExportCallOptions & { pageSize?: number } = {},
): Promise<UserExportClosure> {
  if (!validRequest("inspect", selected))
    throw new UserExportTransportError("EXPORT_PROTOCOL", "inspect");
  const identity: UserExportIdentity = {
    userId: selected.userId,
    scope:
      selected.scope.kind === "tenantless"
        ? { kind: "tenantless" }
        : { kind: "tenant", tenantId: selected.scope.tenantId },
  };
  checkCancellation(options);
  const inspected = await transport.inspect(identity, options);
  validateResponse("inspect", identity, inspected);
  if (!inspected.profile)
    throw new UserExportTransportError("EXPORT_STAGE_UNIMPLEMENTED", "inspect");
  const projections = new Map<string, UserExportProjection>();
  let pageCount = 0;
  const pageObservations: UserExportClosure["pageObservations"] = [];
  for (const domain of USER_EXPORT_DOMAINS)
    for (const kind of ["rootProjections", "closureProjections"] as const) {
      const ranges: {
          cursor: string | null;
          endCursor: string | null;
          depth: number;
        }[] = [{ cursor: null, endCursor: null, depth: 0 }],
        requested = new Set<string>();
      while (ranges.length) {
        const range = ranges.shift()!;
        checkCancellation(options);
        const state = stable([range.cursor, range.endCursor]);
        if (requested.has(state) || range.depth > 64)
          throw new UserExportTransportError("EXPORT_PROTOCOL", "page");
        requested.add(state);
        const request = {
          ...identity,
          selection: { kind, domain },
          cursor: range.cursor,
          endCursor: range.endCursor,
          numItems: options.pageSize ?? 100,
        };
        const page = await transport.page(request, options);
        validateResponse("page", request, page);
        pageCount++;
        pageObservations.push({
          domain,
          selection: kind,
          observationTime: page.observationTime,
        });
        if (
          page.pageStatus === "SplitRequired" ||
          (page.pageStatus === "SplitRecommended" &&
            page.splitCursor !== null &&
            page.splitCursor !== undefined)
        ) {
          const split = page.splitCursor,
            continuation = page.continueCursor;
          if (
            !split ||
            split === range.cursor ||
            split === range.endCursor ||
            split === continuation ||
            !continuation ||
            continuation === range.cursor
          )
            throw new UserExportTransportError("EXPORT_PROTOCOL", "page");
          const children: typeof ranges = [
            { cursor: range.cursor, endCursor: split, depth: range.depth + 1 },
            { cursor: split, endCursor: continuation, depth: range.depth + 1 },
          ];
          if (
            !page.isDone &&
            (range.endCursor === null ||
              page.continueCursor !== range.endCursor)
          )
            children.push({
              cursor: continuation,
              endCursor: range.endCursor,
              depth: range.depth,
            });
          ranges.unshift(...children);
          continue;
        }
        for (const projection of page.page) {
          if (
            projection.node.domain !== domain ||
            (projection.disposition !== "excluded" &&
              !projection.fingerprint) ||
            projection.edgeDescriptors.some(
              (edge, index) => edge.ordinal !== index,
            )
          )
            throw new UserExportTransportError("EXPORT_PROTOCOL", "page");
          const previous = projections.get(nodeKey(projection.node));
          if (previous && stable(previous) !== stable(projection))
            throw new UserExportTransportError("EXPORT_CHANGED", "page");
          projections.set(nodeKey(projection.node), projection);
        }
        // Native bounded ranges can exhaust at their end while global isDone stays false.
        if (
          !page.isDone &&
          (range.endCursor === null || page.continueCursor !== range.endCursor)
        ) {
          if (!page.continueCursor || page.continueCursor === range.cursor)
            throw new UserExportTransportError("EXPORT_PROTOCOL", "page");
          ranges.unshift({ ...range, cursor: page.continueCursor });
        }
      }
    }
  const ordered = [...projections.values()].sort(
    (a, b) =>
      USER_EXPORT_DOMAINS.indexOf(a.node.domain) -
        USER_EXPORT_DOMAINS.indexOf(b.node.domain) ||
      (a.node.id < b.node.id ? -1 : a.node.id > b.node.id ? 1 : 0),
  );
  const profiles = ordered.filter((p) => p.rootReason === "scopedProfile");
  if (
    profiles.length !== 1 ||
    nodeKey(profiles[0].node) !== nodeKey(inspected.profile)
  )
    throw new UserExportTransportError("EXPORT_CHANGED", "inspect");
  type Entry = {
    projection: UserExportProjection;
    descriptor: UserExportProjection["edgeDescriptors"][number];
    rank: number;
    witness?: UserExportEdgeWitness;
    waiting?: boolean;
  };
  const entries: Entry[] = [];
  const outgoing = new Map<string, Entry[]>();
  // JSON tuples keep arbitrary stored IDs collision-safe. Space is a separate map key.
  const dependencies = new Map<string, Map<string | undefined, Entry[]>>();
  const waitingForParent = new Map<string, Entry[]>();
  const reachable = new Map<string, UserExportReachableNode>();
  const frontier: UserExportProjection[] = [];
  let localWork = 0;
  async function checkpoint() {
    checkCancellation(options);
    if (++localWork % 128 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      checkCancellation(options);
    }
  }
  for (const projection of ordered) {
    await checkpoint();
    const childKey = nodeKey(projection.node);
    if (
      projection.disposition === "root" ||
      projection.disposition === "membershipProjection"
    ) {
      reachable.set(childKey, { projection });
      frontier.push(projection);
    }
    if (projection.disposition === "excluded") continue;
    const childSpace = projection.memorySpaceId;
    const children: Entry[] = [];
    for (const descriptor of [...projection.edgeDescriptors].sort(
      (a, b) =>
        (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0) ||
        a.ordinal - b.ordinal,
    )) {
      await checkpoint();
      const entry = { projection, descriptor, rank: entries.length };
      entries.push(entry);
      children.push(entry);
      if (!["inclusion", "legacy"].includes(descriptor.purpose)) continue;
      const physical = descriptor.storedDocumentTarget;
      const logical = descriptor.storedLogicalTarget;
      if (!physical && logical === undefined) continue;
      const target = JSON.stringify([
        physical ? "physical" : "logical",
        descriptor.domain,
        physical || logical,
      ]);
      let spaces = dependencies.get(target);
      if (!spaces) dependencies.set(target, (spaces = new Map()));
      let bucket = spaces.get(childSpace);
      if (!bucket) spaces.set(childSpace, (bucket = []));
      bucket.push(entry);
    }
    outgoing.set(childKey, children);
  }
  const visited = new Set<string>();
  for (let head = 0; head < frontier.length; head++) {
    await checkpoint();
    const rooted = frontier[head];
    const rootedKey = nodeKey(rooted.node);
    if (visited.has(rootedKey)) continue;
    visited.add(rootedKey);
    const candidates = new Set(outgoing.get(rootedKey) ?? []);
    for (const entry of waitingForParent.get(rootedKey) ?? []) {
      await checkpoint();
      entry.waiting = false;
      candidates.add(entry);
    }
    waitingForParent.delete(rootedKey);
    const logical = rooted.logicalId;
    const space = rooted.memorySpaceId;
    for (const target of [
      JSON.stringify(["physical", rooted.node.domain, rooted.node.id]),
      ...(logical === undefined
        ? []
        : [JSON.stringify(["logical", rooted.node.domain, logical])]),
    ]) {
      const spaces = dependencies.get(target);
      if (!spaces) continue;
      // Each matching partition is drained once, including wildcard child spaces.
      const selectedSpaces =
        space === undefined ? [...spaces.keys()] : [space, undefined];
      for (const selectedSpace of selectedSpaces) {
        const bucket = spaces.get(selectedSpace);
        if (!bucket) continue;
        spaces.delete(selectedSpace);
        for (const entry of bucket) {
          await checkpoint();
          candidates.add(entry);
        }
      }
      if (!spaces.size) dependencies.delete(target);
    }
    for (const entry of [...candidates].sort((a, b) => a.rank - b.rank)) {
      await checkpoint();
      const { projection, descriptor } = entry;
      if (!entry.witness) {
        const request = {
          ...identity,
          node: projection.node,
          expectedFingerprint: projection.fingerprint!,
          edgeOrdinal: descriptor.ordinal,
        };
        const response = await transport.inspectEdge(request, options);
        validateResponse("inspectEdge", request, response);
        const witness = response.witness;
        if (
          nodeKey(witness.childNode) !== nodeKey(projection.node) ||
          witness.childFingerprint !== projection.fingerprint ||
          witness.ordinal !== descriptor.ordinal ||
          witness.kind !== descriptor.kind ||
          (witness.parentNode &&
            witness.parentNode.domain !== descriptor.domain)
        )
          throw new UserExportTransportError("EXPORT_PROTOCOL", "inspectEdge");
        if (witness.parentNode) {
          const parent = projections.get(nodeKey(witness.parentNode));
          if (
            !parent ||
            parent.disposition === "excluded" ||
            parent.fingerprint !== witness.parentFingerprint
          )
            throw new UserExportTransportError("EXPORT_CHANGED", "inspectEdge");
        }
        entry.witness = witness;
        // A descriptor is scheduled only by a rooted child or a matching rooted parent.
        if (witness.status === "unresolved")
          throw new UserExportTransportError(
            "FACT_HISTORY_PROVENANCE_UNRESOLVED",
            "inspectEdge",
          );
      }
      const witness = entry.witness;
      if (witness.status !== "admissible" || !witness.parentNode) continue;
      const childRooted = reachable.has(nodeKey(projection.node));
      const parentKey = nodeKey(witness.parentNode);
      const parentRooted = reachable.has(parentKey);
      const support = descriptor.purpose === "support";
      const reverseFact =
        projection.node.domain === "facts" &&
        descriptor.purpose === "inclusion" &&
        ["physicalFact:supersedes", "physicalFact:supersededBy"].includes(
          descriptor.kind,
        ) &&
        childRooted &&
        !parentRooted;
      if (!support && descriptor.purpose !== "inclusion") continue;
      if (support || reverseFact ? !childRooted : !parentRooted) {
        if (!support && !parentRooted && !entry.waiting) {
          let bucket = waitingForParent.get(parentKey);
          if (!bucket) waitingForParent.set(parentKey, (bucket = []));
          bucket.push(entry);
          entry.waiting = true;
        }
        continue;
      }
      const target =
        support || reverseFact ? witness.parentNode : witness.childNode;
      if (support && target.domain !== "memorySpaces")
        throw new UserExportTransportError("EXPORT_PROTOCOL", "inspectEdge");
      const targetKey = nodeKey(target);
      if (!reachable.has(targetKey)) {
        const projection = projections.get(targetKey)!;
        reachable.set(targetKey, {
          projection,
          ...(support
            ? { supportWitness: witness }
            : reverseFact
              ? { reverseFactWitness: witness }
              : { spanningWitness: witness }),
        });
        frontier.push(projection);
      }
    }
  }
  const edges = entries
    .filter(
      (entry): entry is Entry & { witness: UserExportEdgeWitness } =>
        !!entry.witness,
    )
    .map(({ descriptor, witness }) => ({ descriptor, witness }));
  const rootedSpaces = new Set(
    [...reachable.values()]
      .map((x) => x.projection.memorySpaceId)
      .filter((x): x is string => typeof x === "string"),
  );
  for (const projection of ordered)
    if (
      projection.rootReason === "legacyActorProvenanceUnresolved" ||
      (projection.rootReason === "legacyProvenanceUnresolved" &&
        projection.memorySpaceId &&
        rootedSpaces.has(projection.memorySpaceId))
    )
      throw new UserExportTransportError(
        "FACT_HISTORY_PROVENANCE_UNRESOLVED",
        "page",
      );
  for (const edge of edges)
    if (
      edge.witness.status === "unresolved" &&
      (reachable.has(nodeKey(edge.witness.childNode)) ||
        (edge.witness.parentNode &&
          reachable.has(nodeKey(edge.witness.parentNode))))
    )
      throw new UserExportTransportError(
        "FACT_HISTORY_PROVENANCE_UNRESOLVED",
        "inspectEdge",
      );
  return {
    identity,
    inspect: inspected,
    reachable: ordered
      .filter((p) => reachable.has(nodeKey(p.node)))
      .map((p) => reachable.get(nodeKey(p.node))!),
    witnesses: edges
      .filter(
        (e) =>
          e.witness.status === "admissible" &&
          reachable.has(nodeKey(e.witness.childNode)) &&
          e.witness.parentNode &&
          reachable.has(nodeKey(e.witness.parentNode)),
      )
      .map((e) => e.witness),
    diagnostics: edges
      .filter((e) => e.witness.status !== "admissible")
      .map((e) => e.witness),
    projectionCount: projections.size,
    pageCount,
    pageObservations,
  };
}

/** Complete supported data is emitted only as a terminally validated versioned stream. */
export interface UserExportDataOptions extends UserExportCallOptions {
  transport: UserExportTransport;
  tenantId?: string;
  pageSize?: number;
}
export interface UserExportBlob {
  storageId: string;
  size: number;
  mimeType: string;
  sha256: string;
  referrers: { node: UserExportNode; version?: number }[];
}
export type UserExportEvent =
  | {
      type: "header";
      format: "cortex-user-export";
      version: 1;
      identity: UserExportIdentity;
      consistency: "rolling-read";
      startedAt: number;
    }
  | {
      type: "record";
      node: UserExportNode;
      fingerprint: string;
      disposition: "record" | "membershipProjection";
      record: ReturnType<typeof convexToJson>;
    }
  | ({ type: "blob" } & UserExportBlob)
  | {
      type: "chunk";
      storageId: string;
      sequence: number;
      byteLength: number;
      data: string;
    }
  | {
      type: "blobEnd";
      storageId: string;
      chunks: number;
      size: number;
      sha256: string;
    }
  | {
      type: "manifest";
      version: 1;
      complete: true;
      identity: UserExportIdentity;
      consistency: "rolling-read";
      startedAt: number;
      endedAt: number;
      tableManifest: {
        domain: UserExportDomain;
        records: number;
        projections: number;
        pages: number;
      }[];
      pageCount: number;
      projectionCount: number;
      pageObservations: UserExportClosure["pageObservations"];
      blobs: UserExportBlob[];
      diagnostics: UserExportEdgeWitness[];
      exclusions: string[];
    };
export const USER_EXPORT_EXCLUSIONS = [
  "operationalRegistries:agents,governancePolicies,governanceEnforcement,graphSyncQueue",
  "externalDerivedGraphs",
  "customApplicationTables",
  "deploymentConfigurationAndCredentials",
  "purgedRecordsAndPurgedHistory",
  "foreignOwnershipAndDisconnectedUnownedComponents",
  "incomingShareSourceContentAndEditorViewerArtifactContent",
] as const;
/** Canonical version1 JSON text for an already encoded export event.
 * Persist this text for matching TypeScript/Python double and string formatting.
 * Object keys use UTF-16 order, including numeric-looking keys; arrays retain
 * their stored order. Official Convex tags are validated and preserved. This
 * does not alter raw events or backend change-detection fingerprints, append a
 * newline, or certify completion before the validated terminal manifest.
 */
export function serializeUserExportEvent(event: UserExportEvent): string {
  const active = new Set<object>();
  function emit(value: unknown): string {
    if (value === null) return "null";
    if (typeof value === "boolean" || typeof value === "string")
      return JSON.stringify(value);
    if (typeof value === "number") {
      if (!Number.isFinite(value) || Object.is(value, -0))
        throw new Error("a special Convex float requires its official tag");
      return JSON.stringify(value);
    }
    if (
      typeof value !== "object" ||
      active.has(value) ||
      (!Array.isArray(value) &&
        Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null)
    )
      throw new Error("unsupported or cyclic export value");
    active.add(value);
    try {
      if (Array.isArray(value)) {
        // Array holes cannot silently become null in the canonical format.
        if (
          Object.keys(value).length !== value.length ||
          Object.getOwnPropertySymbols(value).length
        )
          throw new Error("unsupported export array property");
        const parts: string[] = [];
        for (let index = 0; index < value.length; index++) {
          if (!Object.hasOwn(value, index)) throw new Error("sparse export array");
          parts.push(emit(value[index]));
        }
        return "[" + parts.join(",") + "]";
      }
      const row = value as Record<string, unknown>;
      const keys = Object.keys(row).sort();
      if (Object.getOwnPropertySymbols(row).length)
        throw new Error("unsupported export object key");
      if (keys.some((key) => key.startsWith("$"))) {
        const tagValue = row[keys[0]];
        if (
          keys.length !== 1 ||
          !["$integer", "$bytes", "$float"].includes(keys[0]) ||
          typeof tagValue !== "string" ||
          JSON.stringify(convexToJson(jsonToConvex({ [keys[0]]: tagValue }))) !==
            JSON.stringify(row)
        )
          throw new Error("invalid or noncanonical Convex tag");
      }
      return (
        "{" +
        keys.map((key) => JSON.stringify(key) + ":" + emit(row[key])).join(",") +
        "}"
      );
    } finally {
      active.delete(value);
    }
  }
  try {
    if (
      !object(event) ||
      !["header", "record", "blob", "chunk", "blobEnd", "manifest"].includes(
        String(event.type),
      )
    )
      throw new Error("invalid export event");
    return emit(event);
  } catch {
    throw new UserExportTransportError("EXPORT_PROTOCOL", "serialize");
  }
}
/** Sort object keys after the official Convex codec; never alter array order or tags. */
export function canonicalUserExportValue(
  value: Value,
): ReturnType<typeof convexToJson> {
  const sort = (x: unknown): unknown =>
    Array.isArray(x)
      ? x.map(sort)
      : object(x)
        ? Object.fromEntries(
            Object.keys(x)
              .sort()
              .map((k) => [k, sort(x[k])]),
          )
        : x;
  try {
    return sort(convexToJson(value)) as ReturnType<typeof convexToJson>;
  } catch {
    throw new UserExportTransportError("EXPORT_PROTOCOL", "readNode");
  }
}
function releaseRequest(
  identity: UserExportIdentity,
  item: UserExportReachableNode,
): UserExportNodeRequest {
  const selectedWitness =
    item.spanningWitness ?? item.supportWitness ?? item.reverseFactWitness;
  return {
    ...identity,
    node: item.projection.node,
    expectedFingerprint: item.projection.fingerprint!,
    ...(selectedWitness ? { witness: selectedWitness } : {}),
  };
}
function sameWitness(a: UserExportEdgeWitness, b: UserExportEdgeWitness) {
  const { observationTime: _a, ...left } = a;
  const { observationTime: _b, ...right } = b;
  return (
    JSON.stringify(canonicalUserExportValue(left as Value)) ===
    JSON.stringify(canonicalUserExportValue(right as Value))
  );
}
function checkedRecord(
  request: UserExportNodeRequest,
  response: UserExportNodeResponse,
) {
  validateResponse("readNode", request, response);
  if (
    nodeKey(response.node) !== nodeKey(request.node) ||
    response.fingerprint !== request.expectedFingerprint ||
    !object(response.record) ||
    response.record._id !== request.node.id ||
    (request.scope.kind === "tenant"
      ? response.record.tenantId !== request.scope.tenantId
      : response.record.tenantId !== undefined)
  )
    throw new UserExportTransportError("EXPORT_CHANGED", "readNode");
  if (
    response.disposition === "record" &&
    createHash("sha256")
      .update(JSON.stringify(canonicalUserExportValue(response.record)))
      .digest("hex") !== request.expectedFingerprint
  )
    throw new UserExportTransportError("EXPORT_CHANGED", "readNode");
  return response;
}
function checkedFile(
  request: UserExportFileRequest,
  response: UserExportFileResponse,
) {
  validateResponse("resolveFile", request, response);
  if (
    nodeKey(response.node) !== nodeKey(request.node) ||
    response.fingerprint !== request.expectedFingerprint ||
    response.file.version !== request.version
  )
    throw new UserExportTransportError("EXPORT_CHANGED", "resolveFile");
  return response.file;
}
async function* streamFile(
  file: UserExportFileResponse["file"],
  options: UserExportCallOptions,
): AsyncGenerator<Uint8Array> {
  const controller = new AbortController(),
    abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 30_000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    checkCancellation(options);
    const url = new URL(file.url);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new UserExportTransportError("EXPORT_PROTOCOL", "resolveFile");
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
      headers: { "Accept-Encoding": "identity" },
    });
    if (!response.ok || !response.body)
      throw new UserExportTransportError("EXPORT_TRANSPORT", "resolveFile");
    reader = response.body.getReader();
    if ((response.headers.get("content-encoding") ?? "identity") !== "identity")
      throw new UserExportTransportError("EXPORT_FILE_METADATA", "resolveFile");
    const length = response.headers.get("content-length");
    if (
      length !== null &&
      (!/^\d+$/.test(length) || Number(length) !== file.size)
    )
      throw new UserExportTransportError("EXPORT_FILE_METADATA", "resolveFile");
    const hash = createHash("sha256");
    let size = 0,
      buffered = 0;
    let buffer = new Uint8Array(65536);
    for (;;) {
      checkCancellation(options);
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > file.size)
        throw new UserExportTransportError(
          "EXPORT_FILE_METADATA",
          "resolveFile",
        );
      hash.update(next.value);
      for (let offset = 0; offset < next.value.byteLength; ) {
        const count = Math.min(
          65536 - buffered,
          next.value.byteLength - offset,
        );
        buffer.set(next.value.subarray(offset, offset + count), buffered);
        buffered += count;
        offset += count;
        if (buffered === 65536) {
          yield buffer;
          buffer = new Uint8Array(65536);
          buffered = 0;
        }
      }
    }
    if (size !== file.size || hash.digest("hex") !== file.sha256)
      throw new UserExportTransportError("EXPORT_FILE_METADATA", "resolveFile");
    if (buffered) yield buffer.subarray(0, buffered);
  } catch (error) {
    if (error instanceof UserExportTransportError) throw error;
    throw new UserExportTransportError(
      options.signal?.aborted
        ? "EXPORT_CANCELLED"
        : controller.signal.aborted
          ? "EXPORT_DEADLINE"
          : "EXPORT_TRANSPORT",
      "resolveFile",
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
    controller.abort();
    if (reader)
      await cancelExportReader(reader, "resolveFile", controller.signal.aborted);
  }
}
export async function* exportUserData(
  selectedIdentity: UserExportIdentity,
  options: UserExportDataOptions,
): AsyncGenerator<UserExportEvent> {
  if (!validRequest("inspect", selectedIdentity))
    throw new UserExportTransportError("EXPORT_PROTOCOL", "inspect");
  const identity: UserExportIdentity = {
    userId: selectedIdentity.userId,
    scope: { ...selectedIdentity.scope },
  };
  const transportInput: unknown = options.transport;
  const pageSize = options.pageSize ?? 100;
  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    !object(transportInput) ||
    !Object.keys(FUNCTIONS).every(
      (name) => typeof transportInput[name] === "function",
    )
  )
    throw new UserExportTransportError("EXPORT_PROTOCOL", "inspect");
  checkCancellation(options);
  const startedAt = Date.now(),
    transport = options.transport;
  yield {
    type: "header",
    format: "cortex-user-export",
    version: 1,
    identity: { userId: identity.userId, scope: { ...identity.scope } },
    consistency: "rolling-read",
    startedAt,
  };
  const closure = await discoverUserExportClosure(transport, identity, {
    ...options,
    pageSize,
  });
  const counts = new Map<
    UserExportDomain,
    { records: number; projections: number }
  >();
  const files = new Map<
    string,
    { file: UserExportFileResponse["file"]; blob: UserExportBlob }
  >();
  const fileRequests: {
    request: UserExportFileRequest;
    file: UserExportFileResponse["file"];
  }[] = [];
  for (const item of closure.reachable) {
    checkCancellation(options);
    const request = releaseRequest(identity, item),
      response = checkedRecord(
        request,
        await transport.readNode(request, options),
      );
    const expectedDisposition =
      request.node.domain === "memorySpaces" ||
      item.projection.disposition === "membershipProjection"
        ? "membershipProjection"
        : "record";
    if (response.disposition !== expectedDisposition)
      throw new UserExportTransportError("EXPORT_PROTOCOL", "readNode");
    const count = counts.get(request.node.domain) ?? {
      records: 0,
      projections: 0,
    };
    count[response.disposition === "record" ? "records" : "projections"]++;
    counts.set(request.node.domain, count);
    yield {
      type: "record",
      node: { ...request.node },
      fingerprint: response.fingerprint,
      disposition: response.disposition,
      record: canonicalUserExportValue(response.record),
    };
    if (
      response.disposition !== "record" ||
      !["artifacts", "attachments"].includes(request.node.domain)
    )
      continue;
    const row = response.record as Record<string, Value>;
    const versions = new Set<number | undefined>();
    if (request.node.domain === "attachments") versions.add(undefined);
    else {
      if (object(row.fileRef)) versions.add(Number(row.versionPointer));
      for (const entry of Array.isArray(row.versionHistory)
        ? row.versionHistory
        : [])
        if (object(entry) && object(entry.fileRef))
          versions.add(Number(entry.version));
    }
    for (const version of [...versions].sort((a, b) => (a ?? 0) - (b ?? 0))) {
      const fileRequest: UserExportFileRequest = {
        ...request,
        node: request.node as UserExportFileNode,
        ...(version === undefined ? {} : { version }),
      };
      const file = checkedFile(
        fileRequest,
        await transport.resolveFile(fileRequest, options),
      );
      fileRequests.push({ request: fileRequest, file });
      const existing = files.get(file.storageId);
      if (
        existing &&
        (existing.file.size !== file.size ||
          existing.file.sha256 !== file.sha256 ||
          existing.file.mimeType !== file.mimeType)
      )
        throw new UserExportTransportError(
          "EXPORT_FILE_METADATA",
          "resolveFile",
        );
      const selected = existing ?? {
        file,
        blob: {
          storageId: file.storageId,
          size: file.size,
          sha256: file.sha256,
          mimeType: file.mimeType,
          referrers: [],
        },
      };
      selected.blob.referrers.push({
        node: request.node,
        ...(version === undefined ? {} : { version }),
      });
      files.set(file.storageId, selected);
    }
  }
  for (const { file, blob } of files.values()) {
    yield {
      type: "blob",
      ...blob,
      referrers: blob.referrers.map((x) => ({ ...x, node: { ...x.node } })),
    };
    let sequence = 0;
    for await (const chunk of streamFile(file, options))
      yield {
        type: "chunk",
        storageId: blob.storageId,
        sequence: sequence++,
        byteLength: chunk.byteLength,
        data: Buffer.from(chunk).toString("base64"),
      };
    yield {
      type: "blobEnd",
      storageId: blob.storageId,
      chunks: sequence,
      size: blob.size,
      sha256: blob.sha256,
    };
  }
  // Rolling read: recheck observed physical records and witnesses. This is not an atomic snapshot.
  for (const item of closure.reachable) {
    checkCancellation(options);
    const request = releaseRequest(identity, item);
    checkedRecord(request, await transport.readNode(request, options));
  }
  const rooted = new Set(
    closure.reachable.map((x) => nodeKey(x.projection.node)),
  );
  for (const saved of [
    ...closure.witnesses,
    ...closure.diagnostics.filter((x) => rooted.has(nodeKey(x.childNode))),
  ]) {
    checkCancellation(options);
    const request = {
      ...identity,
      node: saved.childNode,
      expectedFingerprint: saved.childFingerprint,
      edgeOrdinal: saved.ordinal,
    };
    const response = await transport.inspectEdge(request, options);
    validateResponse("inspectEdge", request, response);
    if (!sameWitness(saved, response.witness))
      throw new UserExportTransportError("EXPORT_CHANGED", "inspectEdge");
  }
  for (const { request, file } of fileRequests) {
    checkCancellation(options);
    const current = checkedFile(
      request,
      await transport.resolveFile(request, options),
    );
    const { url: _url, ...left } = file,
      { url: _current, ...right } = current;
    if (
      JSON.stringify(canonicalUserExportValue(left as Value)) !==
      JSON.stringify(canonicalUserExportValue(right as Value))
    )
      throw new UserExportTransportError("EXPORT_CHANGED", "resolveFile");
  }
  checkCancellation(options);
  yield {
    type: "manifest",
    version: 1,
    complete: true,
    identity,
    consistency: "rolling-read",
    startedAt,
    endedAt: Date.now(),
    tableManifest: USER_EXPORT_DOMAINS.map((domain) => ({
      domain,
      pages: closure.pageObservations.filter((x) => x.domain === domain).length,
      ...(counts.get(domain) ?? { records: 0, projections: 0 }),
    })),
    pageCount: closure.pageCount,
    projectionCount: closure.projectionCount,
    pageObservations: closure.pageObservations,
    blobs: [...files.values()].map((x) => x.blob),
    diagnostics: closure.diagnostics,
    exclusions: [...USER_EXPORT_EXCLUSIONS],
  };
}
