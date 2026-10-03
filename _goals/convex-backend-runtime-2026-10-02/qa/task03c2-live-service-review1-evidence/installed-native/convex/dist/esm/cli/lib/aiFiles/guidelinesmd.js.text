"use strict";
import { promises as fs } from "fs";
import { chalkStderr } from "chalk";
import { logMessage } from "../../../bundler/log.js";
import { downloadGuidelines } from "../versionApi.js";
import { hashSha256 } from "../utils/hash.js";
import { aiDirForConvexDir, guidelinesPathForConvexDir } from "./paths.js";
import { attemptReadFile, exhaustiveCheck } from "./utils.js";
export async function hasGuidelinesInstalled(convexDir) {
  const result = await attemptReadFile(guidelinesPathForConvexDir(convexDir));
  if (result.kind === "content") return true;
  if (result.kind === "empty" || result.kind === "not-found") return false;
  return exhaustiveCheck(result);
}
export async function installGuidelinesFile({
  convexDir,
  state
}) {
  const guidelines = await downloadGuidelines();
  if (guidelines === null) {
    logMessage(
      chalkStderr.yellow(
        "Could not download Convex AI guidelines right now. You can retry with: npx convex ai-files install"
      )
    );
    return;
  }
  await fs.mkdir(aiDirForConvexDir(convexDir), { recursive: true });
  await fs.writeFile(guidelinesPathForConvexDir(convexDir), guidelines, "utf8");
  state.guidelinesHash = hashSha256(guidelines);
  logMessage(
    `${chalkStderr.green("\u2714")} ${guidelinesPathForConvexDir(convexDir)} written`
  );
}
//# sourceMappingURL=guidelinesmd.js.map
