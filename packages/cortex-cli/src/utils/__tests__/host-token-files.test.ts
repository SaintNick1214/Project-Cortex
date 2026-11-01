import { expect, it } from "@jest/globals";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

it("rejects a private FIFO before credential timeout and exits naturally without a pending open", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-token-fifo-"));
  const fifo = path.join(directory, "token");
  try {
    await execute("mkfifo", ["-m", "600", fifo], { timeout: 3000 });
    const source = new URL("../host-auth.ts", import.meta.url).href;
    const child = await execute(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      const { credentialSource } = await import(process.argv[1]);
      try {
        await credentialSource({ tokenFile: process.argv[2] })({ forceRefreshToken: true });
        process.exitCode = 1;
      } catch (error) {
        if (!error.message.startsWith("Host JWT unavailable")) throw error;
        console.log("NONREGULAR_TOKEN_REJECTED");
      }
    `, source, fifo], { cwd: process.cwd(), timeout: 3000, killSignal: "SIGKILL", maxBuffer: 4096 });
    expect(child.stdout.trim()).toBe("NONREGULAR_TOKEN_REJECTED");
    expect(child.stderr).toBe("");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
