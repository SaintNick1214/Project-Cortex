/** Separate explicit administration transport; no SDK private client or key discovery. */
import { convexToJson, jsonToConvex, type Value } from "convex/values";
export const maintenancePaths = {
  status: "referenceMaintenance:status",
  planPage: "referenceMaintenance:planPage",
  startGeneration: "referenceMaintenance:startGeneration",
  advanceBackfill: "referenceMaintenance:advanceBackfill",
  beginFinalization: "referenceMaintenance:beginFinalization",
  advanceValidation: "referenceMaintenance:advanceValidation",
  activateGeneration: "referenceMaintenance:activateGeneration",
  abortFinalization: "referenceMaintenance:abortFinalization",
} as const;
type Operation = keyof typeof maintenancePaths;
export interface ReferenceStatus {
  version: 1;
  state: "missing" | "building" | "finalizing" | "ready" | "invalid";
  ready: boolean;
  generation: string | null;
  writerManifestHash: string | null;
  expectedWriterManifestHash: string;
  backfill: { complete: boolean } | null;
  validation: { complete: boolean } | null;
  [field: string]: unknown;
}
export class ReferenceMaintenanceError extends Error {
  constructor(
    public readonly code: string,
    public readonly outcomeUnknown = false,
  ) {
    super(code);
    this.name = "ReferenceMaintenanceError";
  }
}
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
function prerequisite(): never {
  throw new ReferenceMaintenanceError(
    "REFERENCE_PREREQUISITE: deploy the installed SDK reference schema/functions before migration",
  );
}
export function createReferenceMaintenanceTransport(
  url: string,
  key: string,
  fetcher: typeof fetch = fetch,
) {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new ReferenceMaintenanceError("REFERENCE_INVALID_TARGET");
  }
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== "/"
  )
    throw new ReferenceMaintenanceError("REFERENCE_INVALID_TARGET");
  if (typeof key !== "string" || !key.trim() || /[\r\n\0]/.test(key))
    throw new ReferenceMaintenanceError("REFERENCE_DEPLOYMENT_KEY_REQUIRED");
  async function call(
    operation: Operation,
    args: Record<string, Value> = {},
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!Object.prototype.hasOwnProperty.call(maintenancePaths, operation))
      throw new ReferenceMaintenanceError("REFERENCE_OPERATION_NOT_ALLOWED");
    if (
      (operation !== "planPage" && Object.keys(args).length) ||
      (operation === "planPage" &&
        Object.keys(args).some((k) => k !== "cursor"))
    )
      throw new ReferenceMaintenanceError("REFERENCE_ARGUMENT_NOT_ALLOWED");
    if (
      operation === "planPage" &&
      args.cursor !== undefined &&
      (typeof args.cursor !== "string" ||
        Buffer.byteLength(args.cursor) > 1024 * 1024)
    )
      throw new ReferenceMaintenanceError("REFERENCE_ARGUMENT_NOT_ALLOWED");
    const controller = new AbortController(),
      cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = setTimeout(cancel, 10000);
    const mutation = operation !== "status" && operation !== "planPage";
    try {
      const response = await fetcher(
        `${target.origin}/api/${mutation ? "mutation" : "query"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Convex ${key}`,
          },
          body: JSON.stringify({
            path: maintenancePaths[operation],
            format: "convex_encoded_json",
            args: [convexToJson(args)],
          }),
          signal: controller.signal,
        },
      );
      if (response.status === 401 || response.status === 403)
        throw new ReferenceMaintenanceError("REFERENCE_ACCESS_DENIED");
      const length = Number(response.headers.get("Content-Length") ?? 0);
      if (length > 8 * 1024 * 1024)
        throw new ReferenceMaintenanceError(
          "REFERENCE_RESPONSE_TOO_LARGE",
          mutation,
        );
      const text = await response.text();
      if (Buffer.byteLength(text) > 8 * 1024 * 1024)
        throw new ReferenceMaintenanceError(
          "REFERENCE_RESPONSE_TOO_LARGE",
          mutation,
        );
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new ReferenceMaintenanceError("REFERENCE_PROTOCOL", mutation);
      }
      if (!object(raw))
        throw new ReferenceMaintenanceError("REFERENCE_PROTOCOL", mutation);
      if (raw.status === "error") {
        const error = raw.errorData;
        const data = object(error) ? error : undefined;
        if (
          data &&
          typeof data.code === "string" &&
          /^(REFERENCE_|SOURCE_PROVENANCE_)[A-Z_]+$/.test(data.code)
        )
          throw new ReferenceMaintenanceError(data.code);
        if (
          typeof raw.errorMessage === "string" &&
          /not find|not found|not exist|Unable to find/i.test(raw.errorMessage)
        )
          prerequisite();
        throw new ReferenceMaintenanceError("REFERENCE_SERVER_REFUSAL");
      }
      if (!response.ok || raw.status !== "success" || !("value" in raw))
        prerequisite();
      let value: unknown;
      try {
        value = jsonToConvex(raw.value as Parameters<typeof jsonToConvex>[0]);
      } catch {
        throw new ReferenceMaintenanceError("REFERENCE_PROTOCOL", mutation);
      }
      return value;
    } catch (error) {
      if (error instanceof ReferenceMaintenanceError) throw error;
      throw new ReferenceMaintenanceError(
        signal?.aborted
          ? "REFERENCE_CANCELLED"
          : controller.signal.aborted
            ? "REFERENCE_REQUEST_TIMEOUT"
            : "REFERENCE_CONNECTION_FAILED",
        mutation,
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
    }
  }
  async function status(signal?: AbortSignal): Promise<ReferenceStatus> {
    const value = await call("status", {}, signal);
    if (
      !object(value) ||
      value.version !== 1 ||
      typeof value.ready !== "boolean" ||
      !["missing", "building", "finalizing", "ready", "invalid"].includes(
        String(value.state),
      ) ||
      typeof value.expectedWriterManifestHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(value.expectedWriterManifestHash) ||
      value.ready !==
        (value.state === "ready" &&
          value.writerManifestHash === value.expectedWriterManifestHash)
    )
      throw new ReferenceMaintenanceError("REFERENCE_PROTOCOL");
    return value as unknown as ReferenceStatus;
  }
  return { call, status };
}
export async function runReferenceMaintenance(
  transport: ReturnType<typeof createReferenceMaintenanceTransport>,
  operation: "references" | "migrate",
  dryRun: boolean,
  signal?: AbortSignal,
) {
  let current = await transport.status(signal);
  if (operation === "references") return { executed: false, ...current };
  if (dryRun) {
    const counts: Record<string, { rows: number; storageOccurrences: number }> =
        {},
      seen = new Set<string>();
    let cursor: string | undefined;
    for (;;) {
      const value = await transport.call(
        "planPage",
        cursor ? { cursor } : {},
        signal,
      );
      if (
        !object(value) ||
        value.version !== 1 ||
        value.executed !== false ||
        typeof value.table !== "string" ||
        !Number.isSafeInteger(value.rows) ||
        Number(value.rows) < 0 ||
        Number(value.rows) > 128 ||
        !Number.isSafeInteger(value.storageOccurrences) ||
        Number(value.storageOccurrences) < 0 ||
        typeof value.done !== "boolean"
      )
        throw new ReferenceMaintenanceError("REFERENCE_PROTOCOL");
      const tally = counts[value.table] ?? { rows: 0, storageOccurrences: 0 };
      tally.rows += Number(value.rows);
      tally.storageOccurrences += Number(value.storageOccurrences);
      counts[value.table] = tally;
      if (value.done) {
        if (value.nextCursor !== null)
          throw new ReferenceMaintenanceError("REFERENCE_PROTOCOL");
        break;
      }
      if (
        typeof value.nextCursor !== "string" ||
        !value.nextCursor ||
        seen.has(value.nextCursor)
      )
        throw new ReferenceMaintenanceError("REFERENCE_CURSOR_NONPROGRESS");
      seen.add(value.nextCursor);
      cursor = value.nextCursor;
    }
    return { executed: false, ...current, plan: counts };
  }
  if (current.ready) return { executed: false, ...current };
  if (current.state !== "finalizing") {
    await transport.call("startGeneration", {}, signal);
    current = await transport.status(signal);
  }
  while (!current.ready) {
    if (signal?.aborted)
      throw new ReferenceMaintenanceError("REFERENCE_CANCELLED");
    let next: Operation;
    if (current.state === "building")
      next = current.backfill?.complete
        ? "beginFinalization"
        : "advanceBackfill";
    else if (current.state === "finalizing")
      next = current.validation?.complete
        ? "activateGeneration"
        : "advanceValidation";
    else throw new ReferenceMaintenanceError("REFERENCE_MAINTENANCE_STATE");
    await transport.call(next, {}, signal);
    current = await transport.status(signal);
  }
  return { executed: true, ...current };
}
