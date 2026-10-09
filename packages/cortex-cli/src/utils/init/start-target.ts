/** Development lifecycle commands cannot inherit production deployment authority. */
export function developmentStartEnvironment(url?: string, key?: string, inherited: typeof process.env = process.env): typeof process.env {
  const env = { ...inherited };
  delete env.CONVEX_DEPLOY_KEY;
  delete env.CONVEX_DEPLOYMENT;
  if (url) env.CONVEX_URL = url;
  if (key) {
    const match = /^dev:([a-z0-9-]+)\|[^\r\n]+$/.exec(key);
    if (!match || !url || new URL(url).hostname !== `${match[1]}.convex.cloud`) throw new Error("cortex start accepts only a development key bound to this cloud URL. Production deployment requires a separate explicit operator command.");
    env.CONVEX_DEPLOY_KEY = key;
    env.CONVEX_DEPLOYMENT = `dev:${match[1]}`;
  }
  return env;
}
