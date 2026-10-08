# Task03B2D bounded worker/policy closure

Base: reviewed commit `6939678976fbc6f309fe34374930bdf404e8152f` in detached isolated worktree.
Product dependencies: frozen03A verified authority and reviewed02B canonical source/repository/schema only.
`dependency-provenance.json` proves those dependency source bytes remain committed bytes.
No main-checkout/MF helper is imported, read, or used. No staging/commit/push/deploy/live operation occurs here.

`path-closure.json` resolves the exact frozen25: governance10, graphSync10, admin5.
Seven governance functions remain public with current verified `admin`; eighteen functions internalize.
Registered native visibility flags and import-aware AST resolution are tested.
The full local AST catalog has259 registrations/resolved exports,0unresolved; this is registration
completeness, not authorization closure of other modules. The copied03A resolver adds explicit02B
runtimeMemory policies; the frozen03A generator/inventory remain unchanged.

## Governance

Policy scopes derive one trusted tenant and optional concrete space from current identity/grants.
`organizationId` narrows the trusted tenant; it cannot select another organization. Omitted scope never
scans all organization policies. Composite indexes and owner predicates constrain actual row selection
before collection/deactivation/aggregation. A missing fresh owner is excluded for own access and denies
for cross-principal access. There is no ownership adoption, migration, global policy fallback, identity
bootstrap, grant provisioning, or privilege inheritance from policy/override fields.

Native nested validators plus persisted-policy structural/semantic checks reject additional nested
role/admin/scope fields, invalid versions/ranges/durations and incompatible selectors. Privileged actors
and immutable audit/job references derive from verified authority. Public reads use the current caller;
they do not re-authorize through a revoked policy creator. `admin` grants no memory/fact/private-byte
read or write/tool/storage capability. Simulation and compliance/statistics read scoped policy/audit
metadata only; no private resource contents are fetched.

Internal `enforce` reads one exact policy ID, checks its stored immutable admin reference and canonical
scope/owner, validates its policy, selects that same active row, and rechecks before simulation-log
commit. Results/logs explicitly identify simulation and unimplemented retention, with zero actual
versions deleted/records purged/bytes freed. There is no actual retention deletion/compliance guarantee.

## Legacy graph queue

All ten functions are internal. The nine worker functions require a concrete pinned reference plus
independent `tool` and `read`, without an active JWT. Each stored job binds tenant/space/canonical owner,
exact authority generation, fact document/version, and canonical source ID/event/revision. Admission
selects the actual fact by trusted tenant/space/fact ID/owner, rechecks resource tombstones, fetches the
canonical scoped source, checks all lineage fields, owner, normalization, actual semantic hash, valid
stored timestamps and fact lifecycle, then derives an allowlisted payload. Caller entity JSON is absent
from the native validator and never materialized into a job. Metadata credentials are not projected.
Jobs never replace their stored authority/source, reopen completed jobs, or mark retry exhaustion synced.
Private error strings are sanitized.

Worker ID/state/priority/failed/statistics/cleanup queries begin with tenant+space+stored grant and
principal predicates before limit/processing. Cleanup additionally selects synced+cutoff in the database.
Every selected stored job rechecks canonical fact/source and current authority before output or state
commit; a wrong/stale/revoked/expired/deleted reference/source cannot read, mark, or recreate the source.
Bulk cleanup prechecks all candidates and final per-row checks occur before deletion in the transaction.

The reviewed base has complete fresh provenance only for facts. Admission for memories, contexts,
conversations and other tables, and graph delete projection, returns typed `UNSUPPORTED_OPERATION`.
It neither trusts caller entity JSON nor invents ownership/source provenance. Task11 owns durable
projection/outbox/leases/receipts and external graph deletion reconciliation. This queue closure runs
no graph connector and certifies no Neo4j/Memgraph behavior. Later reviewed MF/T/B2B helpers and Task11
must independently qualify other entity support; the current unsupported outcome is explicit.

## Deployment operator maintenance

Admin5 and three purge registrations are internal deployment-operator surfaces, with no public JWT
admin/target-runtime-grant authentication. The original fixed14-table allowlist excludes trusted auth,
source/chunk/vector/receipt/tombstone controls and `_storage`. Table/ID pairs are normalized against the
validated table before destructive routing. Limits are finite integers1..1000. Inspection counts expose
explicit truncation rather than a false exhaustive count.

Destruction supports only governancePolicies, governanceEnforcement and graphSyncQueue metadata.
Policy deletion clears exact policy-ID enforcement references; queue/log deletion preserves sources,
canonical resources, private bytes and all permanent fences. Operator cleanup remains available when
a target runtime grant has already been revoked/deleted.

Unsafe deletion/clear of agents, artifacts, contexts, conversations, factHistory, facts, immutable,
memories, memorySpaces, mutable and sessions returns typed `UNSUPPORTED_OPERATION` before changes.
Resource-specific cleanup belongs to reviewed MF/T/B2B lifecycles, Task11 graph references, Task12 private
byte/reference lifecycle, and Task15 host-preserving integration. No raw byte deletion/completion is
claimed. Read-only operator inspection of those14tables remains available through internal tooling.

## Validation limits

Fixtures execute actual registered `_handler`s and assert actual selected rows/state/results, including
foreign-first IDs, capability separation, nested-policy forgery, source CAS/hash/timestamps, pinned
control deletion/expiry/revocation, wrong stored refs, final checks and transaction rollback.
This is offline handler/data-layer evidence, not live deployment/subscription/private-byte coverage.
Task03 overall,03C/03C2,09,11,12,15, full-root quality, and live/graph/private-storage gates remain pending.
