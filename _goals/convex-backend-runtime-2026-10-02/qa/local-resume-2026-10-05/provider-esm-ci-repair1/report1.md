# Provider unit runner repair

The declared `npm run test:unit` now passes **7/7 suites and 223/223 tests**, with zero skips. The 202 legacy cases remain CommonJS with their hoisted mocks; all 21 remote transport cases execute in a separate ESM project using the actual AI SDK 7 stream parser. No assertions, test files or declared deadlines changed.

Only [package.json](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/packages/vercel-ai-provider/package.json) and [jest.config.js](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/packages/vercel-ai-provider/jest.config.js) changed. The unit command enables Node's VM ESM runtime and selects `unit`, `unit-react`, and `unit-remote`. The remote exclusion is exact to its original file and is paired with that file's new project; discovery contains every original suite exactly once.

The original CI failure is retained in [provider-cause-blocks3.log](../checkpoint60-ci-investigation1/provider-cause-blocks3.log). One local [reproduction](reproduction1.results.json) matched it: six suites/202 tests passed, while the remote suite failed before execution with `Must use import to load ES Module: .../ai/dist/index.js`.

Current evidence:

- [Declared command, default execution](declared-command-current2.log): exit0, 7 suites/223 tests, 5.471 seconds; no external `NODE_OPTIONS` required.
- [Per-case controlled result](unit-current1.results.json): exit0, 223 passed/0 failed/0 skipped. Default-command reruns are not added to this count.
- [Exact discovery](discovery-current2.log): seven paths, zero duplicates, identical suite set to the original run. All 202 previously executed test identities are retained.
- Config syntax check: `node --check jest.config.js`, exit0.
- [Machine report and two-file hashes](report1.json): Node24.15.0/npm12.2.0; unit deadlines10000, integration30000 and e2e180000 remain unchanged.

Integration/e2e project configuration was preserved. No product runtime/backend change, dependency installation, build, Git mutation, service request or inference occurred. All observed check children exited; no forceExit was used. This fixes the reproduced unit-runner defect and does not claim that a new remote CI job or service-dependent suite ran.
