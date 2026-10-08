/** Actual registry, shell callbacks and isolated completion command execution. */
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createProgram } from "../../src/program.js";

const cli = fileURLToPath(new URL("../../", import.meta.url));
const executable = process.env.CORTEX_COMPLETION_TEST_CLI ?? path.join(cli, "dist/index.js");
const assets = path.join(cli, "scripts/completions");
const retired = new Set([
  "stop", "config enable", "config disable", "db clear", "db backup", "db restore", "convex init",
]);
const program = createProgram({ deployments: {}, default: "", format: "table", confirmDangerous: true });
const contexts: { name: string; children: string[]; options: string[]; values: string[] }[] = [];
function collect(command: typeof program, name = ""): void {
  if (retired.has(name) || name === "snapshot" || name.startsWith("snapshot ")) return;
  const children = command.commands.filter(child => !retired.has(`${name} ${child.name()}`.trim()) && child.name() !== "snapshot");
  const options = command.options.filter(option => !/retired|deprecated|unsupported/i.test(option.description));
  contexts.push({
    name,
    children: children.map(child => child.name()),
    options: [...new Set(["-h", "--help", ...options.flatMap(option => [option.short, option.long].filter((flag): flag is string => !!flag))])],
    values: [...new Set(options.filter(option => option.required || option.optional).flatMap(option => [option.short, option.long].filter((flag): flag is string => !!flag)))],
  });
  for (const child of children) collect(child, `${name} ${child.name()}`.trim());
}
collect(program);
let root: string;
const sentinels = [".bashrc", ".zshrc", ".config/fish/config.fish", ".env.local"];
const before: Record<string, { bytes: Buffer; mode: number }> = {};
const environment = () => ({ PATH: process.env.PATH, HOME: root, TMPDIR: root, CORTEX_TEST_HOME_ROOT: root });
const run = (command: string, args: string[]) => spawnSync(command, args, {
  cwd: root, env: environment(), input: "", encoding: "utf8", timeout: 15000, maxBuffer: 2 * 1024 * 1024,
});
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-completion-"));
  for (const name of sentinels) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `completion sentinel: ${name}\n`, { mode: 0o600 });
    before[name] = { bytes: fs.readFileSync(file), mode: fs.statSync(file).mode };
  }
});
afterAll(() => {
  try {
    for (const name of sentinels) {
      expect(fs.readFileSync(path.join(root, name))).toEqual(before[name].bytes);
      expect(fs.statSync(path.join(root, name)).mode).toBe(before[name].mode);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

describe("current shell completion", () => {
  it.each(["bash", "zsh", "fish"])("%s syntax and executable lookup match every supported registry context", shell => {
    const asset = path.join(assets, `cortex.${shell}`);
    const syntax = run(shell, ["-n", asset]);
    expect(syntax.error).toBeUndefined();
    expect(syntax.status).toBe(0);
    const query = shell === "fish"
      ? 'source "$argv[1]"; for context in $argv[2..-1]; set -l child (_cortex_children "$context"); set -l flags (_cortex_options "$context"); set -l values (_cortex_value_options "$context"); printf "%s|%s|%s|%s\\n" "$context" "$child" "$flags" "$values"; end'
      : `${shell === "zsh" ? "compdef() { :; }; " : ""}source "$1"; shift; for context in "$@"; do printf '%s|%s|%s|%s\\n' "$context" "$(_cortex_children "$context")" "$(_cortex_options "$context")" "$(_cortex_value_options "$context")"; done`;
    const queried = run(shell, ["-c", query, ...(shell === "fish" ? [] : ["completion-query"]), asset, ...contexts.map(context => context.name)]);
    expect(queried.error).toBeUndefined();
    expect(queried.status).toBe(0);
    const rows = queried.stdout.trimEnd().split("\n");
    expect(rows).toHaveLength(contexts.length);
    rows.forEach((row, index) => {
      const [name, children, options, values] = row.split("|");
      expect(name).toBe(contexts[index].name);
      expect(children.split(" ").filter(Boolean)).toEqual(contexts[index].children);
      expect(new Set(options.split(" ").filter(Boolean))).toEqual(new Set(contexts[index].options));
      expect(new Set(values.split(" ").filter(Boolean))).toEqual(new Set(contexts[index].values));
    });
  });

  it.each([
    [["cortex", ""], "templates"],
    [["cortex", "--format", "json", "templates", ""], "update"],
    [["cortex", "--scope-user", "templates", "--tenant", "tenant-a", "templates", "update", "--r"], "--recover"],
    [["cortex", "-dlocal", "templates", "update", "--y"], "--yes"],
    [["cortex", "templates", "init", "demo", "--template", "chat"], "chat-sdk"],
    [["cortex", "init", "--template", "n"], "none"],
    [["cortex", "graph", "setup", "--graph=n"], "--graph=neo4j"],
    [["cortex", "status", "--format", "d"], "dashboard"],
    [["cortex", "conversations", "export", "id", "--format", "t"], "txt"],
    [["cortex", "completion", "f"], "fish"],
  ] as [string[], string][])("Bash completes %j to %s", (words, expected) => {
    const result = run("bash", ["-c", 'source "$1"; shift; COMP_WORDS=("$@"); COMP_CWORD=$((${#COMP_WORDS[@]}-1)); _cortex; printf "%s\\n" "${COMPREPLY[@]}"', "completion-case", path.join(assets, "cortex.bash"), ...words]);
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split("\n")).toContain(expected);
  });

  it.each([
    ["cortex --format json templates update --r", "--recover"],
    ["cortex templates init demo --template chat", "chat-sdk"],
    ["cortex graph setup --graph=n", "--graph=neo4j"],
    ["cortex conversations export id --format t", "txt"],
  ])("Fish completes %s to %s", (commandline, expected) => {
    const result = run("fish", ["-c", 'source "$argv[1]"; complete -C "$argv[2]"', path.join(assets, "cortex.fish"), commandline]);
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split("\n").map(line => line.split("\t")[0])).toContain(expected);
  });

  it.each(["bash", "zsh", "fish"])("actual completion %s emits its exact selected asset without changing shell/private files", shell => {
    const result = run(process.execPath, [executable, "completion", shell]);
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(fs.readFileSync(path.join(assets, `cortex.${shell}`), "utf8") + "\n");
    expect(result.stderr).toBe("");
  });

  it("an unsupported shell exits nonzero without an asset or success output", () => {
    const result = run(process.execPath, [executable, "completion", "unsupported-shell"]);
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Unknown shell: unsupported-shell");
  });
});
