"use strict";
import { chalkStderr } from "chalk";
import { logMessage, logVerbose } from "../../bundler/log.js";
import { evaluateSchema } from "./deploy2.js";
import { formatSize } from "./utils/utils.js";
const MIN_BYTES_FOR_SCHEMA_WALK_WARNING = 1 << 27;
export async function checkForSlowSchemaValidation({
  ctx,
  span,
  request,
  options
}) {
  const response = await evaluateSchemaBestEffort({
    ctx,
    span,
    request,
    options
  });
  if (response === null) {
    return;
  }
  const walkedTables = Object.entries(
    response.componentSchemaEvaluations
  ).flatMap(
    ([componentPath, prediction]) => prediction.tables.filter((table) => table.outcome === "mustWalk").map((table) => ({ componentPath, table }))
  );
  if (walkedTables.length === 0) {
    return;
  }
  const totalBytes = walkedTables.reduce(
    (sum, { table }) => sum + table.sizeBytes,
    0
  );
  if (totalBytes < minBytesForSchemaWalkWarning()) {
    return;
  }
  logMessage(`\u26A0\uFE0F  This schema change requires checking every document in the following ${walkedTables.length === 1 ? "table" : "tables"} against your new schema, totaling ${chalkStderr.yellowBright(formatSize(totalBytes))}. This deploy may take a while:

${walkedTables.map(
    ({ componentPath, table }) => formatWalkedTable({ componentPath, table })
  ).join("\n")}
`);
}
async function evaluateSchemaBestEffort({
  ctx,
  span,
  request,
  options
}) {
  try {
    return await evaluateSchema(
      ctx,
      span,
      request,
      options,
      /* bestEffort */
      true
    );
  } catch (error) {
    logVerbose(
      `Skipping slow schema validation check: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
function formatWalkedTable({
  componentPath,
  table
}) {
  const componentPrefix = componentPath !== "" ? `${chalkStderr.gray(componentPath)}: ` : "";
  const docsFormatted = `${table.numDocs.toLocaleString()} documents, `;
  const sizeFormatted = formatSize(table.sizeBytes);
  return `  ${componentPrefix}${table.name} (${docsFormatted}${sizeFormatted})`;
}
function minBytesForSchemaWalkWarning() {
  const envValue = process.env.CONVEX_MIN_BYTES_FOR_SCHEMA_WALK_WARNING;
  if (envValue !== void 0) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return MIN_BYTES_FOR_SCHEMA_WALK_WARNING;
}
//# sourceMappingURL=checkForSlowSchemaValidation.js.map
