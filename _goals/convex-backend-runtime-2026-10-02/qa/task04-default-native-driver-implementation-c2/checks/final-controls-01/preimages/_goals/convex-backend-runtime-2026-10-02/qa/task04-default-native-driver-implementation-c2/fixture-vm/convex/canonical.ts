/** Inspect the entire bounded own-data graph before reading any property values.
 * Convex deserialized values are plain data. Accessors/symbols/prototypes/sparse arrays
 * are refused; arbitrary JS Proxy traps are outside Convex's value boundary. */
export function canonical(value: unknown, maximumBytes = 65536): string {
  const seen = new Set<object>(); let nodes = 0;
  function inspect(item: unknown, depth: number): void {
    if (++nodes > 4096 || depth > 16) throw new Error("GRAPH_LIMIT");
    if (typeof item === "string") { if (!item.isWellFormed()) throw new Error("UNICODE"); return; }
    if (item === null || typeof item === "boolean") return;
    if (typeof item === "number") { if (!Number.isFinite(item) || Object.is(item, -0)) throw new Error("NUMBER"); return; }
    if (typeof item !== "object" || seen.has(item)) throw new Error("DATA_GRAPH");
    seen.add(item);
    const array = Array.isArray(item), proto = Object.getPrototypeOf(item);
    if (proto !== (array ? Array.prototype : Object.prototype) && !(proto === null && !array)) throw new Error("PROTOTYPE");
    const descriptors = Object.getOwnPropertyDescriptors(item);
    if (Reflect.ownKeys(descriptors).some(k => typeof k !== "string")) throw new Error("SYMBOL");
    for (const [key, d] of Object.entries(descriptors)) {
      if (!key.isWellFormed() || !("value" in d) || (!d.enumerable && !(array && key === "length"))) throw new Error("OWN_DATA");
    }
    if (array) {
      const length = descriptors.length.value as number;
      if (length > 4096 || Object.keys(descriptors).length !== length + 1) throw new Error("ARRAY");
      for (let i = 0; i < length; i++) { if (!descriptors[String(i)]) throw new Error("SPARSE"); inspect(descriptors[String(i)].value, depth + 1); }
    } else for (const d of Object.values(descriptors)) inspect(d.value, depth + 1);
  }
  inspect(value, 0);
  function encode(item: unknown): string {
    if (item === null || typeof item !== "object") return JSON.stringify(item);
    if (Array.isArray(item)) return "[" + item.map(encode).join(",") + "]";
    const data = item as Record<string, unknown>;
    return "{" + Object.keys(data).sort().map(key => JSON.stringify(key) + ":" + encode(data[key])).join(",") + "}";
  }
  const result = encode(value);
  if (new TextEncoder().encode(result).length > maximumBytes) throw new Error("BYTE_LIMIT");
  return result;
}
export function parseCanonical(text: string, maximumBytes = 65536): unknown {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > maximumBytes) throw new Error("BYTE_LIMIT");
  const value: unknown = JSON.parse(text);
  if (canonical(value, maximumBytes) !== text) throw new Error("NONCANONICAL");
  return value;
}
export function exact(value: unknown, keys: readonly string[], maximumBytes=65536): asserts value is Record<string, unknown> {
  canonical(value,maximumBytes);
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new Error("SHAPE");
}
export async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
