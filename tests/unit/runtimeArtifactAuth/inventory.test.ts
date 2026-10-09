import "./accepted-reader-compat";
import { expect, test } from "@jest/globals";
import { backendSource, catalogDeclarations, catalogFixture, catalogInventory, sha256, withComposedCatalog } from "../../helpers/backend-catalog";

test("current native catalog composes accepted selected22 and later five closures while preserving explicitly historical inventory", () => {
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
  withComposedCatalog((_directory, files) => {
    const artifactSource = files["artifacts.ts"].toString();
    expect(sha256(artifactSource)).toBe("3252eb473cd80c9fe222a21322cb55e321704635dfd17596c319183fb9bcc2a3");
    const inventory = catalogInventory({ artifacts: artifactSource });
    expect(inventory.completeness.unresolved).toEqual([]);
    expect(inventory.endpoints).toHaveLength(27);
    const frozen = catalogFixture<{ accepted22: { path: string }[] }>("asset-historical.json");
    const selected = new Set(frozen.accepted22.map(row => row.path));
    expect(inventory.endpoints.filter(row => selected.has(row.path))).toHaveLength(22);
    expect(inventory.endpoints.filter(row => selected.has(row.path) && row.visibility === "public")).toHaveLength(21);
    expect(inventory.endpoints.filter(row => selected.has(row.path) && row.visibility === "internal")).toHaveLength(1);
    expect(inventory.endpoints.filter(row => !selected.has(row.path)).map(row => row.path).sort())
      .toEqual(result.frozenFilePaths.map(row => row.path).sort());
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
