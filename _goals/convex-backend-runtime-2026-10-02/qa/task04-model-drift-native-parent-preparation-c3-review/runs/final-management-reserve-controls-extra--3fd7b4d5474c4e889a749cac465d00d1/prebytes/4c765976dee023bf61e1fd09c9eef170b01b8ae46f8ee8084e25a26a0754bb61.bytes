import { ConvexError } from "convex/values";

const expected = {
  version: 1,
  code: "CAPABILITY_NOT_READY",
  message: "Access denied or invalid registry input",
  retryable: false,
  outcome: "not_dispatched",
} as const;
const identifyingField = Symbol.for("ConvexError");

/** Recognize only the native, static registry capability envelope; never read getters. */
export function isRegistryStatisticsUnavailable(error: unknown): error is ConvexError<typeof expected> {
  try {
    if (!error || typeof error !== "object" || Object.getPrototypeOf(error) !== ConvexError.prototype) return false;
    const errorKeys = Reflect.ownKeys(error);
    // Native ConvexError includes a lazy stack accessor; it is intentionally never read.
    if (errorKeys.some((key) => !["stack", "message", "name", "data", identifyingField].includes(key))) return false;
    const dataDescriptor = Object.getOwnPropertyDescriptor(error, "data");
    const nameDescriptor = Object.getOwnPropertyDescriptor(error, "name");
    const markerDescriptor = Object.getOwnPropertyDescriptor(error, identifyingField);
    const messageDescriptor = Object.getOwnPropertyDescriptor(error, "message");
    if (!dataDescriptor || !("value" in dataDescriptor) || !nameDescriptor || !("value" in nameDescriptor) || nameDescriptor.value !== "ConvexError" || !markerDescriptor || !("value" in markerDescriptor) || markerDescriptor.value !== true || !messageDescriptor || !("value" in messageDescriptor)) return false;
    const data: unknown = dataDescriptor.value;
    if (!data || typeof data !== "object" || Object.getPrototypeOf(data) !== Object.prototype) return false;
    const keys = Reflect.ownKeys(data);
    if (keys.length !== Object.keys(expected).length) return false;
    const captured: Record<string, string | number | boolean> = {};
    for (const key of keys) {
      if (typeof key !== "string" || !Object.hasOwn(expected, key)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(data, key);
      const expectation = Object.getOwnPropertyDescriptor(expected, key);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || !expectation || descriptor.value !== expectation.value) return false;
      captured[key] = descriptor.value as string | number | boolean;
    }
    // A modified wrapper message could carry private text despite a safe data object.
    const canonical = new ConvexError(captured);
    return messageDescriptor.value === Object.getOwnPropertyDescriptor(canonical, "message")?.value;
  } catch {
    // Proxy traps/descriptor failures cannot become a capability result.
    return false;
  }
}
