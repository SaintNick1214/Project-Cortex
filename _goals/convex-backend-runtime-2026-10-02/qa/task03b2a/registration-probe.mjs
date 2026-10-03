import fs from "node:fs";
import assert from "node:assert/strict";
const paths = ["immutable", "mutable", "users", "sessions"];
const records = [];
for (const module of paths) {
  const exports = await import(`../../../../convex-dev/${module}.ts`);
  for (const [name, value] of Object.entries(exports)) {
    if (typeof value !== "function" || !("_handler" in value)) continue;
    const args = JSON.parse(value.exportArgs());
    records.push({ path: `${module}:${name}`, visibility: value.isPublic ? "public" : value.isInternal ? "internal" : "unresolved", args });
    if (value.isPublic) assert.equal(Object.hasOwn(args.value, "reference"), false);
  }
}
assert.equal(records.length, 41);
assert.equal(records.filter((row) => row.visibility === "public").length, 36);
assert.equal(records.filter((row) => row.visibility === "internal").length, 5);
assert.equal(records.filter((row) => row.visibility === "unresolved").length, 0);
fs.writeFileSync("_goals/convex-backend-runtime-2026-10-02/qa/task03b2a/framework-registration.json", JSON.stringify(records, null, 2) + "\n");
console.log(JSON.stringify({ registered: records.length, public: 36, internal: 5, unresolved: 0 }));
