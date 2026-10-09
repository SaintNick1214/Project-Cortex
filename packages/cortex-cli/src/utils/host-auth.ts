/** Explicit host credentials. No deploy/provider key or locally decoded claim grants access. */
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import type { GlobalOptions } from "../types.js";

export function credentialSource(options: Pick<GlobalOptions, "tokenEnv" | "tokenFile" | "fetchAuthToken">) {
  if (options.fetchAuthToken && (options.tokenEnv || options.tokenFile) || options.tokenEnv && options.tokenFile) throw new Error("Select one host token callback, environment variable or private file.");
  const name = options.tokenEnv ?? "CORTEX_AUTH_TOKEN";
  if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) throw new Error("Select a token environment variable name, not its value.");
  return async (request: { forceRefreshToken: boolean }): Promise<string | null> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const token = await Promise.race([read(request), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("HOST_TOKEN_TIMEOUT")), 10000); })]);
      if (token === null) return null;
      if (typeof token !== "string" || token.length > 16384 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new Error("INVALID_HOST_TOKEN");
      return token;
    } catch { throw new Error("Host JWT unavailable or invalid. Select --token-env or a private --token-file; renew it with your host identity provider. No credential was logged."); }
    finally { clearTimeout(timer); }
  };
  async function read(request: { forceRefreshToken: boolean }): Promise<string | null> {
    if (options.fetchAuthToken) return options.fetchAuthToken(request);
    if (!options.tokenFile) {
      const token = process.env[name];
      if (!token) throw new Error("HOST_TOKEN_REQUIRED");
      return token;
    }
    const file = await open(resolve(options.tokenFile), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size < 1 || info.size > 16385 || (info.mode & 0o077) !== 0 || typeof process.getuid === "function" && info.uid !== process.getuid()) throw new Error("PRIVATE_TOKEN_FILE_REQUIRED");
      const buffer = Buffer.alloc(16386), { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      if (bytesRead > 16385) throw new Error("TOKEN_FILE_TOO_LARGE");
      return buffer.subarray(0, bytesRead).toString("utf8").replace(/\r?\n$/, "");
    } finally { await file.close(); }
  }
}
