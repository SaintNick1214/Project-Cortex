import { describe, expect, it } from "@jest/globals";
import { parseNpmViewJson } from "../shell-utils.js";

describe("npm registry metadata", () => {
  const metadata = { "peerDependencies.convex": "^1.46.0", version: "0.36.0" };

  it("reads npm 11 object responses", () => {
    expect(parseNpmViewJson(JSON.stringify(metadata))).toEqual(metadata);
  });

  it("reads npm 12 array responses", () => {
    expect(parseNpmViewJson(JSON.stringify([metadata]))).toEqual(metadata);
  });

  it("uses the last matching version when npm returns several", () => {
    expect(parseNpmViewJson(JSON.stringify([{ version: "0.35.0" }, metadata]))).toEqual(metadata);
  });

  it.each(["[]", "null", '"0.36.0"'])("rejects unusable registry metadata: %s", (output) => {
    expect(() => parseNpmViewJson(output)).toThrow("Unexpected npm view response format");
  });
});
