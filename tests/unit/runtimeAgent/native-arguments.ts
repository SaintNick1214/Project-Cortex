import { convexToJson } from "convex/values";
import type { Value } from "convex/values";
type NativeSchema = { type: string; value?: unknown };
/** Apply the actual registration's exported graph to the actual outgoing RPC.
 * In particular, exact native objects reject structurally assignable extras. */
export function assertNativeArgs(registration: unknown, args: unknown): void {
  const schema = JSON.parse((registration as { exportArgs(): string }).exportArgs()) as NativeSchema;
  const wire = convexToJson(args as Value);
  function check(rule: NativeSchema, value: unknown): void {
    if (rule.type === "any") return;
    if (rule.type === "union") {
      for (const option of rule.value as NativeSchema[]) { try { check(option, value); return; } catch { /* Try the next declared branch. */ } }
      throw new Error("No native union branch matched");
    }
    if (rule.type === "object") {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Native object required");
      const fields = rule.value as Record<string, { fieldType: NativeSchema; optional: boolean }>;
      const object = value as Record<string, unknown>;
      for (const key of Object.keys(object)) if (!Object.prototype.hasOwnProperty.call(fields, key)) throw new Error(`Unknown native field: ${key}`);
      for (const [key, field] of Object.entries(fields)) {
        if (!Object.prototype.hasOwnProperty.call(object, key)) { if (!field.optional) throw new Error(`Missing native field: ${key}`); }
        else check(field.fieldType, object[key]);
      }
      return;
    }
    if (rule.type === "array") { if (!Array.isArray(value)) throw new Error("Native array required"); for (const item of value) check(rule.value as NativeSchema, item); return; }
    if (rule.type === "literal") { if (value !== rule.value) throw new Error("Native literal mismatch"); return; }
    if (rule.type === "null") { if (value !== null) throw new Error("Native null required"); return; }
    if (rule.type === "id") { if (typeof value !== "string") throw new Error("Native ID required"); return; }
    if (typeof value !== rule.type) throw new Error(`Native ${rule.type} required`);
  }
  check(schema, wire);
}
