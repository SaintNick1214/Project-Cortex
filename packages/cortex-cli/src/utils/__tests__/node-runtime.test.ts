import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  MINIMUM_NODE_VERSION,
  isSupportedNodeVersion,
  unsupportedNodeDiagnostic,
} from "../node-runtime.js";

describe("CLI runtime policy", () => {
  it.each(["20.0.0", "20.20.2", "22.9.0", "22.15.99", "22.16", "", "garbage", "22.16.0-rc.1", "22.16.0+build", "022.16.0", "22.-1.0", "22.16.0\n", "9007199254740992.0.0"])(
    "refuses unsupported or malformed version %j",
    (version) => expect(isSupportedNodeVersion(version)).toBe(false),
  );
  it.each(["22.16.0", "v22.16.0", "22.16.1", "22.17.0", "23.0.0", "24.0.0", "26.0.0"])(
    "accepts stable supported version %s without an upper cap",
    (version) => expect(isSupportedNodeVersion(version)).toBe(true),
  );
  it("prints the required plain diagnostic with the actual runtime", () => {
    expect(unsupportedNodeDiagnostic("v20.20.2")).toBe(
      "Cortex CLI requires Node.js >=22.16.0; found v20.20.2. Upgrade to a supported Node.js LTS release.",
    );
  });
  it("agrees with the CLI manifest and only its workspace lock engine", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
    const lock = JSON.parse(readFileSync(new URL("../../../../../package-lock.json", import.meta.url), "utf8"));
    expect(MINIMUM_NODE_VERSION).toBe("22.16.0");
    expect(manifest.engines.node).toBe(`>=${MINIMUM_NODE_VERSION}`);
    expect(lock.packages["packages/cortex-cli"].engines).toEqual(manifest.engines);
    expect(lock.packages[""].engines).toBeUndefined();
  });
});
