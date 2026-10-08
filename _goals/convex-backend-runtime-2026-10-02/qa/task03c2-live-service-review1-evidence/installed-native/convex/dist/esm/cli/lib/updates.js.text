"use strict";
import path from "path";
import { logMessage } from "../../bundler/log.js";
import { readProjectConfig } from "./config.js";
import { functionsDir } from "./utils/utils.js";
import {
  checkAiFilesStalenessAndLog,
  isAiFilesDisabled
} from "./aiFiles/index.js";
import { getVersion } from "./versionApi.js";
export async function checkVersionAndAiFilesStaleness(ctx) {
  const version = await getVersion();
  if (version.kind === "error") return;
  if (version.data.message) logMessage(version.data.message);
  try {
    const { configPath, projectConfig } = await readProjectConfig(ctx);
    const aiFilesConfig = projectConfig.aiFiles;
    if (isAiFilesDisabled(aiFilesConfig)) return;
    const convexDir = path.resolve(functionsDir(configPath, projectConfig));
    const projectDir = path.resolve(path.dirname(configPath));
    await checkAiFilesStalenessAndLog({
      canonicalGuidelinesHash: version.data.guidelinesHash,
      canonicalAgentSkillsSha: version.data.agentSkillsSha,
      aiFilesConfig,
      projectDir,
      convexDir
    });
  } catch {
  }
}
//# sourceMappingURL=updates.js.map
