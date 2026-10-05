"use strict";
import * as Sentry from "@sentry/node";
import { promises as fs } from "fs";
import { z } from "zod";
import { aiDirForConvexDir, aiFilesStatePathForConvexDir } from "./paths.js";
import { attemptReadFile, exhaustiveCheck } from "./utils.js";
export const aiFilesStateSchema = z.object({
  guidelinesHash: z.string().nullable(),
  agentsMdSectionHash: z.string().nullable(),
  claudeMdHash: z.string().nullable(),
  // Commit SHA from get-convex/agent-skills that was current when skills were
  // last installed. Used to detect when newer skills are available.
  agentSkillsSha: z.string().nullable()
});
const DEFAULT_AI_STATE = {
  guidelinesHash: null,
  agentsMdSectionHash: null,
  claudeMdHash: null,
  agentSkillsSha: null
};
export async function attemptReadAiState(convexDir) {
  const result = await attemptReadFile(aiFilesStatePathForConvexDir(convexDir));
  if (result.kind === "not-found" || result.kind === "empty")
    return { kind: "no-file" };
  try {
    const state = aiFilesStateSchema.parse(JSON.parse(result.content));
    return { kind: "ok", state };
  } catch (error) {
    Sentry.captureException(error);
    return { kind: "parse-error", error };
  }
}
export async function readAiStateOrDefault(convexDir) {
  const result = await attemptReadAiState(convexDir);
  if (result.kind === "ok") return result.state;
  if (result.kind === "no-file") return { ...DEFAULT_AI_STATE };
  if (result.kind === "parse-error") return { ...DEFAULT_AI_STATE };
  return exhaustiveCheck(result);
}
export async function hasAiState(convexDir) {
  const result = await attemptReadAiState(convexDir);
  return result.kind === "ok";
}
export async function writeAiState({
  state,
  convexDir
}) {
  const validated = aiFilesStateSchema.parse(state);
  await fs.mkdir(aiDirForConvexDir(convexDir), { recursive: true });
  await fs.writeFile(
    aiFilesStatePathForConvexDir(convexDir),
    JSON.stringify(validated, null, 2) + "\n",
    "utf8"
  );
}
//# sourceMappingURL=state.js.map
