/** Fresh request-local verified identity. App session labels never grant Cortex authority. */
import {
  CortexRuntimeClient,
  CortexRuntimeError,
} from "@cortexmemory/sdk/runtime";
export class RuntimeHttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, options?: ErrorOptions) {
    super(code, options);
    this.status = status;
    this.code = code;
  }
}
export function bearer(request: Request): string {
  const value = request.headers.get("authorization");
  if (!value || !/^Bearer [A-Za-z0-9._~-]{1,16384}$/.test(value)) {
    throw new RuntimeHttpError(401, "UNAUTHENTICATED");
  }
  return value.slice(7);
}
export async function requestBytes(
  request: Request,
  maximum = 32_768,
  timeoutMs = 5000
): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximum)) {
    throw new RuntimeHttpError(413, "INPUT_TOO_LARGE");
  }
  if (!request.body) {
    throw new RuntimeHttpError(400, "INVALID_INPUT");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    const read = async () => {
      for (;;) {
        const value = await reader.read();
        if (value.done) {
          break;
        }
        bytes += value.value.length;
        if (bytes > maximum) {
          throw new RuntimeHttpError(413, "INPUT_TOO_LARGE");
        }
        chunks.push(value.value);
      }
    };
    await Promise.race([
      read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new RuntimeHttpError(408, "INPUT_TIMEOUT")),
          timeoutMs
        );
        abort = () => reject(new RuntimeHttpError(408, "REQUEST_ABORTED"));
        if (request.signal.aborted) {
          abort();
        } else {
          request.signal.addEventListener("abort", abort, { once: true });
        }
      }),
    ]);
    const all = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      all.set(chunk, offset);
      offset += chunk.length;
    }
    return all;
  } catch (error) {
    if (error instanceof RuntimeHttpError) {
      throw error;
    }
    // biome-ignore lint/style/useErrorCause: RuntimeHttpError places ErrorOptions after status and code.
    throw new RuntimeHttpError(400, "INVALID_INPUT", { cause: error });
  } finally {
    clearTimeout(timer);
    if (abort) {
      request.signal.removeEventListener("abort", abort);
    }
    // Cancellation may settle after a blocked custom stream; it never delays the HTTP bound.
    reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new RuntimeHttpError(400, "INVALID_INPUT");
  }
  try {
    const value: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await requestBytes(request)
      )
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new RuntimeHttpError(400, "INVALID_INPUT");
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RuntimeHttpError) {
      throw error;
    }
    // biome-ignore lint/style/useErrorCause: RuntimeHttpError places ErrorOptions after status and code.
    throw new RuntimeHttpError(400, "INVALID_INPUT", { cause: error });
  }
}
export const runtimeHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
/** SDK results may carry a shorter resource/share deadline than the actor session. */
function assertResultDeadline(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertResultDeadline(item);
    }
    return;
  }
  if (value && typeof value === "object" && "deliveryExpiresAt" in value) {
    const deadline = value.deliveryExpiresAt;
    if (
      typeof deadline !== "number" ||
      !Number.isFinite(deadline) ||
      deadline <= Date.now()
    ) {
      throw new RuntimeHttpError(403, "AUTHORITY_EXPIRED");
    }
  }
}
export async function withRuntime(
  request: Request,
  action: (client: CortexRuntimeClient) => Promise<unknown>
): Promise<Response> {
  let client: CortexRuntimeClient | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    const token = bearer(request),
      convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new RuntimeHttpError(503, "BACKEND_NOT_CONFIGURED");
    }
    client = new CortexRuntimeClient({
      deploymentUrl: convexUrl,
      fetchToken: async () => token,
      scope: {
        ...(process.env.CORTEX_TENANT_ID
          ? { tenantId: process.env.CORTEX_TENANT_ID }
          : {}),
        ...(process.env.CORTEX_MEMORY_SPACE_ID
          ? { memorySpaceId: process.env.CORTEX_MEMORY_SPACE_ID }
          : {}),
      },
      ...(process.env.CORTEX_HTTP_URL
        ? { assetHttpUrl: process.env.CORTEX_HTTP_URL }
        : {}),
    });
    const ownedClient = client;
    const result = await Promise.race([
      (async () => {
        const before = await ownedClient.session();
        const value = await action(ownedClient);
        const after = await ownedClient.session();
        if (
          before.principalId !== after.principalId ||
          before.tenantId !== after.tenantId ||
          before.memorySpaceId !== after.memorySpaceId
        ) {
          throw new RuntimeHttpError(403, "SESSION_CHANGED");
        }
        for (const deadline of [
          before.deliveryExpiresAt,
          after.deliveryExpiresAt,
        ]) {
          if (deadline !== undefined && Date.now() >= deadline) {
            throw new RuntimeHttpError(403, "AUTHORITY_EXPIRED");
          }
        }
        if (request.signal.aborted) {
          throw new RuntimeHttpError(408, "REQUEST_ABORTED");
        }
        assertResultDeadline(value);
        return value;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new RuntimeHttpError(504, "RUNTIME_TIMEOUT")),
          60_000
        );
        abort = () => reject(new RuntimeHttpError(408, "REQUEST_ABORTED"));
        if (request.signal.aborted) {
          abort();
        } else {
          request.signal.addEventListener("abort", abort, { once: true });
        }
      }),
    ]);
    return Response.json(result, { headers: runtimeHeaders });
  } catch (error) {
    const code =
      error instanceof RuntimeHttpError || error instanceof CortexRuntimeError
        ? error.code
        : "RUNTIME_OPERATION_FAILED";
    const status =
      error instanceof RuntimeHttpError
        ? error.status
        : code === "UNAUTHENTICATED"
          ? 401
          : code === "FORBIDDEN" || code === "SESSION_CHANGED"
            ? 403
            : 400;
    return Response.json(
      { code, version: 1 },
      { headers: runtimeHeaders, status }
    );
  } finally {
    clearTimeout(timer);
    if (abort) {
      request.signal.removeEventListener("abort", abort);
    }
    await client?.close();
  }
}
export function exact(
  input: Record<string, unknown>,
  allowed: readonly string[]
): void {
  if (Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new RuntimeHttpError(400, "INVALID_INPUT");
  }
}
export function identifier(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim() !== value ||
    value.length > 256 ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  ) {
    throw new RuntimeHttpError(400, "INVALID_INPUT");
  }
  return value;
}
