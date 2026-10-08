import { TemplateError, stableJson } from "./contract.js";
export interface PackageMerge {
  bytes: Buffer;
  conflicts: string[];
}
const maps = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "scripts",
] as const;
type Manifest = Record<string, unknown>;
function parse(bytes: Uint8Array): Manifest {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw new TemplateError("TEMPLATE_PACKAGE_INVALID");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TemplateError("TEMPLATE_PACKAGE_INVALID");
  const manifest = value as Manifest;
  for (const name of maps) {
    const map = manifest[name];
    if (
      map !== undefined &&
      (!map ||
        typeof map !== "object" ||
        Array.isArray(map) ||
        Object.values(map).some((v) => typeof v !== "string"))
    )
      throw new TemplateError("TEMPLATE_PACKAGE_INVALID");
  }
  if (
    manifest.packageManager !== undefined &&
    typeof manifest.packageManager !== "string"
  )
    throw new TemplateError("TEMPLATE_PACKAGE_INVALID");
  return manifest;
}
const values = (
  manifest: Manifest,
  name: (typeof maps)[number],
): Record<string, string> =>
  (manifest[name] ?? Object.create(null)) as Record<string, string>;
const manager = (value: unknown): string | undefined =>
  typeof value === "string" ? value.split("@")[0] : undefined;
/** Only upstream-owned script/dependency leaf paths are merged. Identity and user policy remain local. */
export function mergePackage(
  oldBytes: Uint8Array,
  localBytes: Uint8Array,
  newBytes: Uint8Array,
  compatible?: (
    localRange: string,
    upstreamRange: string,
    packageName: string,
  ) => boolean,
  expectedManager?: "npm" | "pnpm",
): PackageMerge {
  const old = parse(oldBytes),
    local = parse(localBytes),
    next = parse(newBytes),
    merged = structuredClone(local),
    conflicts: string[] = [];
  const oldManager = manager(old.packageManager),
    localManager = manager(local.packageManager),
    nextManager = manager(next.packageManager);
  if (
    oldManager !== nextManager ||
    (localManager && nextManager && localManager !== nextManager)
  )
    conflicts.push("packageManager");
  if (
    expectedManager &&
    [oldManager, localManager, nextManager].some(
      (value) => value !== undefined && value !== expectedManager,
    )
  )
    conflicts.push("packageManager");
  for (const section of maps) {
    const before = values(old, section),
      current = values(local, section),
      incoming = values(next, section),
      result: Record<string, string> = Object.assign(
        Object.create(null),
        current,
      );
    for (const name of new Set([
      ...Object.keys(before),
      ...Object.keys(incoming),
    ])) {
      const a = Object.hasOwn(before, name) ? before[name] : undefined,
        b = Object.hasOwn(current, name) ? current[name] : undefined,
        c = Object.hasOwn(incoming, name) ? incoming[name] : undefined;
      if (b === c || a === c) continue;
      if (b === a) {
        if (c === undefined) delete result[name];
        else result[name] = c;
      } else if (
        section !== "scripts" &&
        b !== undefined &&
        c !== undefined &&
        compatible?.(b, c, name)
      )
        continue;
      else conflicts.push(`${section}.${name}`);
    }
    if (
      Object.keys(result).length ||
      Object.hasOwn(local, section) ||
      Object.hasOwn(next, section)
    )
      merged[section] = result;
    // A new upstream owned dependency may not also occur in another dependency map.
    if (section !== "scripts")
      for (const name of Object.keys(incoming))
        for (const other of maps.filter(
          (x) => x !== section && x !== "scripts",
        ))
          if (
            Object.hasOwn(values(merged, other), name) &&
            !Object.hasOwn(values(old, other), name)
          )
            conflicts.push(`duplicate:${name}`);
  }
  // Check the complete merged maps; accepted upstream peer/optional overlaps remain unchanged.
  const dependencyMaps = maps.filter((x) => x !== "scripts");
  for (const section of dependencyMaps)
    for (const name of Object.keys(values(next, section)))
      for (const other of dependencyMaps.filter((x) => x !== section))
        if (
          Object.hasOwn(values(merged, other), name) &&
          !(
            Object.hasOwn(values(old, section), name) &&
            Object.hasOwn(values(old, other), name)
          )
        )
          conflicts.push(`duplicate:${name}`);
  if (stableJson(merged) === stableJson(local))
    return {
      bytes: Buffer.from(localBytes),
      conflicts: [...new Set(conflicts)].sort(),
    };
  return {
    bytes: Buffer.from(JSON.stringify(merged, null, 2) + "\n"),
    conflicts: [...new Set(conflicts)].sort(),
  };
}
