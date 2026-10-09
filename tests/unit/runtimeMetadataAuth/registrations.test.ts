import { describe, expect, it } from "@jest/globals";
import * as immutable from "../../../convex-dev/immutable";
import * as mutable from "../../../convex-dev/mutable";
import * as users from "../../../convex-dev/users";
import * as sessions from "../../../convex-dev/sessions";
import { catalogFixture, catalogInventory, withComposedCatalog } from "../../helpers/backend-catalog";
const internal = new Set(["immutable:purgeAll", "mutable:purgeAll", "sessions:expireIdle", "sessions:incrementMessageCount", "sessions:incrementMemoryCount"]);
describe("import-aware AST and native Convex registration visibility", () => {
  it("actual framework registrations are exactly 41=36+5 with no public reference credentials", () => {
    const paths: string[] = [];
    for (const [module, exports] of Object.entries({ immutable, mutable, users, sessions })) for (const [name, value] of Object.entries(exports)) {
      const registration = value as unknown as { _handler?: unknown; isPublic?: boolean; isInternal?: boolean; exportArgs(): string };
      if (!registration._handler) continue; const path = `${module}:${name}`; paths.push(path);
      expect(registration.isInternal === true).toBe(internal.has(path)); expect(registration.isPublic === true).toBe(!internal.has(path));
      if (registration.isPublic) expect(JSON.parse(registration.exportArgs()).value.reference).toBeUndefined();
    }
    expect(paths).toHaveLength(41); expect(paths.filter((path) => internal.has(path))).toHaveLength(5);
  });
  it("maintained import-aware AST finds the exact historical 41 metadata paths with zero unresolved", () => {
    withComposedCatalog((_directory, files) => {
      const actual = catalogInventory(Object.fromEntries(["immutable", "mutable", "users", "sessions"]
        .map(module => [module, files[`${module}.ts`].toString()])));
      const original = catalogFixture<{ baseline: { endpoints: { path: string }[] } }>("transcript-historical.json").baseline;
      const selected = original.endpoints.filter(row => /^(immutable|mutable|users|sessions):/.test(row.path));
      expect(actual.completeness.unresolved).toEqual([]);
      expect(actual.endpoints).toHaveLength(41);
      expect(actual.endpoints.filter(row => row.visibility === "public")).toHaveLength(36);
      expect(actual.endpoints.filter(row => row.visibility === "internal")).toHaveLength(5);
      expect(actual.endpoints.map(row => row.path).sort()).toEqual(selected.map(row => row.path).sort());
      expect(actual.endpoints.filter(row => row.visibility === "internal").map(row => row.path).sort()).toEqual([...internal].sort());
    });
  });
});
