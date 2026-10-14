/** Shared bounded refusal serialization; committed native reservations remain intact. */
import { ConvexError } from "convex/values";
import { GatewayDispatchError } from "./runtimeGateway";

export type Refusal = { kind: "convex"; data: { version: number; code: string; message?: string; retryable?: boolean; outcome?: string } }
  | { kind: "gateway"; code: string } | { kind: "error"; message: string } | { kind: "unknown" };
export function boundedRefusal(error: unknown): Refusal {
  // Refusal serialization must never throw and roll back a committed reservation.
  // Inspect only bounded own data fields; getters/proxies are not evidence.
  try {
    const field = (value: object, key: string): unknown => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor && "value" in descriptor ? descriptor.value : undefined;
    };
    const code = error && typeof error === "object" ? field(error, "code") : undefined;
    if (error instanceof GatewayDispatchError && typeof code === "string" && /^[A-Z][A-Z0-9_]{1,100}$/.test(code)) return { kind: "gateway", code };
    const raw = error instanceof ConvexError ? field(error, "data") : undefined;
    if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
      const keys = Reflect.ownKeys(raw);
      if (keys.every(key => typeof key === "string" && ["version", "code", "message", "retryable", "outcome"].includes(key))
        && keys.every(key => { const d = Object.getOwnPropertyDescriptor(raw, key); return d && "value" in d; })) {
        const version = field(raw, "version"), rawCode = field(raw, "code"), message = field(raw, "message"), retryable = field(raw, "retryable"), outcome = field(raw, "outcome");
        if (version === 1 && typeof rawCode === "string" && /^[A-Z][A-Z0-9_]{1,100}$/.test(rawCode)
          && (message === undefined || typeof message === "string" && message.length <= 1024)
          && (retryable === undefined || typeof retryable === "boolean")
          && (outcome === undefined || typeof outcome === "string" && /^[a-z_]{1,64}$/.test(outcome))) {
          return { kind: "convex", data: { version, code: rawCode, ...(message !== undefined ? { message } : {}),
            ...(retryable !== undefined ? { retryable } : {}), ...(outcome !== undefined ? { outcome } : {}) } };
        }
      }
    }
    if (error instanceof Error) {
      const message = field(error, "message");
      if (typeof message === "string" && message.length <= 1024) return { kind: "error", message };
    }
  } catch { /* An opaque failure still leaves the original reservation committed. */ }
  return { kind: "unknown" };
}
export function throwRefusal(refusal: Refusal): never {
  if (refusal.kind === "convex") throw new ConvexError(refusal.data);
  if (refusal.kind === "gateway") throw new GatewayDispatchError(refusal.code);
  if (refusal.kind === "error") throw new Error(refusal.message);
  throw new GatewayDispatchError("QUERY_CHECKPOINT_REFUSED");
}
