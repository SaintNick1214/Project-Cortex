# Task03C2-D SDK governance consumer closure

Status: implementation and scoped checks complete; source frozen for fresh
independent review. No whole Task03, live service, graph or real retention PASS is
claimed. Parent owns staging/commit after independent approval.

`src/governance/index.ts` preserves the existing validation boundary and rejects
valid manual enforcement requests with a browser-safe `GovernanceCapabilityError`
before any dispatch or resilience attempt. Its method documentation now states
the trusted worker boundary and current simulation-only adapter. The obsolete
public reference and enforce-only Convex error converter are removed.
`src/index.ts` adds the class to the existing governance error export.
`tests/unit/runtimeWorkerClient/governance.test.ts` exercises the actual
`GovernanceAPI`, actual disabled `ConvexClient`, unchanged validators and actual
`ResilienceLayer` with spies, with/without the attached layer.

Observed checks (full command/cwd/exit receipts in `commands.json`):

| Check | Observed result |
|---|---|
| Scoped discovery | Exactly the intended new governance suite |
| Actual SDK outcomes | 28/28 pass, 1/1 suite, zero failures/skips/pending |
| Input validation | 11 malformed cases retain validation error codes, each with/without resilience |
| Valid input | 3 scoped requests receive typed, actionable capability outcome, each with/without resilience |
| No dispatch | Zero mutation, query, action and resilience execute attempts in all cases |
| Scoped ESLint | PASS, including both source files and the new test |
| Scoped TypeScript | PASS after correcting QA-only inferred rootDir |
| Isolated SDK build | PASS for ESM, CJS and bundled declarations |
| Packed contract | PASS for ESM/CJS class exports and strict DOM/types[] consumer declarations |
| Packed browser execution | Real packed Cortex.governance returns the exported error identity; invalid input remains validation failure; zero fetch calls/zero socket sends |
| Browser source boundary | No backend governance/auth/schema implementation in browser input graph |
| Diff whitespace | PASS for edited source files |
| Actual shared root TypeScript | FAIL: exactly three unrelated `purgeAll` references, no governance reference error |

The remaining shared-root TS2339 errors are in `tests/helpers/cleanup.ts:58,77`
and `tests/interactive-runner.ts:380`. Their memory/fact purge references conflict
with unreviewed concurrent backend internalization; these helpers and that backend
slice are outside this task. They are recorded honestly in
`root-types-current.log`, and no assertion or visibility change hides them.

The first scoped TypeScript attempt rejected the new QA config because TypeScript
6 inferred its nested folder as rootDir. `tsconfig.scoped.json` now explicitly
uses the repository root; the successful rerun is `scoped-types-final.log` and the
initial receipt remains preserved. Production/test bytes did not change between
these attempts.

`snapshot-provenance.json` records the reviewed HEAD/tree, manifest and source
hashes, exact overlays, and checks that every other tracked archive file matches
that pinned commit. The parent had already committed the reviewed compiler fix,
so this archive applies no additional backend patch. The snapshot's own dist and
work directories hold build/pack scratch; the shared root dist was not built.

Command context matters for runtime versions: the initial shell observed Node
24.15.0 and npm11.9.0. Archive creation observed Node24.19.0 and system npm11.9.0;
later qualified commands observed Node24.19.0 and scoped npm12.2.0. The build and
pack explicitly invoke scoped
`npm@12.2.0`, with its observed version in `qualified-npm-version.log`; the check
runner's Node version is in `qualified-node-version.log`, and the browser contract
prints its actual process.version. Both Node versions satisfy the declared floor.
This task performed no global package update or source dependency install.

The browser VM supplies an inert synthetic WebSocket so actual SDK construction
and graceful shutdown can run without a server. It records one synthetic socket,
zero sends and zero fetches. Its test identity/data are local placeholders only.
This validates package wiring and browser capability behavior, not backend worker
authorization or actual retention execution.
