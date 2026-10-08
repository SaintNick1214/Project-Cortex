"use strict";
import path from "path";
import { chalkStderr } from "chalk";
import { logMessage } from "../../../bundler/log.js";
import { safelyDeleteFile } from "./utils.js";
export async function removeLegacyCursorRulesFile(projectDir) {
  const removed = await safelyDeleteFile(
    path.join(projectDir, ".cursor", "rules", "convex_rules.mdc")
  );
  if (removed)
    logMessage(
      `${chalkStderr.green("\u2714")} Removed legacy .cursor/rules/convex_rules.mdc (superseded by convex/_generated/ai/guidelines.md).`
    );
  return removed;
}
//# sourceMappingURL=cursorrules.js.map
