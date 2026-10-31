import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const source = () => ({ deployments: { own: { url: "https://own.convex.cloud" } }, default: "own", format: "json", confirmDangerous: true });
jest.unstable_mockModule("cosmiconfig", () => ({ cosmiconfig: () => ({ search: async () => ({ config: source(), filepath: path.join(directory, "cortex.config.json") }) }) }));
const { setConfigValue } = await import("../config.js");
let directory: string;
beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-config-auth-test-")); await fs.writeFile(path.join(directory, "cortex.config.json"), JSON.stringify(source())); });
afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });
it("persists the host environment selector only, never reads or saves its token contents", async () => {
  process.env.CORTEX_TEST_TOKEN = "private.payload.signature";
  try { await setConfigValue("token-env", "CORTEX_TEST_TOKEN"); expect((await fs.readFile(path.join(directory, "cortex.config.json"), "utf8"))).toContain('"tokenEnv": "CORTEX_TEST_TOKEN"'); expect((await fs.readFile(path.join(directory, "cortex.config.json"), "utf8"))).not.toContain("private.payload.signature"); }
  finally { delete process.env.CORTEX_TEST_TOKEN; }
});
it("persists only an absolute private token file pointer", async () => {
  const file = path.join(directory, "jwt"); await fs.writeFile(file, "private.payload.signature\n", { mode: 0o600 }); await setConfigValue("token-file", file);
  const data = JSON.parse((await fs.readFile(path.join(directory, "cortex.config.json"), "utf8"))); expect(data.deployments.own.tokenFile).toBe(file); expect((await fs.readFile(path.join(directory, "cortex.config.json"), "utf8"))).not.toContain("private.payload.signature");
});
it("refuses token contents passed as a file setting or direct token setting before persistence", async () => {
  await expect(setConfigValue("token-file", "private.payload.signature")).rejects.toThrow("Host JWT");
  await expect(setConfigValue("token", "private.payload.signature")).rejects.toThrow("Unknown config key"); expect(JSON.parse(await fs.readFile(path.join(directory, "cortex.config.json"), "utf8"))).toEqual(source());
});
it("scope settings remain bounded selectors, never local authority", async () => {
  await expect(setConfigValue("tenant-id", "owned\nforged")).rejects.toThrow("valid credential location"); expect(JSON.parse(await fs.readFile(path.join(directory, "cortex.config.json"), "utf8"))).toEqual(source());
});
