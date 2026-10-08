# Independent judgment: root ESLint frozen QA exclusion

Verdict: PASS — bounded configuration correction, 4.2/5.

The sole eslint.config.js diff adds `_goals/**/qa/**/*` to the existing global ignore list. It excludes frozen historical source snapshots, copied standalone fixtures and receipt probes from the root lint project. Root tsconfig.json includes only src/**/* and tests/**/*; these QA copies were already outside its parser project. This is alignment with compiler inclusion, not an explicit tsconfig exclusion line. Production backend/source/tests retain the same root lint configuration; package-specific checks retain their existing independent scope.

Independently parsed the original observed npm12.2 run: all87 errors are within `_goals/.../qa/`, including parser-project errors and two historical packed probes with no-undef. No source/test/production errors are removed by this pattern. Original failed receipt/logs remain intact in work/resume/foundation-root-lint.*. Parent observed repaired standard run exit0, with115 warnings and0 errors. Root lint does not enforce zero warnings; touched SDK scopes independently passed --max-warnings0.

Fresh ESLint before/after isPathIgnored checks prove src/agents, src/facts/history, src/assets/errors, convex-dev/runtimeDataAuth, optionalReadFailures and asset-capability tests plus eslint.config.js remain included; a frozen prior SDK source becomes ignored. The pattern cannot match src/, convex-dev/, tests/ or packages/ by location. config-paths.json and config-original-errors.json retain those independent checks. Existing standalone fixture scoped lint receipts remain necessary and preserved; this root correction neither certifies those fixtures nor waives their own gates.

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment |5/5| Root QA-only discovery fault corrected without dropping production/tests |
| Code Quality |4/5| Single global ignore consistent with root TypeScript project inclusion |
| Test Quality |4/5| Exact87-error location reconciliation and fresh inclusion probes |
| Pattern Adherence |4/5| Existing scratch/generated/archive ignores and separate package/fixture checks retained |
| Completeness |4/5| Actual standard npm12.2 lint rerun exit0; original failure retained |

Average4.2/5. No blocking issue found. This is a foundation quality correction only; full active core/module/UI and live/final gates remain later requirements. No source edits, services, deployment or commits were performed by this judge.
