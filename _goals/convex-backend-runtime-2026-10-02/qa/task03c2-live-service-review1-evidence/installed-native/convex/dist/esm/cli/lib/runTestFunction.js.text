"use strict";
import { deploymentFetch } from "./utils/utils.js";
const QUERY_MODULE_PREAMBLE = 'import { query, internalQuery } from "convex:/_system/repl/wrappers.js";';
export const RUN_ONEOFF_QUERY_SOURCE_DESCRIPTION = 'JavaScript module source for a single file (testQuery.js) that exports a default readonly query, for example: export default query({ handler: async (ctx) => ({ count: (await ctx.db.query("messages").take(10)).length }) });';
export const INLINE_QUERY_DESCRIPTION = [
  "JavaScript to evaluate as a readonly query. The query is completely sandboxed, so it can only read data and cannot modify the database or access the network.",
  "",
  "This is a one-shot query and cannot be combined with `--watch`.",
  "Use `--component` to target a mounted component.",
  "",
  "To format the query:",
  '\u2022 Simple expressions are returned automatically, for example: `await ctx.db.query("messages").take(5)`.',
  '\u2022 For multi-statement queries, use an explicit return, for example: `const firstMessage = await ctx.db.query("messages").first(); console.log(firstMessage?._id); return firstMessage;`.',
  '\u2022 For full control, pass a module source that exports a default query, for example: `export default query({ handler: async (ctx) => { return await ctx.db.query("messages").take(10); } })`.'
].join("\n");
export function inlineQueryToQuerySource(inlineQuery) {
  const trimmedQuery = inlineQuery.trim();
  if (looksLikeQueryModuleSource(trimmedQuery)) {
    return injectQueryModulePreamble(trimmedQuery);
  }
  const queryBody = inlineQueryBody(trimmedQuery);
  return `${QUERY_MODULE_PREAMBLE}

export default query({
  handler: async (ctx) => {
${indent(queryBody, 4)}
  },
});`;
}
export async function runTestFunctionQuery(ctx, args) {
  const fetchDeployment = deploymentFetch(ctx, {
    deploymentUrl: args.deploymentUrl,
    adminKey: args.adminKey
  });
  const response = await fetchDeployment("/api/run_test_function", {
    method: "POST",
    body: JSON.stringify({
      adminKey: args.adminKey,
      args: {},
      bundle: {
        path: "testQuery.js",
        source: args.querySource
      },
      format: "convex_encoded_json",
      ...args.componentId !== void 0 ? { componentId: args.componentId } : {}
    })
  });
  const result = await response.json();
  if (typeof result !== "object" || result === null || !("status" in result) || result.status !== "success") {
    return { kind: "applicationFailure", payload: result };
  }
  const ok = result;
  return {
    kind: "success",
    value: ok.value,
    logLines: ok.logLines ?? []
  };
}
function looksLikeQueryModuleSource(querySource) {
  if (!querySource.includes("export default")) return false;
  return /\b(?:query|internalQuery)\s*\(/.test(querySource);
}
function injectQueryModulePreamble(querySource) {
  if (querySource.includes("convex:/_system/repl/wrappers.js"))
    return querySource;
  return `${QUERY_MODULE_PREAMBLE}

${querySource}`;
}
function inlineQueryBody(inlineQuery) {
  const trimmed = inlineQuery.trim();
  if (!isExpression(trimmed)) return trimmed;
  return `return (${trimmed.replace(/;$/, "")});`;
}
function isExpression(inlineQuery) {
  if (inlineQuery.includes("\n")) return false;
  return !/^(const|let|var|if|for|while|switch|try|throw|return)\b/.test(
    inlineQuery
  );
}
function indent(text, spaces) {
  const prefix = " ".repeat(spaces);
  return text.split("\n").map((line) => `${prefix}${line}`).join("\n");
}
//# sourceMappingURL=runTestFunction.js.map
