import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { hostToken } from "../cortex.js";

const execute = promisify(execFile);

it("rejects a private FIFO and exits naturally without a pending token open", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cortex-basic-fifo-"));
  const fifo = join(directory, "token");
  try {
    await execute("mkfifo", ["-m", "600", fifo], { timeout: 3000 });
    const source = new URL("../cortex.ts", import.meta.url).href;
    const child = await execute(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      const { hostToken } = await import(process.argv[1]);
      try {
        await hostToken({ CORTEX_AUTH_TOKEN_FILE: process.argv[2] });
        process.exitCode = 1;
      } catch (error) {
        if (error.code !== "INVALID_HOST_TOKEN") throw error;
        console.log("NONREGULAR_TOKEN_REJECTED");
      }
    `, source, fifo], { cwd: process.cwd(), timeout: 3000, killSignal: "SIGKILL", maxBuffer: 4096 });
    expect(child.stdout.trim()).toBe("NONREGULAR_TOKEN_REJECTED");
    expect(child.stderr).toBe("");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("requires a private regular token file while permitting host rotation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cortex-basic-private-token-"));
  const file = join(directory, "token"), link = join(directory, "link");
  try {
    await writeFile(file, "opaque-old-jwt\n", { mode: 0o600 });
    expect(await hostToken({ CORTEX_AUTH_TOKEN_FILE: file })).toBe("opaque-old-jwt");
    await writeFile(file, "opaque-renewed-jwt\n");
    expect(await hostToken({ CORTEX_AUTH_TOKEN_FILE: file })).toBe("opaque-renewed-jwt");
    await symlink(file, link);
    await expect(hostToken({ CORTEX_AUTH_TOKEN_FILE: link })).rejects.toThrow("HOST_TOKEN_UNAVAILABLE");
    await chmod(file, 0o644);
    await expect(hostToken({ CORTEX_AUTH_TOKEN_FILE: file })).rejects.toThrow("INVALID_HOST_TOKEN");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
