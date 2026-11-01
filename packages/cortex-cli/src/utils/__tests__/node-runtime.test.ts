import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  MINIMUM_NODE_VERSION,
  isSupportedNodeVersion,
  unsupportedNodeDiagnostic,
} from "../node-runtime.js";

describe("CLI runtime policy", () => {
  it.each(["20.0.0", "20.20.2", "22.9.0", "22.15.99", "22.16.0", "23.0.0", "24.0.0", "24.14.99", "22.16", "", "garbage", "24.15.0-rc.1", "24.15.0+build", "024.15.0", "22.-1.0", "24.15.0\n", "9007199254740992.0.0"])(
    "refuses unsupported or malformed version %j",
    (version) => expect(isSupportedNodeVersion(version)).toBe(false),
  );
  it.each(["24.15.0", "v24.15.0", "24.15.1", "24.16.0", "25.0.0", "26.0.0"])(
    "accepts stable supported version %s without an upper cap",
    (version) => expect(isSupportedNodeVersion(version)).toBe(true),
  );
  it("prints the required plain diagnostic with the actual runtime", () => {
    expect(unsupportedNodeDiagnostic("v20.20.2")).toBe(
      "Cortex CLI requires Node.js >=24.15.0; found v20.20.2. Upgrade to a supported Node.js LTS release.",
    );
  });
  it("agrees with the CLI manifest and only its workspace lock engine", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
    const lock = JSON.parse(readFileSync(new URL("../../../../../package-lock.json", import.meta.url), "utf8"));
    expect(MINIMUM_NODE_VERSION).toBe("24.15.0");
    expect(manifest.engines.node).toBe(`>=${MINIMUM_NODE_VERSION}`);
    expect(lock.packages["packages/cortex-cli"].engines).toEqual(manifest.engines);
    const root = JSON.parse(readFileSync(new URL("../../../../../package.json", import.meta.url), "utf8"));
    expect(lock.packages[""].engines).toEqual(root.engines);
  });
});
