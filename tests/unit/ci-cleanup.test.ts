import { jest } from "@jest/globals";
import { ciResetTarget, resetCiDeployment, verifyEmptySnapshot } from "../../scripts/lib/ci-cleanup";

const target = { CI: "true", CORTEX_CI_ALLOW_DESTRUCTIVE_RESET: "true", CONVEX_URL: "http://127.0.0.1:53310", CORTEX_CI_EXPECTED_CONVEX_URL: "http://127.0.0.1:53310", CONVEX_DEPLOY_KEY: "test-private-key" };
it.each([
  { CI: "false" }, { CORTEX_CI_ALLOW_DESTRUCTIVE_RESET: undefined },
  { CORTEX_CI_EXPECTED_CONVEX_URL: undefined }, { CORTEX_CI_EXPECTED_CONVEX_URL: "http://127.0.0.1:3210" },
  { CONVEX_DEPLOY_KEY: "" }, { CONVEX_URL: "http://127.0.0.1:53310/?redirect=other", CORTEX_CI_EXPECTED_CONVEX_URL: "http://127.0.0.1:53310/?redirect=other" },
])("refuses unsafe/missing qualification before native effects: %p", invalid => {
  const execute = jest.fn(() => "");
  expect(() => resetCiDeployment({ ...target, ...invalid }, execute)).toThrow();
  expect(execute).not.toHaveBeenCalled();
});
it("accepts the explicitly qualified target", () => {
  expect(ciResetTarget(target)).toEqual({ url: target.CONVEX_URL, key: target.CONVEX_DEPLOY_KEY });
});
it("uses native authenticated replacement then verifies all snapshot documents", () => {
  const execute = jest.fn((command: string, args: string[]) => command === "unzip" && args[0] === "-Z1" ? "_tables/documents.jsonl\n_storage/documents.jsonl\nmemories/documents.jsonl\n_components/workflow/jobs/documents.jsonl\n" : "");
  expect(resetCiDeployment(target, execute)).toEqual({ tables: 3 });
  expect(execute.mock.calls[0][1]).toEqual(expect.arrayContaining(["import", "--replace-all", "--yes", "--url", target.CONVEX_URL, "--admin-key", target.CONVEX_DEPLOY_KEY]));
  expect(execute.mock.calls[1][1]).toEqual(expect.arrayContaining(["export", "--include-file-storage"]));
  expect(execute.mock.calls[3][1]).toEqual(expect.arrayContaining(["_components/workflow/jobs/documents.jsonl"]));
});
it.each(["memories/documents.jsonl", "_components/workflow/jobs/documents.jsonl"])("fails rather than claim %s residuals cleared", table => {
  const execute = (_command: string, args: string[]) => args[0] === "-Z1" ? `_storage/documents.jsonl\n${table}\n` : '{"remaining":true}\n';
  expect(() => verifyEmptySnapshot("snapshot.zip", target, execute)).toThrow("cleanup is incomplete");
});
it("fails on retained binary storage", () => {
  expect(() => verifyEmptySnapshot("snapshot.zip", target, () => "_storage/documents.jsonl\n_storage/blob-id\n")).toThrow("file storage residuals");
});
it("sanitizes a failed native reset and does not retry it", () => {
  const execute = jest.fn(() => { throw new Error(target.CONVEX_DEPLOY_KEY); });
  expect(() => resetCiDeployment(target, execute)).toThrow("cleanup is incomplete");
  expect(() => resetCiDeployment(target, execute)).not.toThrow(target.CONVEX_DEPLOY_KEY);
  expect(execute).toHaveBeenCalledTimes(2);
});
