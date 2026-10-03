"use strict";
import { z } from "zod";
import { componentDefinitionPath, componentPath } from "./paths.js";
import { developerIndexConfig } from "./finishPush.js";
import { looseObject } from "./utils.js";
export const tableValidationOutcome = z.enum([
  "notValidated",
  "supersetOfEnforced",
  "supersetOfShape",
  "mustWalk"
]);
export const indexChangePrediction = z.enum([
  "added",
  "identical",
  "enabled",
  "disabled",
  "dropped"
]);
export const tablePrediction = looseObject({
  name: z.string(),
  outcome: tableValidationOutcome,
  numDocs: z.number(),
  sizeBytes: z.number()
});
export const indexPrediction = z.intersection(
  developerIndexConfig,
  looseObject({
    change: indexChangePrediction,
    needsBackfill: z.boolean(),
    numDocs: z.number()
  })
);
export const componentSchemaPrediction = looseObject({
  definitionPath: z.string(),
  schemaValidation: z.boolean(),
  tables: z.array(tablePrediction),
  indexes: z.array(indexPrediction)
});
export const evaluateSchemaResponse = looseObject({
  componentSchemaEvaluations: z.record(
    componentPath,
    componentSchemaPrediction
  ),
  newComponentDefinitions: z.array(componentDefinitionPath)
});
//# sourceMappingURL=evaluateSchema.js.map
