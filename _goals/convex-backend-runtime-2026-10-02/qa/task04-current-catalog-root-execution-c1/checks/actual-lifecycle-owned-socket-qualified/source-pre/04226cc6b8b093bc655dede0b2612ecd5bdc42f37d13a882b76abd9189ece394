import type { GenericSchema } from "convex/server";

// Convex 1.46.0 implements SchemaDefinition.export(): string but strips this
// @internal method from its published declarations. Existing schema assertions
// call that actual method; this test-only declaration emits no runtime code.
declare module "convex/server" {
  interface SchemaDefinition<
    // Match the upstream declaration's required generic parameters exactly.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Schema extends GenericSchema,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    StrictTableTypes extends boolean,
  > {
    export(): string;
  }
}
