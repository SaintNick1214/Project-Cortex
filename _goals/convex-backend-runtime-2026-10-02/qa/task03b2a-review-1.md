# Independent Task03B2A judgment, first cycle

Final verdict: **REJECT, 3.0/5** from fresh read-only `task03b2a_review_1`.
Candidate: isolated reviewed2edd9435 base, frozen2026-10-03T10:22:52.847506Z.
This bounded41-path candidate is not accepted and has not been integrated.

| Dimension | Score |
|---|---:|
| Requirement fulfillment | 2 |
| Code quality | 3 |
| Test quality | 3 |
| Pattern adherence | 3 |
| Completeness | 4 |

Independent actual-handler probes found four blocking requirement gaps:

- Mutation response READ admission omits profile eligibility. A concrete-space WRITE
  plus tenant READ with own access can expose another user's prior profile values
  through immutable.store, although users.get correctly denies that profile.
- Bulk candidate paths omit canonical-key conflict preflight. Own/foreign duplicate
  keys permit purgeMany/endAll, while duplicate own keys can attempt writes before
  eventual denial. Every target must be proven unique before the first write.
- Sessions can expire during awaited authorization after the current preflight.
  Touch and both internal counters subsequently mutate the expired session.
- Internal maintenance accepts a stored reference matching the supplied reference
  without proving canonical owner/user/actor binding under broad space access.

Additional validation defects: explicit null increment operands silently default to
one, and immutable version increments can overflow Number.MAX_SAFE_INTEGER.
The second repair addresses these scoped findings without changing the requirements.

Independently reproduced139 tests/two suites/zero skipped, affected types/lint,
native41 registrations (36 public/5 internal), AST0 unresolved and whitespace PASS.
All161 source/QA/auth snapshot entries remained unchanged; all retained source,
report, contracts and reviewed03A hashes matched. Full-root types fail on exactly
five downstream SDK consumer errors; the virtual reviewed baseline has0 diagnostics.
These successful scoped checks did not detect the independent failures above.

Raw independent scripts, outcomes, hash checks, native registrations and baseline
diagnostics originated in `/tmp/task03b2a-judge-5v8r8u6s/`. Parent preserved69 original
candidate/source/QA/independent records in the isolated task03b2a history/cycle1-final
archive before repair; script copies are inert text. No live service, whole03,
byte delivery, UI or whole-goal certification is claimed.
