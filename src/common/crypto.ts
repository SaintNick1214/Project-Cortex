/** Portable bounded SHA-256 for canonical evidence and streamed export content. */
import { Hash } from "fast-sha256";
import { convexToJson, type Value } from "convex/values";

const hexadecimal = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export function createSha256() {
  const hash = new Hash();
  const digest = {
    update(value: string | Uint8Array) {
      hash.update(typeof value === "string" ? new TextEncoder().encode(value) : value);
      return digest;
    },
    digestHex(): string { return hexadecimal(hash.digest()); },
  };
  return digest;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 4096)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 4096));
  return globalThis.btoa(binary);
}

/** Node's builtin fallback keeps operation IDs secure when its WebCrypto global is absent. */
export function randomUUID(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (typeof process !== "undefined" && typeof process.getBuiltinModule === "function") {
    const crypto = process.getBuiltinModule("node:crypto") as Pick<typeof import("node:crypto"), "randomUUID">;
    return crypto.randomUUID();
  }
  throw new Error("Secure operation identifiers require a cryptographic random source");
}

/** Matches the backend's sorted, undefined-free canonical Convex evidence encoding. */
export function digestConvexValue(value: unknown): string {
  const clean = (item: unknown): unknown => Array.isArray(item) ? item.map(clean)
    : item && typeof item === "object" && !(item instanceof ArrayBuffer)
      ? Object.fromEntries(Object.entries(item).filter(([, child]) => child !== undefined).map(([key, child]) => [key, clean(child)]))
      : item;
  const sorted = (item: unknown): unknown => Array.isArray(item) ? item.map(sorted)
    : item && typeof item === "object"
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, child]) => [key, sorted(child)]))
      : item;
  return createSha256().update(JSON.stringify(sorted(convexToJson(clean(value) as Value)))).digestHex();
}
