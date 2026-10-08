import { TemplateError } from "./contract.js";
type Version = readonly [number, number, number];
const exact = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function exactTemplateVersion(value: unknown): string {
  if (
    typeof value !== "string" ||
    !exact.test(value) ||
    !value.split(".").every((part) => Number.isSafeInteger(Number(part)))
  )
    throw new TemplateError("TEMPLATE_EXACT_VERSION_REQUIRED");
  return value;
}
function parse(value: string): Version {
  const [major, minor, patch] = exactTemplateVersion(value)
    .split(".")
    .map(Number);
  return [major, minor, patch];
}
const compare = (a: Version, b: Version): number =>
  a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
/** Stable release ranges only. Unsupported syntax/prereleases refuse rather than guess. */
export function satisfiesTemplateRange(
  version: string,
  range: string,
): boolean {
  const current = parse(version);
  if (typeof range !== "string" || !range || range.length > 256) return false;
  return range.split("||").some((branch) => {
    const tokens = branch.trim().split(/\s+/);
    return (
      tokens.length > 0 &&
      tokens.every((token) => {
        const match = /^(\^|~|>=|<=|>|<|=)?(\d+\.\d+\.\d+)$/.exec(token);
        if (!match || !exact.test(match[2])) return false;
        const target = parse(match[2]),
          delta = compare(current, target);
        switch (match[1]) {
          case ">=":
            return delta >= 0;
          case "<=":
            return delta <= 0;
          case ">":
            return delta > 0;
          case "<":
            return delta < 0;
          case "~":
            return (
              delta >= 0 && current[0] === target[0] && current[1] === target[1]
            );
          case "^":
            return (
              delta >= 0 &&
              (target[0]
                ? current[0] === target[0]
                : target[1]
                  ? current[0] === 0 && current[1] === target[1]
                  : compare(current, target) === 0)
            );
          default:
            return delta === 0;
        }
      })
    );
  });
}
