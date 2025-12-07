/**
 * Concurrent Test Helpers
 *
 * Provides utilities for running tests in parallel within a single file.
 * This is similar to Python's pytest-xdist but for Jest.
 *
 * Usage:
 *   import { concurrentIt } from './helpers/concurrent';
 *
 *   describe("My Tests", () => {
 *     concurrentIt("test 1", async () => { ... });
 *     concurrentIt("test 2", async () => { ... }); // runs in parallel with test 1
 *   });
 *
 * For describe blocks where ALL tests are independent:
 *   import { describeConcurrent } from './helpers/concurrent';
 *
 *   describeConcurrent("Independent Tests", () => {
 *     it("test 1", async () => { ... }); // automatically concurrent
 *     it("test 2", async () => { ... }); // runs in parallel
 *   });
 */

import { it, describe } from "@jest/globals";

/**
 * Concurrent version of `it` - runs tests in parallel within the same describe block.
 *
 * Use this for tests that:
 * - Use TestRunContext for isolated data (unique IDs)
 * - Don't depend on side effects from other tests
 * - Don't share mutable state beyond what's set up in beforeAll
 */
export const concurrentIt = it.concurrent;

/**
 * Concurrent version of `test` - alias for concurrentIt
 */
export const concurrentTest = it.concurrent;

/**
 * Create a describe block where all `it` calls are concurrent by default.
 *
 * WARNING: Only use this for describe blocks where tests are truly independent:
 * - Each test uses unique IDs (via TestRunContext)
 * - No test depends on data created by another test
 * - No shared mutable state that tests modify
 *
 * @param name - Describe block name
 * @param fn - Test definition function (receives concurrent `it`)
 */
export function describeConcurrent(
  name: string,
  fn: (concurrent: { it: typeof it.concurrent; test: typeof it.concurrent }) => void,
): void {
  describe(name, () => {
    fn({ it: it.concurrent, test: it.concurrent });
  });
}

/**
 * Skip helper for concurrent tests
 */
export const concurrentItSkip = it.concurrent.skip;

/**
 * Only helper for concurrent tests (run only this test)
 */
export const concurrentItOnly = it.concurrent.only;
