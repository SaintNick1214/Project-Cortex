import { ConvexClient as PublicClient } from "convex/browser";
import { Cortex as PublicCortex } from "../../src";
import { Cortex, ConvexClient } from "../helpers/deployment-operator";
import { isDeploymentOperatorClient } from "../../src/common/deploymentOperator";

const savedKey = process.env.CONVEX_DEPLOY_KEY;
const savedTarget = process.env.CORTEX_TEST_EXPECTED_CONVEX_URL;
const url = "https://owned-ci.convex.cloud";
afterEach(() => {
  if (savedKey === undefined) delete process.env.CONVEX_DEPLOY_KEY; else process.env.CONVEX_DEPLOY_KEY = savedKey;
  if (savedTarget === undefined) delete process.env.CORTEX_TEST_EXPECTED_CONVEX_URL; else process.env.CORTEX_TEST_EXPECTED_CONVEX_URL = savedTarget;
});
it("requires a separately selected exact target and a key", () => {
  delete process.env.CORTEX_TEST_EXPECTED_CONVEX_URL;
  expect(() => new ConvexClient(url, { disabled: true })).toThrow("exact dedicated");
  process.env.CORTEX_TEST_EXPECTED_CONVEX_URL = url;
  delete process.env.CONVEX_DEPLOY_KEY;
  expect(() => new Cortex({ convexUrl: url })).toThrow("deployment authentication");
  process.env.CONVEX_DEPLOY_KEY = "fixture-key";
  expect(() => new ConvexClient("https://other.convex.cloud", { disabled: true })).toThrow("exact dedicated");
});
it("selects operator routing only for explicitly imported administrative fixtures", async () => {
  process.env.CORTEX_TEST_EXPECTED_CONVEX_URL = url;
  process.env.CONVEX_DEPLOY_KEY = "fixture-key";
  const operator = new ConvexClient(url, { disabled: true, logger: false });
  const ordinary = new PublicClient(url, { disabled: true, logger: false });
  try {
    expect(isDeploymentOperatorClient(operator)).toBe(true);
    expect(isDeploymentOperatorClient(ordinary)).toBe(false);
    expect(PublicCortex).not.toBe(Cortex);
  } finally { await operator.close(); await ordinary.close(); }
});
it("refuses to combine the test operator factory with host JWT credentials", () => {
  process.env.CORTEX_TEST_EXPECTED_CONVEX_URL = url;
  process.env.CONVEX_DEPLOY_KEY = "fixture-key";
  expect(() => new Cortex({ convexUrl: url, fetchAuthToken: async () => "public-token" })).toThrow("separate from public JWT");
});
