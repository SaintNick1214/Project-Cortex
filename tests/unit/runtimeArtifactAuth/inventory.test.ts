import "./accepted-reader-compat";
import { expect, test } from "@jest/globals";
import fs from "node:fs";
import { backendSource, catalogDeclarations, catalogFixture, catalogInventory, sha256, withComposedCatalog } from "../../helpers/backend-catalog";
import * as artifacts from "../../../convex-dev/artifacts";
import { fixture, selected } from "./fixture";
import { ConvexError, type Value } from "convex/values";

type Native = { isPublic?: boolean; isInternal?: boolean; isMutation?: boolean; exportArgs(): string };
const internal = new Set(["purgeAll", "setFileRef", "generateArtifactUploadUrl", "getArtifactFileUrl"]);
const expected = new Set([...selected, ...internal, "completeArtifactUpload", "detachFile", "attachAsset"]);
type Validator = { type: string; value?: unknown; tableName?: string };
function sample(v: Validator): unknown {
  if (v.type === "string") return "fixture";
  if (v.type === "number") return 1;
  if (v.type === "boolean") return false;
  if (v.type === "literal") return v.value;
  if (v.type === "null") return null;
  if (v.type === "id") return `${v.tableName}:fixture`;
  if (v.type === "any") return {};
  if (v.type === "array") return [sample(v.value as Validator)];
  if (v.type === "union") return sample((v.value as Validator[])[0]);
  if (v.type === "object") return Object.fromEntries(Object.entries(v.value as Record<string, { fieldType: Validator; optional: boolean }>).filter(([, value]) => !value.optional).map(([key, value]) => [key, sample(value.fieldType)]));
  throw new Error(`Unsupported native validator ${v.type}`);
}

test("current actual artifact registrations expose guarded mutations and internal raw-storage helpers", async () => {
  const calls = Object.entries(artifacts).map(([name, registration]) => ({ name, registration: registration as unknown as Native }));
  expect(new Set(calls.map(call => call.name))).toEqual(expected);
  expect(calls).toHaveLength(28);
  expect(calls.filter(call => call.registration.isPublic)).toHaveLength(24);
  for (const { name, registration } of calls) {
    expect(!!registration.isInternal).toBe(internal.has(name));
    expect(!!registration.isPublic).toBe(!internal.has(name));
    if (internal.has(name)) continue;
    expect(registration.isMutation).toBe(true);
    const validators = JSON.parse(registration.exportArgs()) as Validator;
    const fields = validators.value as Record<string, { fieldType: Validator; optional: boolean }>;
    expect(fields.tenantId).toEqual({ fieldType: { type: "string" }, optional: true });
    expect(fields.memorySpaceId.fieldType).toEqual({ type: "string" });
    expect(typeof fields.memorySpaceId.optional).toBe("boolean");
    const f = fixture(); f.identity(null);
    const error = await f.invoke(name, sample(validators) as Record<string, unknown>).then(() => undefined, (failure: unknown) => failure);
    expect(error).toBeInstanceOf(ConvexError);
    expect((error as ConvexError<Value>).data).toMatchObject({ version: 1, code: "UNAUTHENTICATED", retryable: false, outcome: "not_dispatched" });
    expect(f.db.writes).toEqual([]); expect(f.db.attempts).toEqual([]);
  }
});

test("the archived original inventory remains historical evidence, independent of current source bytes", () => {
  const original = "_goals/convex-backend-runtime-2026-10-02/qa/task03b2f-asset-foundation/original/native-validators17.json";
  const archived = JSON.parse(fs.readFileSync(original, "utf8")) as { registrations: { path: string }[] };
  expect(archived.registrations).toHaveLength(17);
  expect(archived.registrations.some(row => row.path === "attachments:create")).toBe(false);
  expect(archived.registrations.some(row => row.path === "artifacts:completeArtifactUpload")).toBe(true);
});

test("portable historical inventory remains immutable while current composition includes later guarded registrations", async () => {
  const historical = catalogFixture<{
    classification: string; counts: Record<string, number>; negativeControls: number;
    inventory: { counts: Record<string, number>; endpoints: { accepted03ADisposition: string }[]; frozenFilePaths: { path: string; unchanged: boolean }[] };
  }>("artifact-inventory-historical.json");
  expect(historical.classification).toBe("HISTORICAL_ACCEPTED_TEXT_ARTIFACT_ONLY");
  expect(historical.counts).toEqual({ selected22: 22, approvedLaterFileDeclarations: 5, approvedLaterStats: 2, artifactModuleRegistrations: 27, registryModuleRegistrations: 48 });
  expect(historical.negativeControls).toBe(4);
  const result = historical.inventory;
  expect(result.counts).toEqual({ registered: 22, public: 21, internal: 1, unresolved: 0, pendingFileRegistrations: 5 });
  expect(result.endpoints.every(row => ["guard", "internalize"].includes(row.accepted03ADisposition))).toBe(true);
  expect(result.frozenFilePaths).toHaveLength(5);
  expect(result.frozenFilePaths.every(row => row.unchanged)).toBe(true);
  await withComposedCatalog((_directory, files) => {
    const artifactSource = files["artifacts.ts"].toString();
    expect(artifactSource).toBe(backendSource("artifacts"));
    const inventory = catalogInventory({ artifacts: artifactSource });
    expect(inventory.completeness.unresolved).toEqual([]);
    expect(inventory.endpoints).toHaveLength(28);
    const frozen = catalogFixture<{ accepted22: { path: string }[] }>("asset-historical.json");
    const selected = new Set(frozen.accepted22.map(row => row.path));
    expect(inventory.endpoints.filter(row => selected.has(row.path))).toHaveLength(22);
    expect(inventory.endpoints.filter(row => selected.has(row.path) && row.visibility === "public")).toHaveLength(21);
    expect(inventory.endpoints.filter(row => selected.has(row.path) && row.visibility === "internal")).toHaveLength(1);
    expect(inventory.endpoints.filter(row => !selected.has(row.path)).map(row => row.path).sort())
      .toEqual([...result.frozenFilePaths.map(row => row.path), "artifacts:attachAsset"].sort());
    const registry = catalogInventory(Object.fromEntries(["agents", "memorySpaces", "contexts"].map(module => [module, files[`${module}.ts`].toString()])));
    expect(registry.completeness.unresolved).toEqual([]);
    expect(registry.endpoints).toHaveLength(48);
    const statistics = catalogFixture<Record<string, { declaration: string; sha256: string }>>("statistics-historical.json");
    for (const module of ["agents", "memorySpaces"]) {
      const declaration = catalogDeclarations(backendSource(module)).find(row => row.declaration.includes("statisticsUnavailable("))!.declaration;
      expect(declaration).toBe(statistics[module].declaration);
      expect(sha256(declaration)).toBe(statistics[module].sha256);
    }
  });
});
