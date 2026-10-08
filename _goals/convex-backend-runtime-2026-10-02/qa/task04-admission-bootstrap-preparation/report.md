# Deployment policy and qualified-cost bootstrap trust seam

Status: PREPARATION_COMPLETE; production ledger HELD; no implementation or service evidence.
Pure C2 NEEDS_REVISION3.4/C3 repair is active; none of its current types imply acceptance.
C11 foundation PASS4.6 remains accepted, full03/whole04/goal incomplete. This preparation
preserves every original criterion and approved scope; only numerical review caps are waived.

## Actual control authority and consequential gap

`RuntimeAuthorityReference` is necessarily tenant-scoped. `admin` is a capability on a
trusted scoped grant, never a deployment wildcard. `recheckAuthority` reloads generations,
expiry, resource scope and tombstones; even tenant-wide resourceAccess does not confer
cross-tenant or deployment control. Existing `runtimeAuth.provision` is internal-only and
accepts operator-provided bootstrap inputs without an application admin reference. Its
comment describes the trusted deployment operator boundary; it does not introduce a
deployment-level application capability. Existing internal maintenance preserves controls
and excludes arbitrary authority-table mutation. Neither ordinary metadata records nor
host JWT claims establish model pricing or policy provenance.

Therefore the admission proposal's generic `provisionPolicy(reference,policyCanonical)`
and `provisionQualification(reference,...)` cannot treat a successful scoped-admin check
as authority to install deployment hard bounds or to certify model prices. Internal
visibility prevents direct public invocation; it does not make arbitrary data passed by
an application handler a truthful cost attestation. There is no current trusted deployment
policy/price root in the source. This is an implementation trust-root gap resolvable by the
bounded server bootstrap below; no new product decision or user approval is needed now.

## Smallest concrete root: reviewed immutable server manifest

Add one backend-only module `convex-dev/runtimeModelPolicyBootstrap.ts`. It contains an
immutable manifest registry installed with the deployment code, empty by default. Root
entries are added only from reviewed qualification evidence by the authorized deployment
operator through the ordinary deployment-artifact change path. No environment/JWT/public
configuration/tenant database record can insert or select arbitrary policy/cost payloads.
An operator's ability to deploy code is the root of trust already necessary for this
backend; this proposal does not create a new signing authority or secret bootstrap token.

Registered internal `installDeploymentPolicy` in `runtimeModelPolicy.ts` accepts exactly
`{manifestId:string, expectedRevision:number}` (finite positive safe integer). It selects
the compiled manifest entry by exact equality, validates it, then transactionally installs
its deployment policies and qualification records with immutable root provenance. It
accepts no tenantId, actor admin reference, policy blob, prices, bound boolean or arbitrary
receipt. Missing/unknown/empty/malformed/ambiguous manifest fails closed before writes.
Only a trusted deployment operator or narrowly enumerated server installation caller may
invoke it; no public route, tenant-admin proxy, user-selected function dispatch or background
payload may forward manifestId to this helper. Import-aware caller inventory verifies that
property. Internal visibility alone is only one part of this control.

Repeated exact revision+canonical payload is idempotent. A changed payload under the same
manifestId/revision conflicts. New root revision installs new immutable versions; it cannot
rewrite admitted snapshots, relabel vectors, reset account debt or erase old provenance.
Emergency revocation is explicit and current and remains capable of blocking future calls.
Root installation has no model/token/provider call and does not itself certify readiness.

Minimal persisted root provenance on existing proposed runtimeModelPolicies and
runtimeModelQualifications, with explicit v.object validators (no new root table needed):

- kind `deployment-manifest-v1`, manifestId, manifestRevision, manifestCanonical/hash;
- deployment artifact revision/source digest identifying the installed reviewed module;
- qualification evidence packet IDs, immutable evidence manifest/hash, reviewed acceptance
  receipt hash, supported provider/interface/package versions and evidence classification;
- installedAt backend timestamp, policy/qualification canonical payload hashes;
- qualification use classification `production-qualified` only when supported actual evidence
  has passed; synthetic fixtures are held in fixture-only registry/storage and never admitted
  by the production resolver. A boolean or string label alone is not proof.

These values come from the compiled immutable root, not mutation arguments. On admission,
resolution, checkpoint and replay, stored records must match the active installed root
entry exactly and remain unrevoked. Any row fabricated with a syntactically valid provenance
string/digest fails that comparison. The hash indexes evidence; exact canonical equality
prevents collision substitution. Retained superseded roots support original attempt accounting
and audit, while explicit active/revoked root status gates new dispatch. Initial empty root
is a capability failure, never a fallback to caller/environment/default price estimates.

## Tenant administrator writes only authorized own narrowing

Separate internal `provisionTenantPolicy` takes
`{reference, expectedVersion?, tenantPolicyCanonical}` and rechecks current admin on exactly
the reference's own tenant and allowed resource scope in the native mutation. Parsed policy
must have scope tenant (or owned immutable agent-version specialization at its later gate),
matching tenantId and no deployment/global fields. Agent lookup must prove same tenant,
actual registered version and ownership. Ordinary constraints intersect the active root's
allowlists/interfaces/capabilities/options/tools/fallbacks and take tighter caps. Tenant
records may choose only an already root-qualified model/interface/receipt and pins that
match its existing qualified evidence; they cannot provide qualification payloads, new
price/bound revisions, an arbitrary 'covers all charges' assertion or new global budgets.

Trusted tenant overrides remain scoped, recorded actor/change revision/authorization and
never broaden deployment hard bounds. No actor obtains read/run/inference/cache privileges
from policy admin. Deployment and qualification provisioning have separate input schemas
and code paths, so a tenant-scoped branch cannot accidentally fall through to bootstrap.
Tenant admin may disable an own operation or narrow a limit; cannot remove another tenant's
policy, revive a deleted scope or revoke/replace the global cost root. Existing reference
versions/expiry/tombstones are checked again at final write, with no caller claim authority.

## Exact cost receipt consumed by Gateway/admission

Coordinated with `task04_gateway_dispatch_preparation`: actual pure shape is
`TrustedModelQualification {receiptId,modelId,nativeInterface,capabilities,allowedOptions,
limits,costBound,priceRevision,boundRevision}`; costBound is
`{kind:'qualified-call-ceiling',maximumCostUnits:positive,provenance:nonempty,
coversAllProviderCharges:true}`. Price/bound revisions are on qualification, not costBound.
Keep this exact shape; attach root-owned verification metadata in the persisted qualification
record and supply only verified pure payload to the resolver.

An admissible root evidence packet must establish exact model and native interface/provider
versions, immutable revision, full feature whitelist/restrictions and relevant default
behavior; full final prompt/messages/tool schemas/results/output-schema input bounds,
qualified tokenizer+framing bound (or documented conservative rule), enforced output cap,
USD/micro-USD safe-integer conversion/conservative rounding, all supported provider charge
classes and a complete cost-ceiling derivation at these complete caps. Optional caches,
reasoning/media/server-side tools/routing/features are either fully covered or rejected at
final params. A narrow text qualification can reject unsupported features initially, but
all required feature gates remain pending until actually qualified; no scope waiver.

Receipt must separately specify supported terminal cost authority: verified aggregate charge
for the exact attempt, or complete revisioned price rule with all applicable usage classes.
A predispatch ceiling is not observed spend. Gateway Chat extractor forwards numeric cost
and object costDetails without validating finite/completeness; native Responses lacks that
Chat extractor, embedding token usage alone is not a complete price rule. Installed APIs
supply no predispatch tokenizer/price authority. Missing terminal price knowledge retains
unknown monetary liability, even with known tokens/terminal upstream proof. Zero cost is
never inferred. No real cost/readiness entry can be populated from currently inspected
Task01 receipts alone; parent later owns actual evidence qualification.

## Exact minimal files and meaningful checks (proposed; NOT_RUN)

| File | Later change |
| --- | --- |
| `convex-dev/runtimeModelPolicyBootstrap.ts` | New backend-only immutable reviewed root registry and pure exact-entry validation, empty default |
| `convex-dev/runtimePolicySchema.ts` | Add explicit root provenance to already proposed policy/qualification tables, no independent deployment capability/table |
| `convex-dev/runtimeModelPolicy.ts` | Separate internal root selector/install and scoped tenant narrowing registrations/helpers; consume stored payload only after exact root validation |
| `tests/unit/runtime/model-policy-admission.test.ts` | Extend planned tests with root/tenant authority/currentness/atomic install cases |
| Proposed owned Task04 admission fixture `convex/qualificationOwned.ts` | Fixture-only synthetic manifest injection and native transaction assertions; production root remains empty/unqualified unless real accepted evidence exists |

Assert healthy root exact install/idempotency and atomic rollback, forged root/hash-collision
canonical mismatch, absent/revoked/ambiguous entry, revision mismatch, changed same-version
payload, synthetic fixture provenance denied by production resolver, wrong model/interface/
feature/token/price revision, malformed complete-charge proof, and no token/fetch on failures.
Tenant-admin negatives include global/deployment scope, foreign tenant, own/space-grant
scope mismatch, expired/revoked reference, qualification write/blob injection, cap/allowlist
expansion and nonqualified model choice. Healthy own narrowing succeeds and different
trusted operations retain independent selected model policy. Native actual publication must
prove install/provision helpers exist as internal, no public alias, public tenant requests
cannot cause root writes, and import-aware caller inventory has no tenant-controlled bootstrap
proxy. Native concurrent installers with same revision produce one immutable record set;
conflicting revision/payload cannot partially replace root or account debt.

Offline fixture proofs establish logic, not cost truth. Production manifest acceptance
requires stored/versioned actual evidence reviewed independently, followed by parent-owned
verified disposable codegen/publication and governed call outcomes. No service/network/test/
codegen/Git/source/oldQA edits occurred in this preparation. Only this NEW report and its
source-evidence.json were written. The remaining consequential qualification conflict is
absence of actual complete monetary/token bound evidence; fail closed rather than invent
price/readiness or solicit user decisions. Ledger implementation remains HELD.
