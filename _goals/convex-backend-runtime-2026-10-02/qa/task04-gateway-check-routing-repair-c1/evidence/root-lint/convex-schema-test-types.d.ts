import type { GenericSchema } from "convex/server";

// Convex 1.46.0 implements SchemaDefinition.export(): string but strips this
// @internal method from its published declarations. Existing schema assertions
// call that actual method; this test-only declaration emits no runtime code.
declare module "convex/server" {
  interface SchemaDefinition<
    Schema extends GenericSchema,
    StrictTableTypes extends boolean,
  > {
    export(): string;
  }
}
