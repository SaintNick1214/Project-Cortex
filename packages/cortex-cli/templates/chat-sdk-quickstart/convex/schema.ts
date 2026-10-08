// Managed canonical composition v1. App and SDK update channels are independent.
import { defineSchema } from "convex/server";
import cortexSchema from "./cortex.schema";
import appSchema from "./app.schema";

if (cortexSchema.schemaValidation !== true || appSchema.schemaValidation !== true) {
  throw new Error("Canonical schemas must enable schema validation");
}
for (const name of Object.keys(cortexSchema.tables)) {
  if (Object.prototype.hasOwnProperty.call(appSchema.tables, name)) {
    throw new Error(`Duplicate canonical table: ${name}`);
  }
}
export default defineSchema(
  { ...cortexSchema.tables, ...appSchema.tables },
  { schemaValidation: true, strictTableNameTypes: true },
);
