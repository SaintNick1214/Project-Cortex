/** App-private tables remain independent; runtime install adds its digest-bound table map. */
import { defineSchema } from "convex/server";
import appSchema from "./app.schema";
export default defineSchema(
  { ...appSchema.tables },
  { schemaValidation: true, strictTableNameTypes: true }
);
