/** Pure runtime policy; safe to link before any application dependency. */
export const MINIMUM_NODE_VERSION = "22.16.0";

export function isSupportedNodeVersion(version: string): boolean {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match || match[0] !== version) return false;
  const actual = match.slice(1).map(Number);
  if (!actual.every(Number.isSafeInteger)) return false;
  const minimum = MINIMUM_NODE_VERSION.split(".").map(Number);
  for (let index = 0; index < minimum.length; index++) {
    if (actual[index] !== minimum[index]) return actual[index] > minimum[index];
  }
  return true;
}

export function unsupportedNodeDiagnostic(version: string): string {
  return `Cortex CLI requires Node.js >=${MINIMUM_NODE_VERSION}; found ${version}. Upgrade to a supported Node.js LTS release.`;
}
