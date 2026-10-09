import { jest } from "@jest/globals";
import { prepareCiReferences } from "../../scripts/lib/ci-reference-preparation";

const env = { CI: "true", CORTEX_CI_ALLOW_DESTRUCTIVE_RESET: "true", CONVEX_URL: "http://127.0.0.1:53310", CORTEX_CI_EXPECTED_CONVEX_URL: "http://127.0.0.1:53310", CONVEX_DEPLOY_KEY: "private-fixture-key" };
const complete = { complete: true, rows: 0 };
const ready = { state: "ready", ready: true, unresolved: { count: 0 }, writerManifestHash: "current", expectedWriterManifestHash: "current", backfill: complete, validation: complete };

it("refuses an unqualified deployment before native calls", async () => {
  const dispatch = jest.fn(async () => ({}));
  await expect(prepareCiReferences({ ...env, CORTEX_CI_EXPECTED_CONVEX_URL: "http://127.0.0.1:3210" }, dispatch)).rejects.toThrow("exact match");
  expect(dispatch).not.toHaveBeenCalled();
});
it("runs the canonical preparation sequence and confirms the native ready state", async () => {
  const states = [{ state: "missing" }, {}, { backfill: complete }, {}, { validation: complete }, ready];
  const dispatch = jest.fn(async (_name: string) => states.shift()!);
  expect(await prepareCiReferences(env, dispatch)).toEqual({ calls: 6 });
  expect(dispatch.mock.calls.map(([name]) => name)).toEqual(["status", "startGeneration", "advanceBackfill", "beginFinalization", "advanceValidation", "activateGeneration"]);
});
it("refuses inherited lifecycle state instead of repairing an arbitrary existing dataset", async () => {
  const dispatch = jest.fn(async () => ready);
  await expect(prepareCiReferences(env, dispatch)).rejects.toThrow("freshly reset");
  expect(dispatch).toHaveBeenCalledTimes(1);
});
it("refuses application rows appearing after reset, before finalization", async () => {
  const states = [{ state: "missing" }, { backfill: { rows: 1 } }];
  const dispatch = jest.fn(async (_name: string) => states.shift()!);
  await expect(prepareCiReferences(env, dispatch)).rejects.toThrow("application rows");
  expect(dispatch).toHaveBeenCalledTimes(2);
});
it("bounds a nonprogressing backfill and never activates it", async () => {
  const dispatch = jest.fn(async (name: string) => name === "status" ? { state: "missing" } : {});
  await expect(prepareCiReferences(env, dispatch)).rejects.toThrow("finite bound");
  expect(dispatch).toHaveBeenCalledTimes(130);
  expect(dispatch.mock.calls.some(([name]) => name === "activateGeneration")).toBe(false);
});
it.each([
  { ...ready, writerManifestHash: "other" },
  { ...ready, unresolved: { count: 1 } },
  { ...ready, ready: false },
  { ...ready, validation: { complete: true, rows: 1 } },
])("requires genuine complete native activation: %p", async invalid => {
  const states = [{ state: "missing" }, { backfill: complete }, { validation: complete }, invalid];
  await expect(prepareCiReferences(env, async () => states.shift()!)).rejects.toThrow("preparation is incomplete");
});
it("sanitizes a native refusal and never retries that mutation", async () => {
  const dispatch = jest.fn(async (name: string) => { if (name === "status") return { state: "missing" }; throw new Error(env.CONVEX_DEPLOY_KEY); });
  await expect(prepareCiReferences(env, dispatch)).rejects.toThrow("not declared ready");
  expect(dispatch).toHaveBeenCalledTimes(2);
});
