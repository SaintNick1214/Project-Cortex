# Backend-runtime execution progress

Current phase: scoped adapters and endpoint closure after foundation Tasks02A/03A.
Fresh independent goal review cycle2 PASS;
Task01 independent review cycle1 PASS (4.2/5).
Execution authorized by the user's implementation request. Plan-only disclaimers
record historical authorship and do not supersede this request.

## Baseline and access

- Repository: SaintNick1214/Project-Cortex, branch feat/convex-backend-runtime.
- Starting commit: f9828ea915174cd73f19e410ecb5967b3f86f13a.
- Required dev ancestor: 3341d64ddc06f1de26ed525312ef2c1b89b16952, verified.
- Initial working tree clean; no unrelated user work found.
- Reviewed domain foundation committed/pushed as b987b870, then server-signed with
  identical tree as429d471d; all six feature commits have verified signatures. Exact
  old/new mappings and unchanged-tree proof are in commit-signing.json. Draft PR against dev:
  https://github.com/SaintNick1214/Project-Cortex/pull/132. It remains incomplete/WIP.
- Reviewed03A foundation committed/pushed as cf579f3f with a verified signature.
- Node observed v24.19.0; npm 12.2.0 available through scoped npm exec.
- GitHub CLI authentication and Convex team read returned successful results.
- Cloud readiness tool reports configured variables as unknown; variable presence
  alone is not interpreted as ready. Actual Convex team-access read returned HTTP 200.
- User response to live target/budget question: **"create a fresh instance, no cap"**.
  Create an isolated disposable development deployment; no shared CI/production targets.
- Qualification target efficient-ox-979 / project3133325 was verified and retired
  after review; disposable-target.json and qualification-target-retirement.json.
- Separate fresh product integration target limitless-chameleon-209 / project3133446
  is verified owned/development-only; integration-target.json. Private credentials
  remain in ignored work/.
- Task01 standalone Agent/Workflow/Workpool fixture was deployed on its qualification
  target. Actual Gateway
  Chat, structured output, Responses and backend tool calls have succeeded. Final
  Task01 qualification is independently PASS; see task01/report.md and task01-review-1.md.
  Its bounded spike is not the production runtime.
- Baseline active-package offline quality receipts are in baseline-quality.md.
  Live core module/runtime/UI certification remains pending.

## Task state

| Tasks | State | Dependency / evidence |
|---|---|---|
| 01 | Complete/PASS | Fresh judge task01_review,4.2/5;10 live checks,Gateway Chat,strict typed UI protocol. |
| 02A | Complete/PASS | Fresh cycle2 judge task02a_review_2,4.4/5;137 tests/211 independent assertions;02B pending trusted authority freeze. |
| 03A | Complete/PASS | Fresh final cycle3 judge task03a_review_3,4.2/5;133 tests/38 independent outcomes. Raw duplicate grant checks corrected within open review. Existing endpoint closure remains03B. |
| 02B | Complete/PASS bounded | Fresh task02b_review_1,4.4/5;53 retained tests/78 independent assertions; scoped adapters/source-vector stores/remember-recall. Whole02 deployed Gateway wiring pending04/06/09. |
| 03B1-MF | In progress | Bounded executor task03b1_memory_facts; shared scoped helpers and memories/facts39public+3internal paths. |
| 03C1 | Open first review/fix | Official Convex reactive callback rejection leaves transport paused/unhandled; executor fixing fail-closed behavior and explicit diagnostics. Live03C2 remainspending. |
| 03B1-T/03B2/03C2/04–09 | Pending | Remaining endpoint closure and ordered text slice. |
| 10–15 | Pending | Text slice and per-extension service gates. |
| 16–17 | Pending | Complete implementation, outcome matrix and independent final audit. |

Cycle 1 goal review: NEEDS REVISION; cycle 2 PASS (4.6/5); see both execution-goal-review files. Routine
ordering/default-profile/delegation/context corrections preserve approved scope.
Record each executor, fresh judge result, command receipt and missing coverage here
or in linked task receipts. A blocked/unexecuted gate never becomes PASS.

## Affected qualification security followup

PR security checks identified standalone fixture ws8.18.3 vulnerabilities; root product
ws is already8.21.0. Task01 fixture direct pin is patched to8.21.0, with observed
offline strict/protocol/browser/safe-target checks. Separate owned development target
fiery-setter-784 / project3133652 was verified solely for affected observer/reconnect/
cancellation checks, then retired after independentPASS4.2/5 (DELETE200/projectGET404).
Evidence is in task01-security/ and task01-security-review-1.md. Original Task01 matrix and retired-target receipts remain
historical; no full current-revision live matrix is claimed by the scoped rerun.

Full root lint rerun passed with0 errors/113 recorded warnings after standalone
fixture TS-project/import and historical-runner unused-variable fixes; raw logs and
502 projection-equivalence assertions are in ci-followups/. These certify the
observed sources at that time; subsequent runtime changes require affected checks.
Open security review also found evidence directory/output symlink guards ran too late.
The executor corrected pre-effect canonical validation and private-secret confinement;
independent32-case no-network ordering checks passed and the final followup verdict
isPASS4.2/5. CI on de618fa6 subsequently passed all required check runs. CodeQL still
reports one medium outbound fixture request annotation; target/origin guards were
independently reviewed, and no alert suppression or zero-alert scanner claim is made.
The historical executable key-generator archive was renamed to inert text with exact
byte identity; ci-followups/archive-source-rename.json preserves its mapping/hash.
