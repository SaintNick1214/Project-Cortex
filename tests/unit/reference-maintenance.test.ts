import { describe, it, expect } from "@jest/globals";
import * as maintenance from "../../convex-dev/referenceMaintenance";
const queries = ["status", "planPage"] as const;
const mutations = [
  "startGeneration",
  "advanceBackfill",
  "beginFinalization",
  "advanceValidation",
  "activateGeneration",
  "abortFinalization",
] as const;
describe("fixed explicit maintenance boundary", () => {
  it("ships exactly8 internal registrations", () => {
    expect(Object.keys(maintenance).sort()).toEqual(
      [...queries, ...mutations].sort(),
    );
    for (const name of [...queries, ...mutations]) {
      expect(maintenance[name].isInternal).toBe(true);
      expect(maintenance[name]).not.toHaveProperty("isPublic");
    }
  });
  it.each([...queries, ...mutations])(
    "accepts no caller table/ID/count/evidence/ready flag in %s",
    (name) => {
      const registration = maintenance[name] as unknown as {
        exportArgs: () => string;
      };
      expect(Object.keys(JSON.parse(registration.exportArgs()).value)).toEqual(
        name === "planPage" ? ["cursor"] : [],
      );
    },
  );
});
