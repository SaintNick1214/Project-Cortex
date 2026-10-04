"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var generateDocs_exports = {};
__export(generateDocs_exports, {
  generateDocs: () => generateDocs,
  replaceBullets: () => replaceBullets
});
module.exports = __toCommonJS(generateDocs_exports);
function generateDocs(root) {
  const docs = {};
  const all = collectCommands(root, [root.name()]);
  let mainCommandPosition = 0;
  for (const entry of all) {
    if (entry.path.length !== 2) continue;
    const filePath = `${entry.path[1]}.mdx`;
    const sidebarPosition = ++mainCommandPosition;
    const summary = entry.command.summary() || entry.command.description() || "";
    const description = JSON.stringify(summary.replace(/\s+/g, " ").trim());
    const lines = [];
    const sidebarLabel = `npx ${entry.path.join(" ")}`;
    lines.push("---");
    lines.push(`sidebar_position: ${sidebarPosition}`);
    lines.push(`title: "${sidebarLabel}"`);
    lines.push(`sidebar_label: "${sidebarLabel}"`);
    lines.push(`description: ${description}`);
    lines.push("---");
    lines.push("");
    lines.push(
      "{/* @generated from the command definitions, do not edit manually (run `just regenerate-cli-docs` to regenerate) */}"
    );
    lines.push("");
    lines.push(renderCommand(entry, all, { headingLevel: 1 }));
    const descendants = all.filter(
      (e) => e.path.length > entry.path.length && entry.path.every((p, i) => e.path[i] === p)
    );
    for (const d of descendants) {
      lines.push(
        renderCommand(d, all, {
          headingLevel: d.path.length - 1,
          includeSubcommandsList: false
        })
      );
    }
    docs[filePath] = lines.join("\n");
  }
  return docs;
}
function collectCommands(command, path) {
  const result = [{ command, path }];
  for (const sub of command.commands) {
    if (sub._hidden) continue;
    if (sub.name() === "help") continue;
    result.push(...collectCommands(sub, [...path, sub.name()]));
  }
  return result;
}
function displayName(path) {
  return `npx ${path.join(" ")}`;
}
function commandUsage(command) {
  const args = command.registeredArguments ?? [];
  if (args.length === 0) {
    return command.usage();
  }
  const parts = ["[options]"];
  if (command.commands.length > 0) {
    parts.push("[command]");
  }
  for (const arg of args) {
    const name = `${arg._name}${arg.variadic ? "..." : ""}`;
    parts.push(arg.required ? `<${name}>` : `[${name}]`);
  }
  return parts.join(" ");
}
function anchorSlug(path) {
  return path.slice(2).join("-");
}
function subcommandLink(parentPath, subPath) {
  if (parentPath.length === 1) {
    return `./${subPath[1]}`;
  }
  return `#${anchorSlug(subPath)}`;
}
function renderCommand(entry, all, options) {
  const { headingLevel, includeSubcommandsList = true } = options;
  const h1 = "#".repeat(headingLevel);
  const h2 = "#".repeat(headingLevel + 1);
  const { command, path } = entry;
  const display = displayName(path);
  const description = renderCopyableCommands(
    escapeMdx(
      formatExampleLines(
        replaceBullets(command.description() || command.summary() || "")
      )
    )
  );
  const lines = [];
  const headingSuffix = headingLevel > 1 ? ` \\{#${anchorSlug(path)}}` : "";
  lines.push(`${h1} \`${display}\`${headingSuffix}`);
  lines.push("");
  if (description) {
    lines.push(description);
    lines.push("");
  }
  const usage = commandUsage(command);
  lines.push(`${h2} Syntax`);
  lines.push("");
  lines.push("```sh");
  lines.push(`${display} ${usage}`.trim());
  lines.push("```");
  lines.push("");
  const aliases = command.aliases();
  if (aliases.length > 0) {
    lines.push(`${h2} Aliases`);
    lines.push("");
    for (const alias of aliases) {
      lines.push(`- \`${alias}\``);
    }
    lines.push("");
  }
  const args = command.registeredArguments ?? [];
  if (args.length > 0) {
    lines.push(`${h2} Arguments`);
    lines.push("");
    lines.push("<dl>");
    for (const arg of args) {
      const name = arg.required ? `<${arg._name}>` : `[${arg._name}]`;
      const desc = escapeMdx(replaceBullets(arg.description || ""));
      lines.push(`<dt>\`${name}\`</dt>`);
      lines.push(`<dd>`);
      lines.push("");
      lines.push(desc);
      lines.push("");
      lines.push(`</dd>`);
    }
    lines.push("</dl>");
    lines.push("");
  }
  const opts = command.options.filter((o) => !o.hidden);
  if (opts.length > 0) {
    lines.push(`${h2} Options`);
    lines.push("");
    lines.push("<dl>");
    for (const opt of opts) {
      const flags = opt.flags;
      const desc = escapeMdx(replaceBullets(opt.description || ""));
      lines.push(`<dt>\`${flags}\`</dt>`);
      lines.push(`<dd>`);
      lines.push("");
      lines.push(desc);
      lines.push("");
      lines.push(`</dd>`);
    }
    lines.push("</dl>");
    lines.push("");
  }
  if (includeSubcommandsList) {
    const subEntries = all.filter(
      (e) => e.path.length === path.length + 1 && path.every((p, i) => e.path[i] === p)
    );
    if (subEntries.length > 0) {
      lines.push(`${h2} Subcommands`);
      lines.push("");
      for (const sub of subEntries) {
        const subDisplay = displayName(sub.path);
        const target = subcommandLink(path, sub.path);
        const subDesc = indentContinuation(
          escapeMdx(sub.command.summary() || sub.command.description() || "")
        );
        lines.push(`- [\`${subDisplay}\`](${target}) \u2014 ${subDesc}`.trimEnd());
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}
function escapeMdx(text) {
  return text.split(/(`[^`]*`)/).map(
    (segment, i) => (
      // Odd indices are the captured code spans; even indices are prose.
      i % 2 === 1 ? segment : segment.replace(/[<{]/g, (c) => `\\${c}`)
    )
  ).join("");
}
function renderCopyableCommands(text) {
  return text.split("\n").map(
    (line) => /^- /.test(line) ? line.replace(
      /`(npx convex [^`]*)`/g,
      (_, command) => `<CodeWithCopyButton text={${JSON.stringify(command)}} />`
    ) : line
  ).join("\n");
}
function replaceBullets(text) {
  return text.replace(/^( *)• /gm, "$1- ");
}
function formatExampleLines(text) {
  const lines = text.split("\n");
  const result = [];
  let blockLines = [];
  const flushBlock = () => {
    if (blockLines.length === 0) {
      return;
    }
    const prev = result[result.length - 1];
    const followsListItem = prev !== void 0 && isListItem(prev);
    const dedent = followsListItem ? 0 : Math.min(...blockLines.map(indentWidth));
    for (const blockLine of blockLines) {
      result.push(toListItem(blockLine.substring(dedent)));
    }
    blockLines = [];
  };
  for (const line of lines) {
    if (/^ {2,}\S/.test(line)) {
      blockLines.push(line);
    } else {
      flushBlock();
      result.push(line);
    }
  }
  flushBlock();
  return result.join("\n");
}
function indentWidth(line) {
  return line.length - line.trimStart().length;
}
function isListItem(line) {
  const content = line.trimStart();
  return content.startsWith("- ") || /^\d+\.\s/.test(content);
}
function toListItem(line) {
  if (isListItem(line)) {
    return line;
  }
  const indent = line.slice(0, indentWidth(line));
  return `${indent}- ${line.trimStart()}`;
}
function indentContinuation(text) {
  return text.replace(/\n/g, "\n  ");
}
//# sourceMappingURL=generateDocs.js.map
