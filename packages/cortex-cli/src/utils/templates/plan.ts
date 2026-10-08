import {
  TemplateError,
  hashBytes,
  validateBaseline,
  type TemplateBaseline,
} from "./contract.js";
import { mergePackage } from "./package.js";
export interface LocalFile {
  bytes: Buffer;
  executable: boolean;
}
export interface TemplateChange {
  path: string;
  before: LocalFile | null;
  after: LocalFile | null;
}
export interface TemplatePlan {
  old: TemplateBaseline;
  next: TemplateBaseline;
  expected: Record<string, LocalFile | null>;
  changes: TemplateChange[];
  conflicts: Array<{ path: string; reason: string }>;
  adopted: string[];
}
const same = (a: LocalFile | null, b: LocalFile | null): boolean =>
  a === null || b === null
    ? a === b
    : a.executable === b.executable && a.bytes.equals(b.bytes);
const owned = (baseline: TemplateBaseline, name: string): LocalFile | null =>
  Object.hasOwn(baseline.files, name)
    ? {
        bytes: Buffer.from(baseline.files[name].content, "base64"),
        executable: baseline.files[name].executable,
      }
    : null;
/** Pure all-conflict preflight. Inputs are copied; this never reads or writes a project. */
export function planTemplateUpdate(
  old: TemplateBaseline,
  next: TemplateBaseline,
  local: ReadonlyMap<string, LocalFile>,
  options: {
    adoptIdentical?: boolean;
    compatibleVersion?: (
      local: string,
      next: string,
      packageName: string,
    ) => boolean;
  } = {},
): TemplatePlan {
  validateBaseline(old);
  validateBaseline(next);
  if (
    old.identity.id !== next.identity.id ||
    old.identity.manager !== next.identity.manager
  )
    throw new TemplateError("TEMPLATE_MANAGER_OR_ID_CONFLICT");
  if (JSON.stringify(old.parameters) !== JSON.stringify(next.parameters))
    throw new TemplateError("TEMPLATE_RENDER_PARAMETERS_CONFLICT");
  const allNames = [
    ...new Set([...Object.keys(old.files), ...Object.keys(next.files)]),
  ].sort();
  if (
    new Set(allNames.map((name) => name.toLowerCase())).size !== allNames.length
  )
    throw new TemplateError("TEMPLATE_DUPLICATE_PATH");
  const plan: TemplatePlan = {
    old: structuredClone(old),
    next: structuredClone(next),
    expected: Object.create(null),
    changes: [],
    conflicts: [],
    adopted: [],
  };
  for (const name of allNames) {
    const a = owned(old, name),
      c = owned(next, name),
      existing = local.get(name),
      b = existing
        ? {
            bytes: Buffer.from(existing.bytes),
            executable: existing.executable,
          }
        : null;
    plan.expected[name] = b;
    if (!a && b) {
      if (options.adoptIdentical && same(b, c)) plan.adopted.push(name);
      else plan.conflicts.push({ path: name, reason: "unowned-collision" });
      continue;
    }
    if (name === "package.json" && a && b && c) {
      const merged = mergePackage(
        a.bytes,
        b.bytes,
        c.bytes,
        options.compatibleVersion,
        old.identity.manager,
      );
      for (const reason of merged.conflicts)
        plan.conflicts.push({ path: name, reason });
      if (
        !merged.conflicts.length &&
        !same(b, { bytes: merged.bytes, executable: b.executable })
      )
        plan.changes.push({
          path: name,
          before: b,
          after: { bytes: merged.bytes, executable: b.executable },
        });
    } else if (same(b, c) || same(a, c)) continue;
    else if (same(a, b)) plan.changes.push({ path: name, before: b, after: c });
    else
      plan.conflicts.push({
        path: name,
        reason: !c ? "modified-deletion" : "divergent-change",
      });
  }
  const adoptions = [...new Set([...(old.adoptions ?? []), ...plan.adopted])]
    .filter((name) => Object.hasOwn(next.files, name))
    .sort();
  if (adoptions.length) plan.next.adoptions = adoptions;
  return plan;
}
export function fileFingerprint(file: LocalFile | null): string | null {
  return file
    ? `${file.executable ? "x" : "-"}:${hashBytes(file.bytes)}`
    : null;
}
