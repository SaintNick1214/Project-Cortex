/** npm 12 returns name-keyed objects; older npm returns an array. */
export function parseNpmPackFilename(
  output: string,
  expected: { name: string; version: string },
): string {
  const invalid = (): never => { throw new Error("NPM_PACK_RESULT_INVALID: expected one exact package and a safe archive basename"); };
  if (Buffer.byteLength(output, "utf8") > 4 * 1024 * 1024) invalid();
  let decoded: unknown;
  try { decoded = JSON.parse(output); } catch { return invalid(); }
  let entries: unknown[];
  if (Array.isArray(decoded)) entries = decoded;
  else if (decoded && typeof decoded === "object") {
    const mapping = Object.entries(decoded);
    if (mapping.length !== 1 || mapping[0][0] !== expected.name) invalid();
    entries = mapping.map(([, value]) => value);
  } else return invalid();
  if (entries.length !== 1 || !entries[0] || typeof entries[0] !== "object" || Array.isArray(entries[0])) invalid();
  const entry = entries[0] as Record<string, unknown>;
  if (entry.name !== expected.name || entry.version !== expected.version ||
      (entry.id !== undefined && entry.id !== `${expected.name}@${expected.version}`) ||
      typeof entry.filename !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.-]*\.tgz$/.test(entry.filename)) invalid();
  return entry.filename as string;
}
