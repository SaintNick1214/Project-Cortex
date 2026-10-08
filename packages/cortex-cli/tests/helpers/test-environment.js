import { URL } from "node:url";

/** Explicit CLI target selection; this module never loads environment files. */
export function cliTestTarget(environment) {
  const value = environment.CONVEX_URL_CLI;
  const fail = () => {
    throw new Error(
      "Live CLI tests require explicit CONVEX_URL_CLI: an http(s) origin without credentials, path, query or fragment.",
    );
  };
  if (typeof value !== "string" || !value || /\s|[?#]/.test(value)) fail();
  let url;
  try {
    url = new URL(value);
  } catch {
    fail();
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    fail();
  return value;
}

export function configureCliTestEnvironment(environment, live = false) {
  const target = live ? cliTestTarget(environment) : undefined;
  for (const name of Object.keys(environment)) {
    if (
      /^(?:CONVEX_|LOCAL_CONVEX_|CLOUD_CONVEX_|NEXT_PUBLIC_CONVEX_)/.test(name)
    )
      delete environment[name];
  }
  if (live) {
    environment.CONVEX_URL_CLI = target;
    environment.CONVEX_URL = target;
    environment.CONVEX_DEPLOYMENT_TYPE = [
      "localhost",
      "127.0.0.1",
      "[::1]",
    ].includes(new URL(target).hostname)
      ? "local"
      : "managed";
  }
}
