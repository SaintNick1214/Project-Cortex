"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import {
  isValidator,
  v
} from "../values/validator.js";
export class TableDefinition {
  /**
   * @internal
   */
  constructor(documentType) {
    __publicField(this, "indexes");
    __publicField(this, "stagedDbIndexes");
    __publicField(this, "searchIndexes");
    __publicField(this, "stagedSearchIndexes");
    __publicField(this, "vectorIndexes");
    __publicField(this, "stagedVectorIndexes");
    // The type of documents stored in this table.
    __publicField(this, "validator");
    // The proposed next validator for this table, validated against existing
    // documents in the background while `validator` remains enforced.
    __publicField(this, "stagedValidator");
    this.indexes = [];
    this.stagedDbIndexes = [];
    this.searchIndexes = [];
    this.stagedSearchIndexes = [];
    this.vectorIndexes = [];
    this.stagedVectorIndexes = [];
    this.validator = documentType;
  }
  /**
   * This API is experimental: it may change or disappear.
   *
   * Returns indexes defined on this table.
   * Intended for the advanced use cases of dynamically deciding which index to use for a query.
   * If you think you need this, please chime in on ths issue in the Convex JS GitHub repo.
   * https://github.com/get-convex/convex-js/issues/49
   */
  " indexes"() {
    return this.indexes;
  }
  index(name, indexConfig) {
    if (Array.isArray(indexConfig)) {
      this.indexes.push({
        indexDescriptor: name,
        fields: indexConfig
      });
    } else if (indexConfig.staged) {
      this.stagedDbIndexes.push({
        indexDescriptor: name,
        fields: indexConfig.fields
      });
    } else {
      this.indexes.push({
        indexDescriptor: name,
        fields: indexConfig.fields
      });
    }
    return this;
  }
  searchIndex(name, indexConfig) {
    if (indexConfig.staged) {
      this.stagedSearchIndexes.push({
        indexDescriptor: name,
        searchField: indexConfig.searchField,
        filterFields: indexConfig.filterFields || []
      });
    } else {
      this.searchIndexes.push({
        indexDescriptor: name,
        searchField: indexConfig.searchField,
        filterFields: indexConfig.filterFields || []
      });
    }
    return this;
  }
  vectorIndex(name, indexConfig) {
    if (indexConfig.staged) {
      this.stagedVectorIndexes.push({
        indexDescriptor: name,
        vectorField: indexConfig.vectorField,
        dimensions: indexConfig.dimensions,
        filterFields: indexConfig.filterFields || []
      });
    } else {
      this.vectorIndexes.push({
        indexDescriptor: name,
        vectorField: indexConfig.vectorField,
        dimensions: indexConfig.dimensions,
        filterFields: indexConfig.filterFields || []
      });
    }
    return this;
  }
  /**
   * Stage a new document validator for this table.
   *
   * Convex validates the staged validator against the table's existing
   * documents in the background, while the validator passed to
   * {@link defineTable} remains the one enforced on reads and writes. Once
   * the background validation succeeds, make the staged validator the
   * table's validator and remove `.staged()`.
   *
   * ```ts
   * defineTable({
   *   author: v.string(),
   * }).staged({
   *   author: v.array(v.string()),
   * })
   * ```
   *
   * TODO: link a worked staged-schema example from the docs once one exists.
   *
   * @param documentSchema - The proposed next type of documents stored in
   * this table, as an object of field validators or a schema validator.
   * @returns A {@link TableDefinition} with the staged validator attached.
   *
   * @internal
   */
  staged(documentSchema) {
    if (this.stagedValidator !== void 0) {
      throw new Error("Table cannot have more than one staged validator.");
    }
    this.stagedValidator = isValidator(documentSchema) ? documentSchema : v.object(documentSchema);
    return this.self();
  }
  /**
   * Work around for https://github.com/microsoft/TypeScript/issues/57035
   */
  self() {
    return this;
  }
  /**
   * Export the contents of this definition.
   *
   * This is called internally by the Convex framework.
   * @internal
   */
  export() {
    const documentType = this.validator.json;
    if (typeof documentType !== "object") {
      throw new Error(
        "Invalid validator: please make sure that the parameter of `defineTable` is valid (see https://docs.convex.dev/database/schemas)"
      );
    }
    let stagedDocumentType = void 0;
    if (this.stagedValidator !== void 0) {
      stagedDocumentType = this.stagedValidator.json;
      if (typeof stagedDocumentType !== "object") {
        throw new Error(
          "Invalid staged validator: please make sure that the parameter of `.staged()` is valid (see https://docs.convex.dev/database/schemas)"
        );
      }
    }
    return {
      indexes: this.indexes,
      stagedDbIndexes: this.stagedDbIndexes,
      searchIndexes: this.searchIndexes,
      stagedSearchIndexes: this.stagedSearchIndexes,
      vectorIndexes: this.vectorIndexes,
      stagedVectorIndexes: this.stagedVectorIndexes,
      documentType,
      stagedDocumentType
    };
  }
}
export function defineTable(documentSchema) {
  if (isValidator(documentSchema)) {
    return new TableDefinition(documentSchema);
  } else {
    return new TableDefinition(v.object(documentSchema));
  }
}
function addSystemFields(tableName, validator) {
  switch (validator.kind) {
    case "object":
      return validator.extend({
        _id: v.id(tableName),
        _creationTime: v.number()
      });
    case "union":
      return v.union(
        ...validator.members.map(
          (member) => addSystemFields(tableName, member)
        )
      );
    // `v.any()` already permits the system fields.
    case "any":
      return validator;
    default:
      throw new Error(
        `Invalid validator for table "${tableName}": a table's documents must be objects, or a union of objects (see https://docs.convex.dev/database/schemas)`
      );
  }
}
export function docValidator(tableName, table) {
  return addSystemFields(tableName, table.validator);
}
function tableInSchema(schema, tableName) {
  const table = schema.tables[tableName];
  if (table === void 0) {
    throw new Error(
      `Table "${tableName}" is not in this schema. Tables in this schema: ${Object.keys(
        schema.tables
      ).join(", ")}`
    );
  }
  return table;
}
export class SchemaDefinition {
  /**
   * @internal
   */
  constructor(tables, options) {
    __publicField(this, "tables");
    __publicField(this, "strictTableNameTypes");
    __publicField(this, "schemaValidation");
    this.tables = tables;
    this.schemaValidation = options?.schemaValidation === void 0 ? true : options.schemaValidation;
  }
  /**
   * The validator for whole documents of a table in this schema: the table's
   * own validator with the `_id` and `_creationTime` system fields added.
   *
   * @example
   * ```ts
   * export const get = query({
   *   args: { id: schema.id("messages") },
   *   returns: v.union(schema.doc("messages"), v.null()),
   *   handler: (ctx, args) => ctx.db.get(args.id),
   * });
   * ```
   *
   * @param tableName - The name of a table in this schema.
   * @returns A validator matching documents of that table.
   */
  doc(tableName) {
    return docValidator(tableName, tableInSchema(this, tableName));
  }
  /**
   * The validator for IDs of a table in this schema.
   *
   * Same as `v.id(tableName)`, but only accepts tables in this schema.
   *
   * @param tableName - The name of a table in this schema.
   * @returns A validator matching IDs of that table.
   */
  id(tableName) {
    tableInSchema(this, tableName);
    return v.id(tableName);
  }
  /**
   * Export the contents of this definition.
   *
   * This is called internally by the Convex framework.
   * @internal
   */
  export() {
    return JSON.stringify({
      tables: Object.entries(this.tables).map(([tableName, definition]) => {
        const {
          indexes,
          stagedDbIndexes,
          searchIndexes,
          stagedSearchIndexes,
          vectorIndexes,
          stagedVectorIndexes,
          documentType,
          stagedDocumentType
        } = definition.export();
        return {
          tableName,
          indexes,
          stagedDbIndexes,
          searchIndexes,
          stagedSearchIndexes,
          vectorIndexes,
          stagedVectorIndexes,
          documentType,
          stagedDocumentType
        };
      }),
      schemaValidation: this.schemaValidation
    });
  }
}
export function defineSchema(schema, options) {
  return new SchemaDefinition(schema, options);
}
const _systemSchema = defineSchema({
  _scheduled_functions: defineTable({
    name: v.string(),
    args: v.array(v.any()),
    scheduledTime: v.float64(),
    completedTime: v.optional(v.float64()),
    state: v.union(
      v.object({ kind: v.literal("pending") }),
      v.object({ kind: v.literal("inProgress") }),
      v.object({ kind: v.literal("success") }),
      v.object({ kind: v.literal("failed"), error: v.string() }),
      v.object({ kind: v.literal("canceled") })
    )
  }),
  _storage: defineTable({
    sha256: v.string(),
    size: v.float64(),
    contentType: v.optional(v.string())
  })
});
//# sourceMappingURL=schema.js.map
