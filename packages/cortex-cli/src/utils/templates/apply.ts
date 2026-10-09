import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  TemplateError,
  stableJson,
  validateBaseline,
  validatePayloadPath,
  type TemplateBaseline,
  type TemplateId,
} from "./contract.js";
import { fileFingerprint, type LocalFile, type TemplatePlan } from "./plan.js";

interface StoredFile {
  content: string;
  executable: boolean;
}
interface Journal {
  format: 1;
  state: "applying" | "installing" | "complete" | "rollback-needed";
  old: TemplateBaseline;
  next: TemplateBaseline;
  changes: Array<{
    path: string;
    before: StoredFile | null;
    after: StoredFile | null;
  }>;
  createdDirectories: string[];
  dependency: ApplyOutcome["dependency"];
}
export interface ApplyOutcome {
  status:
    | "dry-run"
    | "no-op"
    | "applied"
    | "rolled-back"
    | "rollback-incomplete";
  changed: number;
  dependency: "not-requested" | "succeeded" | "failed-or-unknown";
}
export class TemplateApplyError extends TemplateError {
  constructor(
    code: string,
    readonly outcome: ApplyOutcome,
  ) {
    super(code);
  }
}
const stored = (file: LocalFile | null): StoredFile | null =>
  file
    ? { content: file.bytes.toString("base64"), executable: file.executable }
    : null;
const decoded = (file: StoredFile | null): LocalFile | null =>
  file
    ? {
        bytes: Buffer.from(file.content, "base64"),
        executable: file.executable,
      }
    : null;
const baselineBytes = (baseline: TemplateBaseline): Buffer =>
  Buffer.from(stableJson(baseline) + "\n");
const missing = (cause: unknown): boolean =>
  !!cause &&
  typeof cause === "object" &&
  "code" in cause &&
  cause.code === "ENOENT";
async function inspectRoot(root: string): Promise<string> {
  const absolute = path.resolve(root);
  const stat = await fs.lstat(absolute);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (await fs.realpath(absolute)) !== absolute
  )
    throw new TemplateError("TEMPLATE_ROOT_UNSAFE");
  return absolute;
}
/** Never follow a link, including a linked parent. Empty directories are ordinary project state. */
async function safePath(root: string, relative: string): Promise<string> {
  const parts = relative.split("/");
  if (
    !relative ||
    parts.some((part) => !part || part === "." || part === "..") ||
    relative.includes("\\") ||
    relative.includes(":") ||
    [...relative].some(
      (c) => c.charCodeAt(0) <= 31 || c.charCodeAt(0) === 127,
    ) ||
    path.isAbsolute(relative)
  )
    throw new TemplateError("TEMPLATE_PATH_INVALID");
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    try {
      const stat = await fs.lstat(current);
      if (
        stat.isSymbolicLink() ||
        (i < parts.length - 1 && !stat.isDirectory()) ||
        (i === parts.length - 1 && !stat.isFile())
      )
        throw new TemplateError("TEMPLATE_PATH_KIND");
    } catch (cause) {
      if (missing(cause)) break;
      throw cause;
    }
  }
  return path.join(root, relative);
}
async function readFile(
  root: string,
  relative: string,
  maximum = 8 * 1024 * 1024,
): Promise<LocalFile | null> {
  const target = await safePath(root, relative);
  let handle;
  try {
    handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maximum)
      throw new TemplateError("TEMPLATE_FILE_BUDGET");
    return {
      bytes: await handle.readFile(),
      executable: (stat.mode & 0o111) !== 0,
    };
  } catch (cause) {
    if (missing(cause)) return null;
    throw cause;
  } finally {
    await handle?.close();
  }
}
/** Read only caller-selected validated payload files, not project/env discovery. */
export async function readTemplateFiles(
  root: string,
  names: readonly string[],
  examples: readonly string[] = [],
): Promise<Map<string, LocalFile>> {
  root = await inspectRoot(root);
  const files = new Map<string, LocalFile>();
  let bytes = 0;
  if (names.length > 10000) throw new TemplateError("TEMPLATE_BASELINE_BUDGET");
  for (const name of names) {
    validatePayloadPath(name, examples);
    const file = await readFile(root, name);
    if (file) {
      bytes += file.bytes.length;
      files.set(name, file);
    }
    if (bytes > 64 * 1024 * 1024)
      throw new TemplateError("TEMPLATE_BASELINE_BUDGET");
  }
  return files;
}
/** Explicit ownership metadata only; absent ownership never guesses a template. */
export async function readTemplateBaseline(
  root: string,
  id: TemplateId,
): Promise<TemplateBaseline | null> {
  root = await inspectRoot(root);
  const file = await readFile(root, metadata(id).baseline, 96 * 1024 * 1024);
  if (!file) return null;
  let baseline: TemplateBaseline;
  try {
    baseline = JSON.parse(file.bytes.toString("utf8"));
  } catch {
    throw new TemplateError("TEMPLATE_BASELINE_INVALID");
  }
  validateBaseline(baseline);
  if (baseline.identity.id !== id)
    throw new TemplateError("TEMPLATE_OWNERSHIP_MISMATCH");
  return baseline;
}
async function mkdirParents(
  root: string,
  relative: string,
  created: string[],
): Promise<void> {
  const parts = relative.split("/").slice(0, -1);
  for (let i = 1; i <= parts.length; i++) {
    const rel = parts.slice(0, i).join("/"),
      dir = path.join(root, rel);
    try {
      await fs.mkdir(dir, { mode: 0o700 });
      created.push(rel);
    } catch (cause) {
      if (
        !cause ||
        typeof cause !== "object" ||
        !("code" in cause) ||
        cause.code !== "EEXIST"
      )
        throw cause;
      const stat = await fs.lstat(dir);
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new TemplateError("TEMPLATE_PATH_KIND");
    }
  }
}
async function replace(
  root: string,
  relative: string,
  file: LocalFile | null,
): Promise<void> {
  const target = await safePath(root, relative);
  if (!file) {
    try {
      await fs.unlink(target);
    } catch (cause) {
      if (!missing(cause)) throw cause;
    }
    return;
  }
  const temporary = path.join(
    path.dirname(target),
    `.cortex-template-${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await fs.open(temporary, "wx", file.executable ? 0o755 : 0o644);
    await handle.writeFile(file.bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await safePath(root, relative);
    await fs.rename(temporary, target);
  } finally {
    await handle?.close();
    await fs.rm(temporary, { force: true });
  }
}
function metadata(id: TemplateId): { baseline: string; journal: string } {
  if (!["basic", "vercel-ai-quickstart", "chat-sdk"].includes(id))
    throw new TemplateError("TEMPLATE_IDENTITY_INVALID");
  return {
    baseline: `.cortex/templates/${id}/baseline.json`,
    journal: `.cortex/templates/${id}/transaction.json`,
  };
}
async function writeJournal(
  root: string,
  name: string,
  journal: Journal,
): Promise<void> {
  const file = {
    bytes: Buffer.from(stableJson(journal) + "\n"),
    executable: false,
  };
  if (file.bytes.length > 384 * 1024 * 1024)
    throw new TemplateError("TEMPLATE_JOURNAL_BUDGET");
  await replace(root, name, file);
  await fs.chmod(path.join(root, name), 0o600);
}
async function rollback(
  root: string,
  journal: Journal,
  paths: ReturnType<typeof metadata>,
): Promise<boolean> {
  let complete = true;
  for (const change of [...journal.changes].reverse()) {
    try {
      const current = await readFile(root, change.path),
        before = decoded(change.before),
        after = decoded(change.after);
      if (fileFingerprint(current) === fileFingerprint(before)) continue;
      if (fileFingerprint(current) !== fileFingerprint(after)) {
        complete = false;
        continue;
      }
      await replace(root, change.path, before);
    } catch {
      complete = false;
    }
  }
  try {
    const current = await readFile(root, paths.baseline, 96 * 1024 * 1024);
    if (
      current &&
      (current.bytes.equals(baselineBytes(journal.next)) ||
        current.bytes.equals(baselineBytes(journal.old)))
    ) {
      await replace(root, paths.baseline, {
        bytes: baselineBytes(journal.old),
        executable: false,
      });
      await fs.chmod(path.join(root, paths.baseline), 0o600);
    } else complete = false;
  } catch {
    complete = false;
  }
  for (const relative of [...journal.createdDirectories].reverse())
    try {
      await fs.rmdir(path.join(root, relative));
    } catch {
      /* Only remove empty directories created by this operation. */
    }
  journal.state = "rollback-needed";
  try {
    if (complete) await fs.unlink(path.join(root, paths.journal));
    else await writeJournal(root, paths.journal, journal);
  } catch {
    complete = false;
  }
  return complete;
}
/** Apply only a conflict-free current plan. Dependency side effects are a separate, explicit outcome. */
export async function applyTemplatePlan(
  root: string,
  input: TemplatePlan,
  options: {
    dryRun?: boolean;
    install?: () => Promise<{ exitCode: number }>;
    signal?: AbortSignal;
  } = {},
): Promise<ApplyOutcome> {
  const plan = {
    ...input,
    old: structuredClone(input.old),
    next: structuredClone(input.next),
    changes: input.changes.map((c) => ({
      path: c.path,
      before: decoded(stored(c.before)),
      after: decoded(stored(c.after)),
    })),
  };
  validateBaseline(plan.old);
  validateBaseline(plan.next);
  if (
    plan.old.identity.id !== plan.next.identity.id ||
    plan.old.identity.manager !== plan.next.identity.manager
  )
    throw new TemplateError("TEMPLATE_MANAGER_OR_ID_CONFLICT");
  if (plan.conflicts.length) throw new TemplateError("TEMPLATE_CONFLICT");
  root = await inspectRoot(root);
  const paths = metadata(plan.old.identity.id);
  if (await readFile(root, paths.journal, 384 * 1024 * 1024))
    throw new TemplateError("TEMPLATE_RECOVERY_REQUIRED");
  const recorded = await readFile(root, paths.baseline, 96 * 1024 * 1024);
  if (!recorded || !recorded.bytes.equals(baselineBytes(plan.old)))
    throw new TemplateError("TEMPLATE_OWNERSHIP_MISMATCH");
  for (const [name, expected] of Object.entries(plan.expected)) {
    validatePayloadPath(name, [
      ...plan.old.envExamples,
      ...plan.next.envExamples,
    ]);
    if (
      fileFingerprint(await readFile(root, name)) !== fileFingerprint(expected)
    )
      throw new TemplateError("TEMPLATE_PLAN_STALE");
  }
  for (const change of plan.changes) {
    validatePayloadPath(change.path, [
      ...plan.old.envExamples,
      ...plan.next.envExamples,
    ]);
    if (
      !(
        Object.hasOwn(plan.old.files, change.path) ||
        Object.hasOwn(plan.next.files, change.path)
      ) ||
      !Object.hasOwn(plan.expected, change.path) ||
      fileFingerprint(change.before) !==
        fileFingerprint(plan.expected[change.path])
    )
      throw new TemplateError("TEMPLATE_PLAN_INVALID");
  }
  const changed = plan.changes.length;
  if (options.dryRun)
    return { status: "dry-run", changed, dependency: "not-requested" };
  if (options.signal?.aborted) throw new TemplateError("TEMPLATE_CANCELLED");
  if (
    !changed &&
    recorded.bytes.equals(baselineBytes(plan.next)) &&
    !options.install
  )
    return { status: "no-op", changed: 0, dependency: "not-requested" };
  const journal: Journal = {
    format: 1,
    state: "applying",
    old: plan.old,
    next: plan.next,
    changes: plan.changes.map((c) => ({
      path: c.path,
      before: stored(c.before),
      after: stored(c.after),
    })),
    createdDirectories: [],
    dependency: "not-requested",
  };
  const initialJournal = stableJson(journal) + "\n";
  if (Buffer.byteLength(initialJournal) > 384 * 1024 * 1024)
    throw new TemplateError("TEMPLATE_JOURNAL_BUDGET");
  // Exclusive durable reservation precedes all owned payload changes.
  const reservation = await fs.open(
    await safePath(root, paths.journal),
    "wx",
    0o600,
  );
  try {
    await reservation.writeFile(initialJournal);
    await reservation.sync();
  } finally {
    await reservation.close();
  }
  let dependency: ApplyOutcome["dependency"] = "not-requested";
  try {
    for (const change of plan.changes) {
      if (options.signal?.aborted)
        throw new TemplateError("TEMPLATE_CANCELLED");
      if (
        fileFingerprint(await readFile(root, change.path)) !==
        fileFingerprint(change.before)
      )
        throw new TemplateError("TEMPLATE_PLAN_STALE");
      // Persist intended directory ownership before creation, so interruption is recoverable.
      const ancestors = change.path
        .split("/")
        .slice(0, -1)
        .map((_, i, parts) => parts.slice(0, i + 1).join("/"));
      for (const ancestor of ancestors)
        try {
          await fs.lstat(path.join(root, ancestor));
        } catch (cause) {
          if (!missing(cause)) throw cause;
          if (!journal.createdDirectories.includes(ancestor))
            journal.createdDirectories.push(ancestor);
        }
      await writeJournal(root, paths.journal, journal);
      await mkdirParents(root, change.path, []);
      await replace(root, change.path, change.after);
    }
    await replace(root, paths.baseline, {
      bytes: baselineBytes(plan.next),
      executable: false,
    });
    await fs.chmod(path.join(root, paths.baseline), 0o600);
    if (options.install) {
      dependency = "failed-or-unknown";
      journal.state = "installing";
      journal.dependency = dependency;
      await writeJournal(root, paths.journal, journal);
      const result = await options.install();
      if (result.exitCode !== 0)
        throw new TemplateError("TEMPLATE_DEPENDENCY_FAILED");
      dependency = "succeeded";
      journal.dependency = dependency;
    }
    if (options.signal?.aborted) throw new TemplateError("TEMPLATE_CANCELLED");
    journal.state = "complete";
    await writeJournal(root, paths.journal, journal);
    await fs.unlink(path.join(root, paths.journal));
    return { status: "applied", changed, dependency };
  } catch {
    const complete = await rollback(root, journal, paths);
    throw new TemplateApplyError("TEMPLATE_APPLY_FAILED", {
      status: complete ? "rolled-back" : "rollback-incomplete",
      changed,
      dependency,
    });
  }
}
/** Recovery never invokes a dependency installer or replays an apply operation. */
export async function recoverTemplateUpdate(
  root: string,
  id: TemplateId,
): Promise<ApplyOutcome> {
  root = await inspectRoot(root);
  const paths = metadata(id),
    file = await readFile(root, paths.journal, 384 * 1024 * 1024);
  if (!file)
    return { status: "no-op", changed: 0, dependency: "not-requested" };
  let journal: Journal;
  try {
    journal = JSON.parse(file.bytes.toString("utf8"));
  } catch {
    throw new TemplateError("TEMPLATE_JOURNAL_INVALID");
  }
  if (
    !journal ||
    journal.format !== 1 ||
    !["applying", "installing", "complete", "rollback-needed"].includes(
      journal.state,
    ) ||
    !["not-requested", "succeeded", "failed-or-unknown"].includes(
      journal.dependency,
    ) ||
    !Array.isArray(journal.changes) ||
    !Array.isArray(journal.createdDirectories)
  )
    throw new TemplateError("TEMPLATE_JOURNAL_INVALID");
  validateBaseline(journal.old);
  validateBaseline(journal.next);
  if (
    journal.old.identity.id !== id ||
    journal.next.identity.id !== id ||
    journal.old.identity.manager !== journal.next.identity.manager
  )
    throw new TemplateError("TEMPLATE_JOURNAL_INVALID");
  const owned = new Set([
    ...Object.keys(journal.old.files),
    ...Object.keys(journal.next.files),
  ]);
  const names = new Set<string>();
  for (const change of journal.changes) {
    validatePayloadPath(change.path, [
      ...journal.old.envExamples,
      ...journal.next.envExamples,
    ]);
    if (!owned.has(change.path) || names.has(change.path))
      throw new TemplateError("TEMPLATE_JOURNAL_INVALID");
    names.add(change.path);
    for (const value of [change.before, change.after])
      if (
        value !== null &&
        (!value ||
          typeof value.content !== "string" ||
          typeof value.executable !== "boolean" ||
          Buffer.from(value.content, "base64").toString("base64") !==
            value.content)
      )
        throw new TemplateError("TEMPLATE_JOURNAL_INVALID");
  }
  for (const directory of journal.createdDirectories)
    if (
      typeof directory !== "string" ||
      !journal.changes.some((c) => c.path.startsWith(directory + "/"))
    )
      throw new TemplateError("TEMPLATE_JOURNAL_INVALID");
  if (journal.state === "complete") {
    if (
      !(await readFile(root, paths.baseline, 96 * 1024 * 1024))?.bytes.equals(
        baselineBytes(journal.next),
      )
    )
      throw new TemplateError("TEMPLATE_RECOVERY_CONFLICT");
    for (const change of journal.changes)
      if (
        fileFingerprint(await readFile(root, change.path)) !==
        fileFingerprint(decoded(change.after))
      )
        throw new TemplateError("TEMPLATE_RECOVERY_CONFLICT");
    await fs.unlink(path.join(root, paths.journal));
    return {
      status: "applied",
      changed: journal.changes.length,
      dependency: journal.dependency,
    };
  }
  const complete = await rollback(root, journal, paths);
  return {
    status: complete ? "rolled-back" : "rollback-incomplete",
    changed: journal.changes.length,
    dependency: journal.dependency,
  };
}
