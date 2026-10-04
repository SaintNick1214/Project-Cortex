import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const before = await import("./original.ts"), after = await import("./instrumented.ts");
const names = Object.keys(before).filter(name => before[name]?.isInternal);
if (names.length !== 14) throw Error("Internal inventory mismatch");
const entries = names.map(name => {
  const a=before[name],b=after[name];
  if (!b.isInternal || b.isPublic || a.exportArgs() !== b.exportArgs() || a.exportReturns() !== b.exportReturns()) throw Error("Validator change: " + name);
  return { name, isInternal: b.isInternal, isPublic: Boolean(b.isPublic), args: JSON.parse(b.exportArgs()), returns: JSON.parse(b.exportReturns()), validatorSHA256: createHash("sha256").update(b.exportArgs()+"\n"+b.exportReturns()).digest("hex") };
});
writeFileSync("_goals/convex-backend-runtime-2026-10-02/qa/task04-native-error-boundary-repair/registration-validators.json",JSON.stringify({all14Exact:true,entries},null,2));
console.log("PASS all14 exact registered validators and return validators");
