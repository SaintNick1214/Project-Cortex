/** Environment access is optional in browsers and Web Crypto runtimes. */
export const runtimeEnv: Record<string, string | undefined> = new Proxy({}, {
  get(_target, key: string) {
    return typeof process === "undefined" ? undefined : process.env[key];
  },
});
