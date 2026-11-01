// App schema remains caller-owned. The 1.3 runtime installer adds cortexTablesV1.
import { defineSchema } from "convex/server";
import appSchema from "./app.schema";

export default defineSchema(
  { ...appSchema.tables },
  { schemaValidation: true, strictTableNameTypes: true },
);
