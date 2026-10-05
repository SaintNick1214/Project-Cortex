import assert from "node:assert/strict";
import { fixture } from "../../../../../tests/unit/runtimeMetadataAuth/fixture.ts";
import * as immutable from "../../../../../convex-dev/immutable.ts";
import * as users from "../../../../../convex-dev/users.ts";

const outcomes = [];
for (const [name, registration, key] of [
  ["immutable", immutable.getAtTimestamp, { type: "note", id: "one" }],
  ["users", users.getAtTimestamp, { userId: "alice" }],
]) {
  const f = fixture();
  f.seedImmutable({ ...(name === "users" ? { type: "user", id: "alice" } : {}), version: 3, data: "current", updatedAt: 3000,
    previousVersions: [{ version: 1, data: "first", timestamp: 1000 }, { version: 2, data: "second", timestamp: 2000 }] });
  for (const [timestamp, expected] of [[999, null], [1000, "first"], [1999, "first"], [2000, "second"], [3000, "current"], [4000, "current"]]) {
    const result = await f.run(registration, { ...key, timestamp });
    assert.equal(result === null ? null : result.data, expected);
    assert.equal(f.db.attemptedWrites, 0);
    outcomes.push({ endpoint: name, timestamp, data: expected, pass: true });
  }
  const absent = fixture();
  assert.equal(await absent.run(registration, { ...key, timestamp: 4000 }), null);
  assert.equal(absent.db.attemptedWrites, 0);
  outcomes.push({ endpoint: name, missingRow: true, data: null, pass: true });
}
console.log(JSON.stringify({ classification: "executor outcome probe, not independent judgment", total: outcomes.length, outcomes }, null, 2));
