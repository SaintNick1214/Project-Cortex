/** Parse the official CLI invocation and the accepted structured ConvexError.
 * Diagnostics stay in memory; arbitrary permission words never suffice.
 */
export function acceptedOperatorDenial(name, result) {
  if (!result || typeof name !== "string" || result.code !== 1 || result.timedOut !== false || result.overflow !== false || result.signal !== null || result.stdout !== "" || typeof result.stderr !== "string") return false;
  const text = result.stderr.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "");
  // run.ts prints the actual function first; context.ts/logFailure may prepend
  // exactly "✖ ". The immediate HTTP ConvexError body is the server diagnostic.
  // Match the entire output, never markers quoted inside a different error.
  const match = /^(?:✖ )?Failed to run function "([A-Za-z0-9_]+:[A-Za-z0-9_]+)":\nConvexError: \[Request ID: ([a-f0-9]+)\] Server Error\nUncaught ConvexError: (\{[^\r\n]+\})(?:\n {4}at (?:async )?[A-Za-z0-9_.$<> /:@+-]+(?::[0-9]+:[0-9]+|\([A-Za-z0-9_./:@+-]+:[0-9]+:[0-9]+\)))*\n?$/.exec(text);
  if (!match || match[0] !== text || match[1] !== name) return false;
  let payload;
  try { payload = JSON.parse(match[3]); } catch { return false; }
  // Installed ConvexError uses compact JSON.stringify. This also excludes
  // duplicate keys/diagnostic examples that JSON.parse alone could normalize.
  if (JSON.stringify(payload) !== match[3]) return false;
  const boundary = Object.keys(payload).sort().join(",") === "code,message,outcome,retryable,version"
    && payload.version === 1 && payload.code === "FORBIDDEN" && payload.message === "Access denied"
    && payload.retryable === false && payload.outcome === "not_dispatched";
  if (name.startsWith("runtimeAuth:")) return boundary;
  if (name.startsWith("sessions:")) return boundary || (Object.keys(payload).sort().join(",") === "code,message" && payload.code === "FORBIDDEN" && payload.message === "Access denied");
  return false;
}
