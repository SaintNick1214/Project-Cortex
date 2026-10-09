# Historical registry catalogs and current coverage map

The `.test.ts.txt` files preserve the exact catalogs at PR136 merge baseline
`512ae07f7`. They are historical source material, outside Jest's `*.test.ts`
discovery; they are not passing tests, not skipped tests, and contribute no
current coverage. Active replacements retain the six registry suite paths and the mixed integration paths mapped below.

Current public authority is defined by `convex-dev/runtimeMetadataAuth.ts` and
`runtimeRegistryAuth.ts`: verified native identity plus persisted tenant/space
membership and grants. SDK auth labels, participants, registry labels and
`grantedAccess` metadata do not grant authority. Native tests provision an owned
principal through authenticated internal `runtimeAuth:provision`, then call the
ordinary public SDK with impersonated verified identity. No operator routing is
installed on those clients. The separate administrator WebSocket only inspects
owned fixture rows to prove absence of effects.

Relevant accepted history: `c92d54836` scoped metadata/session maintenance;
`7cebd3de6` reviewed registry/context boundary; `c7b16971a` scoped statistics
closure; `9b811b04d` canonical transcript closure. The old catalogs assumed
unauthenticated global writes, unrestricted bulk selectors, globally unique
metadata, physical removal/recreation, live transcript linking and statistics,
and old registry argument/return shapes. Those assumptions are not current
runtime promises.

| Historical catalog / behavior | Current active assertion and intended path |
| --- | --- |
| contexts: create/get/update, status/data/version handling | `contexts.test.ts`: genuine public create/get/update; shallow nested replacement; version/getHistory/timestamp reconstruction and absent version |
| contexts: hierarchy/chain/root/children/recursive descendants | `contexts.test.ts`: three-level public hierarchy, ordered ancestors, root, direct/recursive children, depth/root identity |
| contexts: participants and grantedAccess | `contexts.test.ts`: public add/remove/idempotent metadata and positive same-grant access annotation; ungranted target refusal + unchanged rows; labels do not provision grants |
| contexts: linked conversations / includeConversation / getByConversation | `contexts.test.ts`: actual public CAPABILITY_NOT_READY for linking and source lookup + no insert; an unlinked ordinary context can be included without fabricating a transcript |
| contexts filters: status/user/space/parent/root/depth/limit, search/count | `contexts-filters.test.ts`: four status matrix, fixed tenant/space grant, exact counts, parent/root/depth/limit, nonmatching actor, foreign-space refusal + unchanged rows |
| contexts filters: JSON/CSV/chain/version export | `contexts-filters.test.ts`: both formats, selected count/IDs, history data, unselected rows absent |
| contexts operations: updateMany/deleteMany | `contexts-operations.test.ts`: selected bulk mutation, preserved nonmatch, exact returned IDs, tombstoned-source refusal after retirement |
| contexts operations: cascade/orphan/delete constraints | `contexts-operations.test.ts`: parent-with-children refusal with no effects; exact descendant retirement; child/leaf re-rooting with retained data; incompatible options/unfiltered writes refused |
| users: CRUD/upsert/nested merge/version history | `users.test.ts`: public owned scope getOrCreate/update/get/exists/merge, actual ascending immutable history, version/timestamp and ignored defaults |
| users: list/search/count/pagination/export | `users.test.ts`: public space grant, multiple profiles, exact count/page/hasMore, name search, JSON history/CSV and tenant mismatch |
| users: updateMany/deleteMany/dry runs | `users.test.ts`: public explicit/filter update, exact IDs and data; dry-run rows unchanged; simple and bulk profile retirement receipts (confirmed receipt remains truthful when tombstoned source verification is undisclosable) |
| users: cascade erasure across supported domains | `users.test.ts`: public API requires explicit administrator transport before effects. Positive native supported-primary erasure, residual/refusal/budget/replay/binary cases remain active in `domain-operations`, `domain-scope`, `user-export`; unit `domain-erasure*.test.ts` covers preparation and commit outcomes. This is scoped erasure, not a universal purge. |
| agents: register/get/exists/update/configure/list/search/count | `agents.test.ts`: genuine public fixed-grant canonical registry positives; labels/config remain metadata |
| agents: updateMany/unregister/unregisterMany/dry run/export | `agents.test.ts`: actual bounded public operations, exact admitted IDs/counts, JSON/CSV, retained tombstone refusal and dry-run no effects |
| agents: cross-data stats / legacy client cascade | `agents.test.ts`: actual backend scoped statistics refusal; SDK typed TRUSTED_BACKEND_CASCADE_REQUIRED for single/bulk cascade + unchanged registry. This does not claim supported canonical CRUD is unavailable. |
| sessions: create/get/getOrCreate/touch/end/endAll/list/count/getActive | `sessions-lifecycle.test.ts`: public positives, unique IDs, scope and actor metadata, reference redaction, exact endAll receipt and public profile update after session end (grant remains valid) |
| sessions: idle expiration, counters/expiration/actor/security | `sessions-lifecycle.test.ts`: client BACKEND_MAINTENANCE_ONLY + no effects, invalid lifetime/forged actor/ended touch, tenant concealment/unauthenticated refusal. Trusted worker counter and captured-reference fences remain active in `unit/runtimeMetadataAuth` and `unit/runtimeWorkerClient` (no public scheduling success claimed). |
| all six: invalid inputs / tenant and memory-space safety | Current public suites prove unauthenticated refusal, forged tenant denial, foreign admitted client concealment and unchanged owned rows; existing backend auth suites continue detailed resource/duplicate/expiry/fence negative cases. |
| graph side effects formerly conditional on local external service | Actual graph effects remain active under `tests/graph` and the project graph gate. These registry suites prove canonical primary behavior without claiming service-dependent graph evidence. |

This is an operation mapping, not a claim that every historical permutation was
retained verbatim. Baseline catalogs are reviewable in full. No current supported
endpoint was reopened and no historical success was converted into a hidden pass.

Governance coverage map: organization-wide caller-label policies and global retention/deletion success assumptions are historical (canonical worker guard commit cd5671449). Active tests retain genuine setPolicy replacement/getPolicy/setAgentOverride, all four qualified templates, simulation, reports and all statistics periods, plus no-dispatch manual enforcement, tenant/undeclared scope/unauthenticated negatives and unchanged persisted policy/log inspection. The full previous client validation catalog remains active; its valid positive setup supplies the single explicit owned scope. Actual backend worker retention remains simulation-only (`RETENTION_EXECUTION_NOT_IMPLEMENTED`), so tests never claim deleted records or generated savings.


| Additional historical mixed catalog | Current active supported operations and exact deliberate limits |
| --- | --- |
| `crossLayerIntegrity.test.ts.txt`: context transcript links, hierarchy and source deletion | Current `crossLayerIntegrity.test.ts` retains 62 cases: actual conversation/memory/fact and metadata reference positives through their intended transports; native equal immutable logical IDs with five versus two versions in separate tenants; current public context hierarchy/grant/chain/data positives. Transcript-linked creation is actually refused with unchanged context/source rows, followed by supported unlinked creation; cascade deletion persists hierarchy tombstones and public reads refuse. Two supported legacy administrative space erasures remain positive after qualified native lifecycle preparation. |
| `integration.test.ts.txt`: enterprise workflows and global retention | Current `integration.test.ts` retains 10 workflow cases across conversations, memories, facts, canonical context hierarchies, versioning/search/statistics and scoped governance. Context transcript linking receives CAPABILITY_NOT_READY before effects while ordinary workflow data/hierarchy remain supported. Three governance cases positively exercise scoped policy, templates, simulation and override boundaries; manual worker enforcement refuses without purging audit data. |
| `gdprCascade.test.ts.txt`: universal space purge and global manual governance | Current `gdprCascade.test.ts` retains 22 cases, including positive administrative conversation/memory/fact erasure, empty space, same logical ID two-tenant preservation, fact soft/hard/bulk deletion and metadata hierarchy retirement. Public context retirement retains tombstones; scoped governance exposes actual simulation-only reports/statistics and no client worker authority. Supported legacy erasure does not claim runtime metadata or governance purge. |
| `sessions-workflow.test.ts.txt`: userId labels as impersonation and transcript activity | Current `e2e/sessions-workflow.test.ts` keeps all original 13 session workflow cases, using five explicitly declared owned actor/space plans and genuine verified public transports. Session create/touch/end, multi-device/endAll/selective logout, metadata, getOrCreate renewal, filtering/counts and concurrent unique creations remain positive. Two former transcript activity paths meaningfully assert current capability refusal and persisted conversation/memory no effects while session activity succeeds; an added forged actor and cross-space concealment case checks unchanged native session rows. |

Native lifecycle setup after each dedicated reset runs the accepted internal
`referenceMaintenance` start/backfill/finalization/validation/activation protocol
before public fixtures insert primary rows. This honors the current preparation
gate and never calls raw maintenance deletion or invents lifecycle readiness.
