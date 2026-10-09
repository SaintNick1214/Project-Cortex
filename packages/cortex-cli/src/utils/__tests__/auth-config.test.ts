import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import fs from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
const saved = jest.fn<(path: string, contents: string) => Promise<void>>(async () => undefined);
const source = () => ({ deployments: { own: { url: "https://own.convex.cloud" } }, default: "own", format: "json", confirmDangerous: true });
jest.unstable_mockModule("fs", () => ({ constants, existsSync: () => false, readdirSync: () => [], readFileSync: () => "" }));
jest.unstable_mockModule("fs/promises", () => ({ ...fs, writeFile: saved, mkdir: async () => undefined }));
jest.unstable_mockModule("cosmiconfig", () => ({ cosmiconfig: () => ({ search: async () => ({ config: source() }) }) }));
const { setConfigValue } = await import("../config.js");
let directory: string;
beforeEach(async () => { saved.mockClear(); directory = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-config-auth-test-")); });
afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });
it("persists the host environment selector only, never reads or saves its token contents", async () => {
  process.env.CORTEX_TEST_TOKEN = "private.payload.signature";
  try { await setConfigValue("token-env", "CORTEX_TEST_TOKEN"); expect(saved.mock.calls[0][1]).toContain('"tokenEnv": "CORTEX_TEST_TOKEN"'); expect(saved.mock.calls[0][1]).not.toContain("private.payload.signature"); }
  finally { delete process.env.CORTEX_TEST_TOKEN; }
});
it("persists only an absolute private token file pointer", async () => {
  const file = path.join(directory, "jwt"); await fs.writeFile(file, "private.payload.signature\n", { mode: 0o600 }); await setConfigValue("token-file", file);
  const data = JSON.parse(saved.mock.calls[0][1]); expect(data.deployments.own.tokenFile).toBe(file); expect(saved.mock.calls[0][1]).not.toContain("private.payload.signature");
});
it("refuses token contents passed as a file setting or direct token setting before persistence", async () => {
  await expect(setConfigValue("token-file", "private.payload.signature")).rejects.toThrow("Host JWT");
  await expect(setConfigValue("token", "private.payload.signature")).rejects.toThrow("Unknown config key"); expect(saved).not.toHaveBeenCalled();
});
it("scope settings remain bounded selectors, never local authority", async () => {
  await expect(setConfigValue("tenant-id", "owned\nforged")).rejects.toThrow("valid credential location"); expect(saved).not.toHaveBeenCalled();
});
