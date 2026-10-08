/** Validation preserves stale configuration; it no longer prunes or saves on observation. */
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, realpathSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { CLIConfig } from "../../types.js";
const list = jest.fn<() => Promise<unknown>>();
const close = jest.fn();
const admin = jest.fn();
const realOs = await import("os");
jest.unstable_mockModule("os", () => ({
  ...realOs,
  homedir: () => process.env.HOME!,
}));
jest.unstable_mockModule("convex/browser", () => ({ ConvexHttpClient: jest.fn(() => ({setAdminAuth: admin, query: jest.fn(), mutation: jest.fn(), action: jest.fn()})) }));
jest.unstable_mockModule("@cortexmemory/sdk", () => ({ createAuthContext: (value: unknown) => value,
  Cortex: jest.fn((_options: unknown, runtime?: {initializeTransport?: (transport: unknown) => undefined}) => {
    const transport = {close, query: jest.fn(), mutation: jest.fn(), action: jest.fn(), setAdminAuth: admin};
    runtime?.initializeTransport?.(transport);
    return {memorySpaces: {list},getClient: () => transport,shutdown: async () => { await transport.close(); }, close: () => transport.close()};
  }),
}));
const { validateAndCleanConfig, loadConfigWithValidation, getUserConfigPath } =
  await import("../config.js");
let home: string;
let oldHome: string | undefined;
let oldCwd: string;
const config = (): CLIConfig => ({
  deployments: {
    stale: {
      url: "http://127.0.0.1:1",
      key: "fixture-secret",
      projectPath: "/missing-cortex-owned-fixture",
    },
  },
  apps: {
    app: {
      type: "basic",
      path: "missing",
      projectPath: "/missing-cortex-owned-fixture",
      enabled: true,
    },
  },
  default: "stale",
  format: "table",
  confirmDangerous: true,
  futureVersion: { book: 2 },
});
beforeEach(() => {
  jest.clearAllMocks();
  list.mockResolvedValue({ spaces: [] });
  oldHome = process.env.HOME;
  oldCwd = process.cwd();
  home = realpathSync(mkdtempSync(join(tmpdir(), "cortex-validation-")));
  process.env.HOME = home;
  process.chdir(home);
  if (realOs.homedir() !== process.env.CORTEX_TEST_HOME_ROOT)
    throw new Error("Native HOME is not externally isolated");
  expect(getUserConfigPath()).toBe(join(home, ".cortexrc"));
  writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
});
afterEach(() => {
  process.chdir(oldCwd);
  if (oldHome === undefined) delete process.env.HOME;
  else process.env.HOME = oldHome;
  rmSync(home, { recursive: true, force: true });
});
describe("observational validation", () => {
  it.each([
    "401 Unauthorized",
    "403 Forbidden",
    "invalid key",
    "ECONNREFUSED",
    "500 server error",
  ])("retains entries/default and bytes after %s", async (message) => {
    list.mockRejectedValue(new Error(message));
    const before = readFileSync(join(home, ".cortexrc"), "utf-8");
    const value = config();
    const result = await validateAndCleanConfig(value, { checkConvex: true });
    expect(result.config).toEqual(value);
    expect(result.modified).toBe(false);
    expect(result.removed).toEqual({ deployments: [], apps: [] });
    expect(result.diagnostics.map((issue) => issue.kind)).toEqual([
      "stale_path",
      message.includes("401") ||
      message.includes("403") ||
      message.includes("key")
        ? "auth_error"
        : "network_error",
      "stale_path",
    ]);
    expect(readFileSync(join(home, ".cortexrc"), "utf-8")).toBe(before);
    expect(admin).toHaveBeenCalledWith("fixture-secret");
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("retains timeout targets and closes clients", async () => {
    list.mockImplementation(() => new Promise(() => {}));
    const result = await validateAndCleanConfig(config(), { timeout: 5 });
    expect(result.diagnostics.some((issue) => issue.kind === "timeout")).toBe(
      true,
    );
    expect(result.config.default).toBe("stale");
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("skips network and still reports filesystem issues", async () => {
    const result = await validateAndCleanConfig(config(), {
      checkConvex: false,
    });
    expect(list).not.toHaveBeenCalled();
    expect(result.diagnostics).toHaveLength(2);
    expect(result.modified).toBe(false);
  });
  it("load plus validation preserves saved future fields and bytes", async () => {
    const before = readFileSync(join(home, ".cortexrc"), "utf-8");
    expect(await loadConfigWithValidation({ checkConvex: false })).toEqual(
      config(),
    );
    expect(readFileSync(join(home, ".cortexrc"), "utf-8")).toBe(before);
  });
  it("rejects malformed config and invalid timeout without networking", async () => {
    const bad = config();
    bad.deployments.stale.url = "";
    await expect(validateAndCleanConfig(bad)).rejects.toThrow("deployment URL");
    await expect(
      validateAndCleanConfig(config(), { timeout: -1 }),
    ).rejects.toThrow("timeout");
    expect(list).not.toHaveBeenCalled();
  });
});
