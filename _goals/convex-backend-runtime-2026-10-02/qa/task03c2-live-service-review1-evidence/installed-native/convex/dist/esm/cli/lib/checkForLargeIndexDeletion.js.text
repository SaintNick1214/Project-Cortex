"use strict";
import { chalkStderr } from "chalk";
import {
  changeSpinner,
  logFinishedStep,
  logMessage,
  logVerbose,
  stopSpinner
} from "../../bundler/log.js";
import { formatIndex } from "./indexes.js";
import { promptYesNo } from "./utils/prompts.js";
import { evaluatePush, evaluateSchema } from "./deploy2.js";
import { runSystemQuery } from "./run.js";
const MIN_DOCUMENTS_FOR_INDEX_DELETE_WARNING = 1e5;
export async function checkForLargeIndexDeletion({
  ctx,
  span,
  request,
  options,
  askForConfirmation
}) {
  changeSpinner("Verifying that the push isn\u2019t deleting large indexes...");
  const deletedIndexes = await deletedIndexesFromSchemaEvaluation({
    ctx,
    span,
    request,
    options
  }) ?? await deletedIndexesFromTableSizes({ ctx, span, request, options });
  if (deletedIndexes.length === 0) {
    logFinishedStep("No indexes are deleted by this push");
    return;
  }
  const minDocumentsForWarning = minDocumentsForIndexDeleteWarning();
  if (!deletedIndexes.some(
    ({ documentsCount }) => documentsCount >= minDocumentsForWarning
  )) {
    logFinishedStep("No large indexes are deleted by this push");
    return;
  }
  logMessage(`\u26A0\uFE0F  This code push will ${chalkStderr.bold("delete")} the following ${deletedIndexes.length === 1 ? "index" : "indexes"}
from your production deployment (${options.url}):

${deletedIndexes.map(
    (deletedIndex) => formatDeletedIndex({ ...deletedIndex, minDocumentsForWarning })
  ).join("\n")}

The documents that are in the index won\u2019t be deleted, but the index will need
to be backfilled again if you want to restore it later.
`);
  if (!askForConfirmation) {
    logFinishedStep(
      "Proceeding with push since --allow-deleting-large-indexes is set"
    );
    return;
  }
  if (!process.stdin.isTTY) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `To confirm the push:
\u2022 run the deploy command in an ${chalkStderr.bold("interactive terminal")}
\u2022 or run the deploy command with the ${chalkStderr.bold("--allow-deleting-large-indexes")} flag`
    });
  }
  stopSpinner();
  if (!await promptYesNo(ctx, {
    message: `Delete ${deletedIndexes.length === 1 ? "this index" : "these indexes"}?`,
    default: false
  })) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Canceling push`
    });
  }
  logFinishedStep("Proceeding with push.");
}
export async function deletedIndexesFromSchemaEvaluation({
  ctx,
  span,
  request,
  options
}) {
  try {
    const response = await evaluateSchema(
      ctx,
      span,
      request,
      options,
      /* bestEffort */
      true
    );
    return Object.entries(response.componentSchemaEvaluations).flatMap(
      ([componentPath, prediction]) => prediction.indexes.filter((index) => index.change === "dropped").map((index) => ({
        componentPath,
        index,
        documentsCount: index.numDocs,
        replacedBy: prediction.indexes.find(
          (other) => other.change === "added" && other.name === index.name
        ) ?? null
      }))
    );
  } catch (error) {
    logVerbose(
      `Schema evaluation unavailable, sizing deleted indexes per table: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
export async function deletedIndexesFromTableSizes({
  ctx,
  span,
  request,
  options
}) {
  const { schemaChange } = await evaluatePush(ctx, span, request, options);
  const indexDiffs = schemaChange.indexDiffs ?? {};
  const deletedIndexes = Object.entries(indexDiffs).flatMap(
    ([componentPath, indexDiff]) => indexDiff.removed_indexes.map((index) => ({
      componentPath,
      index,
      replacedBy: indexDiff.added_indexes.find((other) => other.name === index.name) ?? null
    }))
  );
  if (deletedIndexes.length === 0) {
    return [];
  }
  const tablesWithDeletedIndexes = [
    ...new Set(
      deletedIndexes.map(
        ({ componentPath, index }) => `${componentPath}:${getTableName(index)}`
      )
    )
  ].map((str) => {
    const [componentPath, table] = str.split(":");
    return { componentPath, table };
  });
  changeSpinner("Checking whether the deleted indexes are on large tables...");
  const documentCounts = await Promise.all(
    tablesWithDeletedIndexes.map(async ({ componentPath, table }) => ({
      componentPath,
      table,
      count: await runSystemQuery(ctx, {
        deploymentUrl: options.url,
        adminKey: options.adminKey,
        functionName: "_system/cli/tableSize:default",
        componentPath,
        args: { tableName: table }
      })
    }))
  );
  return deletedIndexes.map(({ componentPath, index, replacedBy }) => ({
    componentPath,
    index,
    replacedBy,
    documentsCount: documentCounts.find(
      (count) => count.table === getTableName(index) && count.componentPath === componentPath
    ).count
  }));
}
function formatDeletedIndex({
  componentPath,
  index,
  documentsCount,
  replacedBy,
  minDocumentsForWarning
}) {
  const componentNameFormatted = componentPath !== "" ? `${chalkStderr.gray(componentPath)}:` : "";
  const documentsCountFormatted = documentsCount >= minDocumentsForWarning ? `  ${chalkStderr.yellowBright(`\u26A0\uFE0F  ${documentsCount.toLocaleString()} documents`)}` : `  ${documentsCount.toLocaleString()} ${documentsCount === 1 ? "document" : "documents"}`;
  const replacedByFormatted = replacedBy ? `
   ${chalkStderr.green("\u2192 replaced by:")} ${formatIndex(replacedBy)}` : "";
  return "\u26D4 " + componentNameFormatted + formatIndex(index) + documentsCountFormatted + replacedByFormatted;
}
function getTableName(index) {
  const [tableName, _indexName] = index.name.split(".");
  return tableName;
}
function minDocumentsForIndexDeleteWarning() {
  const envValue = process.env.CONVEX_MIN_DOCUMENTS_FOR_INDEX_DELETE_WARNING;
  if (envValue !== void 0) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return MIN_DOCUMENTS_FOR_INDEX_DELETE_WARNING;
}
//# sourceMappingURL=checkForLargeIndexDeletion.js.map
