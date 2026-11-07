# Cortex CI and package delivery

Use regular merge commits for every merge. Squash, rebase and automatic merging
are disabled; the former squash-based Auto-Merge workflow is retired. Main keeps
its review, security, deletion and force-push protections without the contradictory
linear-history requirement.

## Functional checks

`PR Checks` runs on main pushes, supported pull requests and explicit dispatch.
Every PR receives root lint, types, current controlled SDK unit discovery, packed
public contracts and pipeline regressions. Affected CLI/provider packages receive
their offline checks; package and template changes select their consumers too.
Git extraction retains both deleted and added paths when files move.

Drafts defer affected service coverage. Fork and bot PRs report that coverage as
unavailable; their passing offline checks do not certify managed or native services.
Marking a trusted PR ready runs the applicable service gate. Main pushes always
select the full gate. `All Checks Passed` requires every selected job to succeed;
missing, cancelled or unexpectedly skipped jobs fail it.

Offline quality uses five native Jest shards of the complete controlled-unit
file discovery, with serial execution inside each shard. Every shard must exit
naturally within the existing 240-second process deadline: TERM, then KILL after
five seconds. The existing 60-second per-test limit remains. Pipeline regressions
verify that the five groups cover every discovered file exactly once.

Controlled unit checks use fake transports and Gateway peers, including current
runtime, installation, policy and natural-close contracts. Both Gateway regression
catalogs run against the current capture and atomic attachment contract; earlier
fixture bytes and qualification failures remain preserved QA evidence. Managed jobs preserve complete
SDK, provider and CLI discovery, then select authenticated runtime integration and
the provider's remote AI SDK parser contract. Eight native proof files and real graph
contracts run separately. Discovery counts describe selected files, not executed
tests; inspect hosted results and inherited skips separately. Missing target,
identity or qualified model prerequisites fail service coverage explicitly.

## Permanent main contents

Main-target pull requests and main pushes enforce `.main-release-policy.json` against
the complete committed candidate tree before selecting coverage. Internal development
records remain on dev; unchanged forbidden files and paths outside sparse checkout
also fail. Use `npm run release:prepare` to create a filtered normal-merge release
branch, then open an ordinary main PR. See [branch contents and promotion](release-branches.md).
Local validation may be explicitly waived for an operation; GitHub checks, reviews,
main-push qualification and publishing prerequisites remain required. Never use a
CI-skip marker or administrator bypass as a substitute for that path.

## Shared deployments and candidate packages

Offline checks and isolated demo, graph and native containers run outside the
shared backend lock. The called managed workflow holds `cortex-shared-ci-backends`
through guarded preparation, all SDK shards, provider completion, CLI integration
and scoped cleanup. SDK unit shards stay serial, use `--runInBand`, and finish
before provider tests. Actual SDK runtime coverage executes once on shard one.
Selected Jest processes use natural shutdown; graph and runtime contracts have
bounded termination and a five-second escalation window.
Do not cancel an active shared lifecycle to accelerate another candidate.

Managed runs use GitHub's larger pending queue and refuse stale candidates before
shared preparation. Development keys must match two distinct allowlisted disposable
deployment URLs before writing auth configuration or deploying. Consumers receive
scoped verified-host JWTs and no deployment keys. Backend model policy is installed
from the pinned qualified manifest; consumers carry no application inference keys.
Both target retirements run independently after failures or cancellation, and their
observed success is required in the exact-candidate managed receipt.

A queue probe proves scheduling only: it carries no
backend/model secrets, performs no service mutation and cannot qualify delivery.

Demo jobs reuse SDK/provider archives and the built CLI composer from one exact
candidate artifact. Verify the manifest's source SHA, package identities and byte
hashes before installing. Ordinary/frozen demo installs and transitive provider-to-SDK
closure validation remain required. Runtime setup uses Node 24.21.0, npm 12.2.0
and a lockfile-based npm download cache, never a shared `node_modules` cache.

CLI command fixtures bind the selected supported positive Node binary's actual
version and digest and require Node >=24.15.0. The retained `MINIMUM` input and
`minimum` receipt field identify that positive runtime; a Node 24.21.0 CI receipt
does not claim an exact 24.15.0 floor run. Legacy Node 20 binaries retain their
official checksum and exact version checks. Workflow launches use `node --` so
the environment output flag reaches the fixture script without native preloading.

Functional sparse checkouts omit captured `_goals` and `work` files. Their source
evidence is preserved. Security scanning retains its full Git history.

## Security outcomes

`Security Scans` requires actual CodeQL, Trivy, Gitleaks and Semgrep execution,
valid results and supported uploads. Dependency Review is required on PRs and
retains the reviewed vulnerability/license policy. Fork/bot PR scans use scoped
tokens and no vendor account secret. Only documented non-PR Dependabot upload
limitations are reported as unavailable uploaded coverage.

Scanner success does not mean zero findings. Gitleaks and Dependency Review apply
their blocking policies; uploaded CodeQL/Trivy/Semgrep alerts retain branch-rule
enforcement. Semgrep's authentic SARIF identity is `Semgrep OSS`. Explicitly
classified PartialParsing warnings are visible incomplete parser coverage;
scanner crashes, other errors, empty coverage, invalid output and required upload
failures block the summary.

PR/manual Scorecard analysis must complete, produce valid native SARIF and upload
successfully. Source checks bind the normal PR checkout or current default-branch
manual dispatch before/after scanning and before upload; stale sources fail.
Upstream PR/manual support is experimental and fork repositories are unsupported.
For PRs, one additional pinned native `Branch-Protection` check observes live
global repository settings. Its source fences are separate from the PR merge
checkout: the PR SHA identifies the evaluation context, not immutable settings.
The untouched local report and genuine settings report are validated as two
regular native SARIF files and uploaded together once. Empty settings findings
can mean a satisfied or inconclusive check; complete settings coverage is not
claimed. Manual runs keep their existing three-category remote report and do
not execute the additional CLI. Any required preparation, validation or upload
failure fails the mandatory Scorecard job and security summary.

Scores remain advisory. External Scorecard publication runs separately in
`Scorecard Publishing` on main pushes and its weekly schedule; `Security Scans`
does not certify that independent workflow's outcome.

## Delivery and recovery

A merge into **dev does not publish packages or deploy production**. Publishing
requires the exact current main SHA, successful latest main-push `PR Checks` and
`Security Scans`, successful uploaded CodeQL from the expected GitHub app, and
success for every applicable Snyk status. A manual merge does not satisfy a failed
security prerequisite. Scheduled scans do not independently qualify a release.

The direct main-commit vendor route remains preferred. When a main CodeQL check
or Snyk context is genuinely absent, the approved source-equivalence route may
qualify that absence using the normally merged PR's actual vendor passes. Any
present main pending, failed, cancelled, neutral, skipped or unknown result vetoes
reuse. Both latest PR-head vendors remain mandatory: `CodeQL` from App57789 /
`github-advanced-security`, and every `security/snyk` context including
`security/snyk (nicholasgeil)` from the recorded User63267399 and Snyk PR-check URL.
All pages and every latest context are considered, including newer failures.

This route authenticates one merged PR in the public, nonfork repository, with
base main, merge SHA equal to current main M, ordered parents [B,H], and exactly
equal M/H Git trees. B is the immediate first parent. Main's own latest successful
push CI and Security workflows remain required; PR CI cannot replace them. The
latest native CodeQL analysis is selected separately across trusted main-source
Security runs, including schedules. A newer pending or failed native run refuses
qualification even if an older push scan succeeded.

For M and B the gate downloads the genuine immutable CodeQL artifact and exact
job log, verifies repository/run/attempt/job/source, artifact SHA256 and single
bounded ZIP member, and binds native UUID, checkout, upload identity and timing.
It validates complete per-file expected/extracted inventories and job coverage,
native execution, query/config/exclusions, resolved actions, tool/rule catalogs,
source workflow context and processing. Changed inventories require corresponding
immutable source additions/removals. Server SARIF needs exact repository/ref/SHA
provenance, consistent counts and complete successful processing. The retained
native reports have no embedded VCS record; authenticated Actions custody remains
required. Supplied optional VCS/base/source claims must be coherent with it.

Complete native M results must be a multiset subset of complete native B results;
the complete server reports are compared independently. Only object-key ordering
is canonicalized. Every field, value type, nested array order and duplicate count
is retained. Complete removals, including zero findings, are allowed only with
all other positive provenance/catalog/config/extraction proofs. New or modified
objects, excess duplicates, incomplete coverage, truncation, unknown data, API
permission errors and resource bounds refuse qualification. Inherited findings
remain visible; no thresholds, queries, suppressions or vendor are removed.

Before comparison, a built-in validator checks the complete frozen official
SARIF2.1 schema; readiness does not import installed dependencies. Original JSON
text is checked for duplicate decoded member names, unsafe/nonfinite numbers,
precision loss and underflow before parsing. Negative zero remains distinct in
the complete finding comparator. Schema validation never inserts defaults.

The separately approved v4 processed-export profile handles two observed GitHub
server deviations only: a direct related-location numeric index0 conflicting
with its explicit normalized source URI, and exactly `message: {}` corresponding
to an absent native related message. Such exports are explicitly reported as
`NONCONFORMING_SARIF_2_1_EXPORT_PROFILE`, never SARIF-standard-valid. Every other
schema/source/reference error, every native schema failure, and any unsupported
or ambiguous profile refuses. Ordinary valid server reports retain the strict
source route without requiring this profile.

For that profile, every result occurrence must bind to its own authenticated
native source role using resolved rule/component identity, complete ordered
primary source/message facts and all available server fingerprints. Distinct
complete objects sharing an ambiguous identity refuse; identical duplicates must
have exactly matching multiplicities. The whole ordered related collection must
match native source/extraction, typed span, id and message facts. Same-line
endLine expansion and absent-native-message binding are additional provenance
interpretations only. They never rewrite either report or replace the separate
complete-original M/B multiset comparisons.

Supplied rule and component index, name, GUID, ruleId and legacy ruleIndex
selectors must all identify the same actual local descriptor/component.
Driver and extension catalogs are distinct; absent, contradictory or ambiguous
identities refuse. The same checks cover typed native notification references
and the metric references already consumed by native proof. No first-match or
ignored-selector shortcut can choose a compatible identity.

The qualification label becomes
`qualified-source-equivalence/github-processed-export-related-source-profile-v4`.
Readiness JSON retains the original body/member/object digests, role/source and
producing custody, every anomaly pointer/original value, complete-object classes,
candidate occurrence lists, duplicate multiplicities, related source facts and
current-state fences. Observed anomaly counts are evidence, not allowlists.
Verified immutable caches pin both original server bytes and parsed-object
identity; final/cache checks do not claim an unobserved body was freshly read.

The summary keeps absent M records **missing** and separately reports
`qualified-source-equivalence`, H, actual vendor IDs and timestamps. This proves
source-input equivalence, not fresh M Snyk execution, equal vendor database/policy
state, equal evaluation time, or an independent administrative-bypass audit.
Normal protected merge and the operational no-bypass instruction still apply.
No Administration API, new PAT or App credential is used. Standard
`pull-requests: read` and `security-events: read` scopes are declared both for the
gate and the release job override. Actual default workflow-token access remains
unverified until genuine hosted execution; operator reads and local fixtures do
not establish that capability.

Read the Publishing job summary first. It distinguishes ineligible/superseded
sources, pending/failed prerequisites, no changes, partial delivery and completion.
The gate paginates relevant checks and reconciles late results within a bounded
window. If results arrive later, dispatch Publishing on main with its exact
40-character SHA and `mode: dry-plan`; repair any reported prerequisite before
requesting `mode: recover`. Both modes use the same security/source contract and
the qualified immutable `delivery-paths` artifact. Recovery has no security waiver.

Publication rechecks current main, latest prerequisites and the selected artifact
run, attempt, artifact ID and digest immediately before effects.

The artifact's producing `Detect File Changes` job must belong to that exact
latest workflow attempt and source. Its authenticated job metadata and timestamped
log must identify the checkout and the upload's artifact ID, digest, size, run URL
and timing. An earlier attempt's retained artifact is refused, even if the later
workflow succeeds; producer attempt is never inferred from workflow metadata.
Potentially authoritative records are validated before exact-source/provider
filters: incomplete known-App checks, native source runs, analysis environments
or own-main workflow records cannot be discarded to resurrect an older pass.
Conclusive other-App records remain unrelated.

Merged-PR association pages must also establish complete candidate identity before
filtering. A fetched detail must match its list entry and requested PR number.
Explicitly unmerged records with nullable GitHub fields and positively unrelated
PRs are allowed as unrelated. Native analysis selection distinguishes the selected
source/job's JavaScript context from genuine Python or other workflow histories;
a contradictory newer category in that context cannot expose an older green.
Final producer verification uses the freshly selected workflow record, including
its path and actual start time, for both required own-main workflow identities.
Known required workflow names and paths are both authority signals: a contradictory
name on a required path cannot hide a newer failure. Native custody validates the
actual workflow/job/attempt, ordered successful step intervals, and artifact
creation/update against its producing upload. Timestamped checkout, UUID, coverage,
processing and upload ID/digest/size evidence must occur in their genuine job
phases. Whole-second GitHub metadata denotes that second; this precision allowance
does not increase request, polling or gate timeouts. Complete semantic custody is
rechecked on final reads and when verified immutable bytes are reused from cache.
In CodeQL-scoped responses, a contradictory check name from the known App or a
contradictory native tool identity cannot establish unrelatedness. Basic identity
must be coherent before source, workflow or language exclusions are considered.
Only a positively different App excludes a check; consistent other CodeQL
workflows and Python histories remain unrelated to the selected native JS job.

The latest PR binding, vendor verdicts and native analysis/processing authority
are rechecked after immutable
downloads; only verified immutable bodies are cached. The existing seven
observations, ten-second requests/intervals, ten-page limits and five-minute gate
remain bounded. Native ZIP/member, server SARIF and log limits fail closed rather
than truncating evidence. Publication preserves SDK → provider → templates → CLI
ordering and registry visibility checks. A partial publication is not a complete
release; recovery reuses accepted same-source versions instead of republishing them.

## Qualification evidence

Pipeline receipts and nonpublic captures live in the private Cortex Proofs checkout,
under `pipeline-audit-2026-10-09/`. Goal/task records distinguish source review from
hosted queue, upload, artifact and complete trusted-run qualification. Report elapsed
time, runner minutes and model/API spend separately; test discovery or a shorter
selected scope is not proof of an equivalent faster full gate.

The readiness CLI requires `READINESS_RECEIPT_PATH`, an absolute `.json` path in an
existing directory. Linux directory descriptors and no-follow file operations keep
writes and readback anchored to that directory; existing destinations, aliases,
hardlinks, incomplete writes and oversized receipts refuse qualification. The full
payload retains JSON types, negative zero and every proof field/occurrence. Shared
engine/component/rule and complete-class tables are referenced by ordered occurrence
records to avoid duplicating large provenance metadata. Original finding objects and
their multiset comparisons are unchanged. The complete receipt uses the existing
8 MB byte ceiling and is never printed as a potentially truncated log object.

Publishing retains separate complete gate, final and publication-fence JSON artifacts
with names containing the publishing run ID and attempt. Missing or failed artifact
retention cannot authorize publication. After the final receipt is uploaded, a fresh
complete `--once` readiness check must have an exactly equal entire result payload,
including every latest vendor, workflow, native-analysis, source and artifact fence.
The payload retains the validated semantic observation ledger, including workflow
run IDs and attempts, so a new successful attempt at the same run ID also differs.
It excludes unrelated mutable account-profile counters and HTTP transport data.
`EXPECTED_READINESS_RECEIPT` plus `EXPECTED_READINESS_RECEIPT_SHA256` bind that check
to the exact verified file selected before its upload; the CLI logs only
the small retained-file/payload digest fence. Any difference blocks publication. The
second complete observation is also retained after the publication attempt. Offline
operator readers can write to a unique `/evidence/<name>.json` while mounting source
read-only. Receipt creation and local replay do not prove hosted token capability,
artifact retention, trusted publication or acceptance of a future main candidate.

Every schema-typed source reference and region is validated before choosing the
normal strict export or processed-export route. Native invocation/graph and other
unused references cannot evade index/base checks. Artifact parent chains must be
bounded, acyclic and rooted; nested member/offset identities stay distinct from
host files. Explicit executable, stream, attachment and directory metadata is
validated in its standard-defined context and cannot substitute for analyzed
repository-source coverage. Custom property bags remain opaque. Optional native
VCS/base metadata remains optional, and an explicit source claim must be coherent.

The supported VCS mapping forms are optional omission, an explicit empty `uri`
with a resolvable base, or the concrete authenticated checkout directory (including
a directory spelling without its trailing slash). General OASIS3.4 constraints and
its3.23.8 mappedTo example differ on a base-only form. This gate adds no validity
exception for unresolved `{}` or `index:-1` mappings; corrected compact fixtures
and the normative discrepancy are retained for independent review.

Region ordering/defaults apply to native and server primary, related, flow,
stack, graph, context, annotation, attachment and fix positions, even with zero
results or no export anomalies. Multiline spans and zero-length/EOF insertions
remain supported. Whole artifact contents, encoding and column units support
size/cross-coordinate checks when actually available; snippets are not whole-file
size evidence. Unsupported ambiguous conversions refuse qualification. Original
finding objects are never rewritten, and the approved provenance mappings remain
separate from these checks.

URI formats use RFC3986 component grammar rather than WHATWG parser acceptance.
Grammar-valid percent octets are distinct from the stricter file/source-path
control checks. RFC3339 calendar validation uses the complete factual27 IERS leap
insertions through2017, including offset-equivalent representations. Unknown or
unannounced second60 values fail closed; ordinary future timestamps have no
calendar-expiry gate. Existing proof-critical UTC chronology is unchanged. The
frozen schema's date-time format and the separately defined optional release-date
syntax remain distinct; no third processed-export format exception is introduced.

Receipt publication keeps the original write FD open while checking the installed
and readback device/inode, ownership, mode0600, size and expected owned-link
transitions. Matching bytes cannot excuse replacement or chmod. Temporary data
uses an owned0700 staging directory; success removes that empty owned directory.
On a failed custody fence the writer retains uncertain names and never deletes a
foreign destination or recursively cleans unknown data. These bounded fences do
not claim immunity to arbitrary same-privilege changes after the final observation.

The supplied SARIF relation validator follows schema types and their actual owners.
Run/result graph selectors, all nested node and edge IDs, connected edge traversals,
result invocation provenance, result-local location relationships and cached source,
address and HTTP objects must resolve within their own tables and namespaces. Every
unused supplied table is checked too. Directed graph cycles and self-edges are
valid; structural parent/cache chains must be rooted and acyclic. Opaque property
bags are not searched for arbitrary keys named `index` or `id`. Supplied unmaterialized
external proof tables cannot establish a complete report; the gate does not fetch them.

Physical contexts require a region and a provable proper superset. Supplied region
byte length must equal the absolute value of the effective address length, including
negative address lengths. Supported line/column, character and byte defaults, insertion
points and EOF remain valid; unsupported cross-coordinate or unknown end-of-line
comparisons refuse without inventing content, coordinates or source sizes.

Source and content checks share a per-role artifact identity view. URI-only, index-only
and supported URI/base aliases consume all coherent known inventory text, binary,
length and encoding evidence. Missing optional metadata cannot erase known evidence;
conflicting or ambiguous views refuse. Named nested members remain distinct from their
containers, and known complete content is never inferred from a snippet. Genuine absent
inventory/content stays unavailable rather than becoming a universal inventory requirement.
For the exact approved processed-related index-zero mismatch, the explicit source
reference remains pending until its complete own-native occurrence correspondence
succeeds. Only that bound explicit identity supplies content evidence; the unrelated
artifact at index zero cannot supply it. Original URI/index/message/result objects and
both complete result-multiset comparisons remain untouched. Cold semantic refusals and
actual warmed-cache custody/source/authority refusals are recorded separately.
Repeated references do not repeatedly expand a cached location's opaque validation
identity: each actual typed object is memoized within its synchronous observation,
its full canonical bytes are charged to the existing work ceiling, and it is checked
again before return. Every occurrence, owning ID and simultaneous cache fact is still
validated. These temporary identities never survive into another role, snapshot or
mutable authority observation and do not deduplicate any original finding or table.


Location IDs are scoped to one result and one actual declaration. Equal inline
location objects in different fields are distinct declarations; sharing an ID
refuses qualification. Repeated validated views of the same thread-flow cache
entry retain that entry's identity, while preserving every occurrence and all
explicit cache-field checks. Object-content memoization only bounds work; it
never establishes declaration or vendor authority.

Taxonomy references use their actual `taxa` catalogs. Standard `run.taxonomies`
entries require `taxa` and prohibit `rules`/`notifications`; custom driver and
extension catalogs may contain all three. Optional external taxonomy identities
cannot provide materialized CodeQL query/configuration/coverage proof. Supplied
component and descriptor selectors must agree with their real table/slot; a
serialized component index cannot stand for the driver default.

Typed message source links and actual argument placeholders are checked within
their result, component and catalog context, including effective cached uses.
Ordinary program-brace strings and unused templates are not recursively formatted.
Direct generic metadata text retains the documented lookup precedence. The
bounded, non-rendering link recognizer uses pinned GFM0.28 syntax/factual tables;
it does not execute HTML, fetch links, or claim a general Markdown renderer.
Canonical integer destinations require a unique result-local location ID;
`-1` is forbidden by SARIF's negative-link rule. `00`, `+1`, encoded URI paths,
and paths/queries remain ordinary legal URI references without an invented
artifact-inventory requirement or repeated decoding. Both original complete
native/server result multisets, every raw field and duplicate, the exact two
approved export anomalies and all immutable source/custody fences remain intact.

Links parsed inside image descriptions retain the same owning-result target
checks even when HTML alt rendering omits anchors. Image destinations themselves
remain image URI references; rendered-anchor absence is not source completeness.

<!-- Repair04 ownership note: OASIS3.11.7 requires a single defining component.
     Carrying an actual materialized enclosing rule/notification component to
     descendant message IDs is an implementation ownership inference. Only the
     direct result/notification message uses descriptor.messageStrings;
     descendants use that component's globals, respecting more-specific lexical
     and conversion contexts. No foreign-catalog search or associatedRule owner
     substitution is permitted. -->


The reference lexer follows the pinned GFM0.28 distinction between complete inline
HTML/autolink tokens and active bracket syntax. Invalid angle candidates do not
hide source links. Legal quoted and unquoted attributes stay literal, including
brackets in unquoted values. Ordinary ASCII whitespace (including VT/FF), blank
space/tab lines and Unicode whitespace remain distinct. All seven raw HTML block
families use their actual start/end, paragraph and container rules; an ending
line belongs to its raw block, and only type7 cannot interrupt a paragraph.
Raw blocks end at their own container or EOF, and code/HTML/link parsing does not
join unrelated inline leaves. Parsed image-description links remain source links.
These are non-rendering syntax checks; no HTML execution, URL fetch or renderer
conformance is claimed. Original message/result values remain unchanged.

Base-language direct strings select before catalog interpolation. Actual direct
result/notification descriptor selectors and messageStrings key coverage remain
independent requirements even if the covered template is shadowed. Supplied
translations must preserve complete localizable metadata; only matching-owner,
demonstrably compatible foreign-language alternatives are selected. Optional
version defaults use actual fields. Unknown compatibility remains unverified and
unselected, without inventing missing metadata or claiming foreign-display
qualification for a valid base path. Unused/inapplicable templates are not given
argument obligations. D05 producer ownership, lexical/conversion contexts and
each effective cached result still select their actual component.

Search-work accounting includes successful and failed terminator attempts,
including unmatched code spans, and charges scan/copy/expansion/lookup work under
the original96M ceiling. It does not measure native engine instructions or prove
real-time DoS behavior. Large column-zero unclosed HTML comments are literal
blocks, so work diagnostics use actual repeated failed backtick searches instead
of manufacturing obligations inside a valid raw block. Existing full finding
multisets, source/custody/authority fences and complete retained receipts remain
unchanged. Cold semantic denials and actual warmed-cache custody failures keep
their distinct evidence labels.


Formatted source messages use separate pinned GFM0.28 table stages. The complete
raw marker and after-pipe padding grammar admits SP/TAB/VT/FF; post-split cell
buffer trimming admits only TAB/LF/CR/SP. Structural blank lines and indentation
retain their SP/TAB rules. Supplied NBSP and other Unicode characters are never
erased to manufacture a marker or an outer pipe. Optional pipes and one-or-more
hyphens remain supported after core block precedence. This position-specific
interpretation is corroborated by the official source at the same pinned commit
(ext_scanners.re, table.c, buffer.c and cmark_ctype.c), resolving prose ambiguity;
it does not claim universal renderer conformance. The existing cmark copyright
and license notice is retained with the bounded adaptation.

Escaped punctuation determines table cells before inline code/link parsing.
Derived pipe unescaping and cell trimming never rewrite original findings.
Only a proven table can ignore genuine excess data cells; a non-marker row stays
ordinary paragraph text whose active source links must resolve. Every attempted
marker/row/cell scan, copy and ignored region stays within the unchanged work
bound, including failed recognition. Native and server complete-object multiset
comparisons, immutable custody and all current source/authority fences remain
independent mandatory prerequisites.


The bounded GFM 0.28 message-reference parser ends an established table before a nonblank line indented four columns relative to its actual quote/list owner. Indented code stays literal; a dedented line resumes ordinary block and source-reference checks. Tabs retain their actual four-column stops and paragraph laziness applies only to an actual open paragraph.

Prefix-local blank ownership uses current direct children. An open paragraph counts before that line's blank-prefix check; finalization can then remove a paragraph containing only reference definitions while retaining its registered definitions. A later blank recomputes child presence. Persistent direct containers remain after their descendant paragraph disappears. Genuine table/setext conversion preserves the converted block kind and does not register its text as a global reference-definition paragraph. This bounded syntax-state adaptation is an implementation inference from the pinned core; it does not claim a complete Markdown renderer. Original native/server findings, complete multiset comparisons, approved processed-export profile and all source/custody/authority/resource gates remain unchanged.
