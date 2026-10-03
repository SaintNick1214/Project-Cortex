# Active package baseline quality

Revision: a1527cfe (plan reconciliation; product source unchanged).
Runtime: Node v24.19.0, npm 12.2.0 through scoped `npm exec`.
Working directories are relative to the Project-Cortex checkout.
These are baseline/offline receipts, not full runtime/module/UI certification.

| Check | Command | Directory | Exit / outcome | Raw receipt |
|---|---|---|---|---|
| Install | `npm exec --yes --package=npm@12.2.0 -- npm ci --no-audit --no-fund` | root | 0; 553 packages, no lock changes | baseline-install.log |
| SDK lint | `npm run lint` through npm 12.2.0 | root | 0 | baseline-root-lint.log |
| SDK typecheck | `npm exec -- tsc --noEmit` through npm 12.2.0 | root | 0 | baseline-root-typecheck.log |
| SDK build | `npm run build` through npm 12.2.0 | root | 0 | baseline-root-build.log |
| Packed/browser contracts | `npm run test:contracts` through npm 12.2.0 | root | 0 | baseline-root-contracts.log |
| SDK offline unit | See exact command below | root | 0; 19 suites, 619 tests | baseline-root-offline-unit.log |
| CLI lint | `npm run lint` through npm 12.2.0 | packages/cortex-cli | 0 | baseline-cli-lint.log |
| CLI typecheck | `npm run typecheck` through npm 12.2.0 | packages/cortex-cli | 0 | baseline-cli-typecheck.log |
| CLI build / mirror sync | `npm run build` through npm 12.2.0 | packages/cortex-cli | 0; mirror has no tracked diff | baseline-cli-build.log |
| CLI unit | `npm run test:unit -- --runInBand` through npm 12.2.0 | packages/cortex-cli | 0; 8 suites, 168 tests | baseline-cli-unit.log |
| Provider lint | `npm run lint` through npm 12.2.0 | packages/vercel-ai-provider | 0 | baseline-provider-lint.log |
| Provider build | `npm run build` through npm 12.2.0 | packages/vercel-ai-provider | 0; core and React | baseline-provider-build.log |
| Provider mocked/unit/React | `node ../../node_modules/jest/bin/jest.js --selectProjects unit unit-react integration --runInBand` | packages/vercel-ai-provider | 0; 10 suites, 273 tests | baseline-provider-cjs-tests.log |
| Basic install | `npm ci --no-audit --no-fund` through npm 12.2.0 | packages/cortex-cli/templates/basic | 0; own lock | baseline-basic-install.log |
| Basic offline build | `npm run build` through npm 12.2.0 | packages/cortex-cli/templates/basic | 0; no deploy script | baseline-basic-build.log |
| Basic unit | `npm run test:unit` through npm 12.2.0 | packages/cortex-cli/templates/basic | 0; 4 files, 87 tests | baseline-basic-unit.log |
| Canonical demo install | `npm ci --no-audit --no-fund` through npm 12.2.0 | packages/vercel-ai-provider/quickstart | 0; own lock | baseline-demo-install.log |
| Canonical demo lint | `npm run lint` through npm 12.2.0 | packages/vercel-ai-provider/quickstart | 0 | baseline-demo-lint.log |
| Canonical demo typecheck | `npm exec -- tsc --noEmit` through npm 12.2.0 | packages/vercel-ai-provider/quickstart | 0 | baseline-demo-typecheck.log |
| Canonical demo build | `npm run build` through npm 12.2.0 | packages/vercel-ai-provider/quickstart | 0 | baseline-demo-build.log |
| Canonical demo mocked/unit | `npm test -- --runInBand` through npm 12.2.0 | packages/vercel-ai-provider/quickstart | 0; 3 suites, 80 tests | baseline-demo-unit.log |
| Chat install | `npm ci --no-audit --no-fund` through npm 12.2.0 | packages/cortex-cli/templates/chat-sdk-quickstart | 0; own lock | baseline-chat-install.log |
| Chat lint | `npm run lint` through npm 12.2.0 | packages/cortex-cli/templates/chat-sdk-quickstart | 0; 179 files | baseline-chat-lint.log |
| Chat typecheck | `npm exec -- tsc --noEmit` through npm 12.2.0 | packages/cortex-cli/templates/chat-sdk-quickstart | 0 | baseline-chat-typecheck.log |
| Chat build | `npm run build` through npm 12.2.0 | packages/cortex-cli/templates/chat-sdk-quickstart | 0 | baseline-chat-build.log |
| Chat unit | `npm test` through npm 12.2.0 | packages/cortex-cli/templates/chat-sdk-quickstart | 0; 4 files, 42 tests | baseline-chat-unit.log |

SDK offline command:

```sh
CONVEX_URL=http://127.0.0.1:1 CONVEX_TEST_MODE=local \
  node --experimental-vm-modules node_modules/jest/bin/jest.js \
  --testPathPatterns=tests/unit --testPathIgnorePatterns=memory-observer.test.ts \
  --runInBand --forceExit
```

The explicit non-service URL satisfies the existing environment loader for
mocked/isolated tests. The live memory-observer suite is excluded and remains
BLOCKED until the corresponding backend is installed. This run does not certify
managed retrieval, backend isolation or graph behavior. The first unmodified root
unit invocation exited 1 before tests because no backend URL was configured; its
empty output is retained in baseline-root-unit.log.

The profile's provider command included `--experimental-vm-modules`, which fails
against the current unit/mocked test setup (`jest is not defined`: 7 failed suites,
25 failed/134 passed tests). The package scripts and tests/helpers/setup.ts specify
CJS for unit/mocked integration and ESM for e2e. The corrected CJS invocation above
passed without source/assertion changes. The failed invocation is retained in
baseline-provider-tests.log; this is a command/runtime mismatch, not a product fix.

Live core module coverage, runtime acceptance and browser flows remain pending.
No native browser/computer-use tool is exposed in this session (tool discovery
checked both names and descriptions). Existing Playwright suites remain available
as package checks; native UI certification requires its own evidence/gate later.
Root/package build output is ignored;
no product/generated/mirror tracked files changed. No model inference or live data
mutation occurred in these checks.
