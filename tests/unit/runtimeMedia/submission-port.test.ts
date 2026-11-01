import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { makeFunctionReference } from "convex/server";
import { installMediaMockRoot, mediaFixture } from "./fixture";
import { clock } from "../runtimeTranscript/fixture";

beforeEach(() => { installMediaMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });

/** Controlled native registrations and factory ports; no media service availability claim. */
it.each(["image", "video"] as const)("resolves the controlled %s action query and rechecks grant revocation on the next call", async kind => {
  const f = await mediaFixture();
  await f.submit(kind);
  const runBudgetId = f.db.table("runtimeMediaJobs")[0].runBudgetId;
  if (typeof runBudgetId !== "string") throw new Error("Missing media run budget");
  const reference = makeFunctionReference<"query">("runtimeModelPolicy:resolve");
  const args = {
    reference: f.reference,
    operationKey: kind === "image" ? "media.image.generate" : "media.video.generate",
    runBudgetId,
  };
  const resolution = await f.ctx.runQuery(reference, args);
  expect(resolution).toMatchObject({ snapshot: { nativeInterface: kind }, dispatchEvidence: { nativeInterface: kind } });
  await f.db.patch("runtimeAuthGrants", f.reference.grantId, { revokedAt: clock });
  await expect(f.ctx.runQuery(reference, args)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  expect(f.counts()).toEqual({ images: 0, starts: 0, downloads: 0, statuses: 0 });
});
