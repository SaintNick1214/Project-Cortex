import { cortexTablesV1 } from "./_cortex/schema";
/** App-private tables remain independent; runtime install adds its digest-bound table map. */
import { defineSchema } from "convex/server";
import appSchema from "./app.schema";
export default defineSchema(
  {
  ...cortexTablesV1, ...appSchema.tables },
  { schemaValidation: true, strictTableNameTypes: true }
);
