import { beforeAll, describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

interface Policy {
  path: string; kind: string; visibility: string; disposition: string; requiredCapability: string;
  scope: string; resourceLookup: string; ownership: string; backgroundCheck: string; reason: string;
}
interface Inventory {
  completeness: { unresolved: string[]; counts: { registeredBuilderCalls: number; resolvedExports: number } };
  endpoints: Policy[];
}
const base = "_goals/convex-backend-runtime-2026-10-02/qa/task03a";
const runners = [path.resolve(base, "inventory.mjs"), path.resolve(base, "reproduction/inventory.mjs")];
const internalReads = ["facts:fetchFactsByIds", "memories:fetchMemoriesByIds", "memories:keywordSearchMemories"];
const adminKinds = { listTable: "query", deleteRecord: "mutation", clearTable: "mutation", countTable: "query", getAllCounts: "query" };
const purges = [
  "agents:purgeAll", "artifacts:purgeAll", "attachments:purgeAll", "contexts:purgeAll", "conversations:purgeAll",
  "facts:purgeAll", "graphSync:purgeAll", "immutable:purgeAll", "memories:purgeAll", "memorySpaces:purgeAll", "mutable:purgeAll",
  "governance:purgeAllPolicies", "governance:purgeAllEnforcement",
];
const authControls = ["provision", "revokeGrant", "revokeMembership", "deletePrincipal", "deleteScope", "tombstoneResource"];
const maintenance = [...Object.keys(adminKinds).map((name) => `admin:${name}`), ...purges];

/** Source fixtures test the actual AST generator; production sources/counts/hashes may evolve. */
function createSourceFixture(root: string): void {
  fs.mkdirSync(path.join(root, "convex"));
  fs.writeFileSync(path.join(root, "convex.json"), JSON.stringify({ functions: "convex/" }));
  const modules = new Map<string, Array<[string, string]>>();
  const add = (endpoint: string, builder: string) => {
    const [module, name] = endpoint.split(":");
    modules.set(module!, [...(modules.get(module!) ?? []), [name!, builder]]);
  };
  internalReads.forEach((endpoint) => add(endpoint, "internalQuery"));
  Object.entries(adminKinds).forEach(([name, builder]) => add(`admin:${name}`, builder));
  purges.forEach((endpoint) => add(endpoint, "mutation"));
  ["authorize", "recheck"].forEach((name) => add(`runtimeAuth:${name}`, "internalQuery"));
  authControls.forEach((name) => add(`runtimeAuth:${name}`, "internalMutation"));
  add("facts:get", "query"); add("memories:store", "mutation");
  for (const [module, entries] of modules) {
    const imports = [...new Set(entries.map((entry) => entry[1]))].join(", ");
    const declarations = entries.map(([name, builder]) => `export const ${name} = ${builder}({args:{},handler:async()=>null});`);
    fs.writeFileSync(path.join(root, "convex", `${module}.ts`), `import {${imports}} from "./_generated/server";\n${declarations.join("\n")}\n`);
  }
}

describe.each(runners)("portable generated inventory policies: %s", (runner) => {
  let inventory: Inventory;
  beforeAll(() => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-auth-inventory-"));
    try {
      createSourceFixture(fixture);
      expect(fs.existsSync(path.join(fixture, "work"))).toBe(false);
      expect(fs.existsSync(path.join(fixture, "work/backend-runtime/task03a/inventory.mjs"))).toBe(false);
      // Absolute retained runner resolves TypeScript from the repository; child cwd has no work parent/runner.
      const result = spawnSync(process.execPath, [runner, "inventory-output"], { cwd: fixture, encoding: "utf8", timeout: 10000 });
      expect({ exitCode: result.status, stderr: result.stderr }).toEqual({ exitCode: 0, stderr: "" });
      inventory = JSON.parse(fs.readFileSync(path.join(fixture, "inventory-output/public-path-inventory.json"), "utf8")) as Inventory;
      expect(inventory.completeness.unresolved).toEqual([]);
      expect(inventory.completeness.counts.registeredBuilderCalls).toBe(inventory.endpoints.length);
      expect(inventory.completeness.counts.resolvedExports).toBe(inventory.endpoints.length);
      expect(fs.existsSync(path.join(fixture, "work"))).toBe(false);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  function policy(endpoint: string): Policy {
    const found = inventory.endpoints.find((entry) => entry.path === endpoint);
    if (!found) throw new Error(`Missing fixture policy: ${endpoint}`);
    return found;
  }

  it.each(internalReads)("%s remains a scoped internal read helper", (endpoint) => {
    expect(policy(endpoint)).toMatchObject({ kind: "internalQuery", visibility: "internal", disposition: "retain-internal", requiredCapability: "read" });
    expect(policy(endpoint).backgroundCheck).toContain("before sensitive read/effect/commit");
  });

  it.each(maintenance)("%s requires operator maintenance without a target runtime grant", (endpoint) => {
    const actual = policy(endpoint);
    expect(actual).toMatchObject({
      disposition: "internalize", requiredCapability: "trusted deployment-operator internal invocation", scope: "deployment-operator",
      ownership: "trusted deployment operator controls deployment-wide Cortex maintenance targets; tenant runtime capabilities and resource-owner claims cannot authorize invocation",
      backgroundCheck: "trusted operator maintenance does not authenticate through a target's current tenant/background grant, which may already be revoked/deleted; preserve deletion fences and reference-aware cleanup; no runtime admin/write/tool/storage prerequisite",
      reason: "deployment-wide maintenance must internalize for trusted operator invocation; never public tenant admin or target-grant authorization",
    });
    expect(actual.resourceLookup).toMatch(/allowlisted Cortex table|fixed allowlisted Cortex tables|deployment-wide Cortex records and owned references/);
  });

  it("authorize uses requested capability and inherited verified issuer/subject", () => {
    expect(policy("runtimeAuth:authorize")).toMatchObject({
      visibility: "internal", disposition: "retain-internal", requiredCapability: "requirement.capability",
      scope: "trusted memberships/grants resolved from inherited Convex-verified issuer/subject; omitted selectors require one eligible scope",
      resourceLookup: "exact verified issuer/subject -> principal, membership, grant, scope epochs and optional canonical resource",
      ownership: "verified principal and explicit own/space/tenant resourceAccess; canonical ownerPrincipalId must match for own access",
      backgroundCheck: "action authorization adapter consumes inherited ctx.auth.getUserIdentity; reload current trusted controls, capability, expiry, epochs and tombstones on invocation",
    });
  });

  it("recheck uses requested capability and exact persisted versions/epochs/optional scope", () => {
    expect(policy("runtimeAuth:recheck")).toMatchObject({
      visibility: "internal", disposition: "retain-internal", requiredCapability: "requirement.capability",
      scope: "exact trusted persisted reference principal/membership/grant IDs and versions, tenant/space epochs and optional memorySpaceId equality including absence",
      resourceLookup: "exact trusted persisted authority reference -> current control records and optional canonical resource/tombstone",
      ownership: "trusted persisted reference binds principal; current explicit own/space/tenant resourceAccess checks canonical resource; reference is never a public credential",
      backgroundCheck: "sessionless background adapter reloads exact pinned versions, capability, expiry, scope epochs and tombstones before sensitive read/effect/commit; no active JWT required",
    });
  });

  it.each(authControls)("runtimeAuth:%s is a deployment operator control", (name) => {
    expect(policy(`runtimeAuth:${name}`)).toMatchObject({
      visibility: "internal", disposition: "retain-internal", requiredCapability: "trusted deployment-operator internal invocation", scope: "deployment-operator",
      ownership: "trusted deployment operator controls trusted records; public JWT admin, tenant write and resource-owner claims cannot authorize invocation",
      backgroundCheck: "operator bootstrap/lifecycle control does not authenticate through the target's current background grant, which may already be revoked/deleted; enforce each handler's target lifecycle checks and idempotence",
    });
  });

  it.each([["facts:get", "read"], ["memories:store", "write"]])("keeps ordinary %s available through scoped %s grants", (endpoint, capability) => {
    expect(policy(endpoint!)).toMatchObject({ visibility: "public", disposition: "guard", requiredCapability: capability });
    expect(policy(endpoint!).scope).toContain("trusted tenant + memorySpace");
  });

  it("accepts changed source bytes and an additional registration without coupling policy to frozen production hashes/counts", () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-auth-inventory-evolve-"));
    try {
      createSourceFixture(fixture);
      for (const file of fs.readdirSync(path.join(fixture, "convex"))) fs.appendFileSync(path.join(fixture, "convex", file), "\n");
      fs.appendFileSync(path.join(fixture, "convex/facts.ts"), "export const count = query({args:{},handler:async()=>0});\n");
      const result = spawnSync(process.execPath, [runner, "inventory-output"], { cwd: fixture, encoding: "utf8", timeout: 10000 });
      expect(result.status).toBe(0);
      const evolved = JSON.parse(fs.readFileSync(path.join(fixture, "inventory-output/public-path-inventory.json"), "utf8")) as Inventory;
      expect(evolved.endpoints.length).toBe(inventory.endpoints.length + 1);
      for (const original of inventory.endpoints) {
        expect(evolved.endpoints.find((entry) => entry.path === original.path)).toMatchObject({
          requiredCapability: original.requiredCapability, scope: original.scope, disposition: original.disposition,
          resourceLookup: original.resourceLookup, ownership: original.ownership, backgroundCheck: original.backgroundCheck,
        });
      }
      expect(fs.existsSync(path.join(fixture, "work"))).toBe(false);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });
});
