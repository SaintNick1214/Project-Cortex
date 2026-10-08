import pathlib,json,hashlib,shutil,re,datetime
R=pathlib.Path('/workspace/Project-Cortex');W=R/'work/resume/task04-terminal-capture-native-profiles-c2-review';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-profiles-c2-review';P=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-extension-preparation-c2'
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,indent=2)+'\n')
# Persist exact command preimages; sources remained unchanged except the explicitly recorded missing-sibling import correction.
for cmd in Q.glob('*/command.json'):
 d=json.loads(cmd.read_text())
 for row in d.get('sourceBindings',[]):
  p=R/row['path'];data=p.read_bytes()
  if hashlib.sha256(data).hexdigest()!=row['sha256']:
   if p.name=='offline-publication-artifacts.mjs':data=data.replace(b"'/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c4/scripts/guard.mjs'",b"'../../task04-native-admission-fixture-c4/scripts/guard.mjs'")
  assert hashlib.sha256(data).hexdigest()==row['sha256'],str(p)
  dest=cmd.parent/'source-preimages'/row['path'];dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
for p in [R/'AGENTS.md',*[R/'.agents'/n for n in ['CODEX-RUNTIME.md','PROJECT-PROFILE.md','roles/pessimistic-judge.md','skills/judge-task/SKILL.md']],R/'_goals/convex-backend-runtime-2026-10-02/goal.md',R/'_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md',R/'_research/convex-ai-gateway-2026-10-02/architecture.md',R/'_research/convex-ai-gateway-2026-10-02/decision-gates.md',R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-product-c2-review/report.md',W/'review.py',W/'budget.test.mjs',W/'finalize.py']:
 dest=Q/'context'/str(p.relative_to(R));dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
for b,label in [(P,'extension'),(P/'regression','regression')]:
 for n in ['runtime-freeze.json','qa-manifest.json','report.md','cases.json','runtime-inputs.json','source-inventory.json','registration-inventory.json','nested-invocation-inventory.json']:
  if (b/n).is_file():dest=Q/'original-inputs'/label/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(b/n,dest)
 for row in json.loads((b/'runtime-freeze.json').read_text())['files']:
  dest=Q/'original-inputs'/label/row['path'];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(b/row['path'],dest)
 for row in json.loads((b/'runtime-inputs.json').read_text())['externalSources']:
  dest=Q/'external-source-preimages'/row['path'];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(R/row['path'],dest);assert h(dest)==row['sha256']
rows=[]
for label in ['extension','regression']:
 out=(Q/(label+'-handlers')/'stdout.txt').read_text();cases=[json.loads(s) for s in out.splitlines() if s.startswith('{"id"')];base=P if label=='extension' else P/'regression';plan=json.loads((base/'cases.json').read_text());assert len(cases)==len(plan['scenarios']);rows.append({'profile':label,'cases':cases,'observedOfflineRPC':sum(x['rpc'] for x in cases),'observedOfflineCommittedCreates':sum(x['committedCreates'] for x in cases),'sourceBoundCeilingSum':sum(x.get('sourceBoundRpcCeiling',x['rpcCeiling']) for x in plan['scenarios']),'budgets':plan['budgets']})
write(Q/'case-discovery-and-counts.json',rows)
comparison={'c8AssertionsByteExact':(P/'regression/scripts/cases.mjs').read_bytes()==(R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c8/scripts/cases.mjs').read_bytes(),'bothCopiesSameOriginalAssertions':(P/'regression/scripts/cases.mjs').read_bytes()==(P/'scripts/original-b-cases.mjs').read_bytes(),'product':[]}
for n in ['runtimeModelPolicy.ts','runtimePolicySchema.ts']:
 src=R/'convex-dev'/n;comparison['product'].append({'path':str(src.relative_to(R)),'sha256':h(src),'extensionSame':src.read_bytes()==(P/'fixture/convex'/n).read_bytes(),'regressionSame':src.read_bytes()==(P/'regression/fixture/convex'/n).read_bytes()})
write(Q/'source-comparisons.json',comparison)
# Repeat complete independently derived sets and hashes after all fresh runs.
pre=json.loads((Q/'frozen-pre.json').read_text());post=[]
for b in [P,P/'regression']:
 m=json.loads((b/'qa-manifest.json').read_text());paths=sorted(str(x.relative_to(b)) for x in b.rglob('*') if x.is_file() and x!=b/'qa-manifest.json');post.append({'profile':str(b.relative_to(R)),'manifestSHA256':h(b/'qa-manifest.json'),'freezeSHA256':h(b/'runtime-freeze.json'),'reportSHA256':h(b/'report.md'),'rows':len(m['files']),'mismatches':[x['path'] for x in m['files'] if h(b/x['path'])!=x['sha256'] or (b/x['path']).stat().st_size!=x['bytes']],'setEqual':paths==[x['path'] for x in m['files']]})
assert pre==post;write(Q/'frozen-post.json',post)
summary={'verdict':'REJECT','scope':'PREPARATION_ONLY; exact immutable C2 primary and regression freezes','native':'NOT_RUN','paid':'NOT_RUN','UI':'NOT_RUN','officialPublication':'NOT_RUN','targetCreation':'NOT_RUN','signing':'NOT_RUN','cleanupRetirement':'NOT_RUN','scores':{'Requirement Fulfillment':2,'Code Quality':2,'Test Quality':4,'Pattern Adherence':4,'Completeness':2},'average':2.8,'freshOffline':{'extensionFamilies':22,'originalFamilies':43,'timingErrorsDiagnostics':20,'independentBudgetAdversaries':5,'publicationStageFinal':9,'skipped':0,'todo':0,'fixtureTypechecks':2},'setupFailurePreserved':'publication-stage-hostiles ERR_MODULE_NOT_FOUND; same original C4 import rebound absolute in review clone only','blocker':'Both consumed C7 parent-input helpers perform signatures and additional exclusive outputs after shared120s deadline can expire. Source-bound parent prerequisite independently rejected; current C2 packet cannot be preparation accepted.'}
write(Q/'verdict.json',summary)
report='''# Task Judgment: Task04 terminal capture native profiles C2

## Verdict: REJECT

Scope: preparation only, for the exact immutable primary and regression C2 packets. This judgment does not reject the accepted offline product repair or rewrite accepted B C8 native history. No native, signing, credentials, provision, deploy, codegen, service/network, paid, UI, cleanup or retirement action was executed. Whole Task04 and goal remain incomplete.

## Critical blocker

Both profiles consume the C7 parent-input helper pair in runtime-inputs.json. In `task04-terminal-capture-parent-inputs-c7-preparation/parent-inputs-extension.mjs:39–41` and the equivalent regression helper, the final parentDeadline before private/public key derivation is followed by eight signatures without another deadline check; the check before the initial provenance exclusive output is followed by historical locator, identities and peer-config outputs without intermediate deadline checks. A phase crossing the fixed120s deadline therefore permits additional privileged effects. The coordinator reports the separate fresh C7 judge independently reproduced these failures in a dummy VM and rejected that prerequisite. This review independently corroborated the missing checks by reading the exact hash-bound public sources; it did not sign, read private keys or rerun the parent main. Producer claims that the parent boundary is bounded cannot certify these consumed sources.

This is a required source-bound preparation prerequisite, so the exact C2 freezes cannot receive PASS_PREPARATION_ONLY. Repair in new source/profile packets, preserve C2 and the C7 failures, rebind every changed external input/freeze/complete manifest, and obtain both fresh independent reviews before any native action.

## Evidence Review

Node24.19.0 and npm12.2.0 were observed with the prescribed wrapper PATH prefix (ambient node, no replacement node). Fresh offline cloned compiled handlers passed all22 capture families and all43 original B families. Both strict fixture typechecks exited0. Twenty timing/error/diagnostic checks, five independently authored adversarial budget checks and nine final publication/stage checks passed with zero skipped/todo/cancelled tests. Logs, argv, cwd, UTC, source preimages and hashes are preserved per command. The initial publication/stage run failed loading a relative historical C4 public guard after relocation; the raw failure remains. Its review-owned import was rebound to the exact original public C4 source, without assertions or product changes, and the complete selection passed.

Original B assertions are byte-exact against accepted C8/scripts/cases.mjs; the primary original-b-cases copy is also identical. The43 offline source branches used471 RPC,671 committed creates; per-case original limits remain unchanged, with sourceBoundRpcCeiling=observed+2 (557 aggregate) enforced before dispatch by driver caseRPCMax. All22 capture families have meaningful accounting/privacy/state/duplicate/conflict/rollback assertions; concurrent fake DB work serializes and proves neither native OCC nor native nested rollback. Every native concurrency, late-window, original window and parent rollback proof remains NOT_RUN.

Both complete manifests were independently enumerated and every row rehashed before and after fresh executions: primary7696 and regression200 rows, no missing/extra paths, no hash/size mismatches. The exact supplied report/freeze/manifests remained unchanged. Fixtures use the approved exact product runtimeModelPolicy/runtimePolicySchema bytes. Both contain287 nonHTTP registrations,200public/87internal/16 product policy internal; qualificationCapture exposes only revokeOrigin,renewOrigin,partialMarker and parentRefinementRollback. Capture/attach validators remain exact and internal, with the two optional attempt fields; no added product tables/indexes/public proxy/provider dispatch or account reset/reseed was found.

## Requirements Review

| Requirement | Preparation evidence and limits |
|---|---|
| Approved Task04 model selection, trusted version pins, operation budgets, fallback and secondary-call constraints | Original43 source is exact, discovered and exercised. Goal/Task04/decision register/architecture read. Provider/model/price/token/Gateway truth remains NOT_RUN. |
| Equal/conflicting terminal refinement, full unknown100→known150 once, immutable initial facts, released slots, original windows | Capture22 compiled-handler assertions and raw counts pass. Native OCC/time/transaction behavior remains pending. |
| Current private attachment, no revival after unknown closure/revocation, ordinary/admin/operator compatibility and legacy/partial markers | Exact cases inspect money, full state, original grants, retired-scope gates, immutable initial bytes/hash and private-result exclusion; fake offline composition only. Accepted C2 unexpected-read requirements inspected; native DB read-fault injection explicitly OFFLINE_ONLY. |
| Public/internal/maintenance/peer full boundary | Actual driver retains200×7 denials,400 snapshots, healthy public mutable control,87×2 internal invisibility,5×4 maintenance validators and5 peer denials. Original auth prerequisites and both native issuance receipts remain parent-only pending. No absence-based publication acceptance. |
| BOTH current native physical IDs and historical C11 source custody | Source-bound C7 helper pair distinguishes historical9 locators/four original public-source hashes from new owned operation/attempt receipts; current table/operation/run/filename/hash/time witnesses and full arguments are required. No private C11 payload was opened. Parent prerequisite fails above. |
| Disjoint selectors and target ownership | Exact primary/regression request purpose/operation/run/project/private scratch differ. Denylist rejects prior project3139649/exciting-snake-863 and retired/shared/prod/selfHosted selectors. No existing target reused in review. |
| Compiler/import/config/staging/official publication | Both types pass; copied generated modules stay unchanged. Source closure/config and official synthetic/EMPTY deployment/codegen/apiSpec equality remain mandatory before RPC. Fresh publication adversaries exercise full287 validators/equalities,256000 raw capture, chunk/hash tamper rejection and route identity; offline shaped metadata is not actual publication. |
| Conservatively bounded dispatch and nested liability |37=28 four-public-Action authorization queries+8 peer record+1 parent nested. Denied authorization prevents hydration/vector/rechecks; internal invisibility never reaches handler. Fixed tickets clamp each kind before dispatch, no caller-raised max. C8 omitted nested count is explicitly disclosed, its history untouched. |
| Row/RPC/global evidence bounds | Regression2875 native upper/783 worst creates; historical736 is observed history, not a cap. Extension2892 upper/465 derived creates.2963 client+37 nested=3000,12 client tickets reserved cleanup.320 live/6000 journal/8MiB/20m shared qualifier/24m driver/6 process groups/2 concurrent/2 CLI children120s are retained. |
| Failure/final cleanup and no resets | Driver clears case ceiling and enables cleanupMode in finally; shared ticket/deadline files never reset. Independently authored tests prove2951 normal stop,12 cleanup tickets,2963 final stop, caller-max rejection,28/1/8 nested-kind ceilings and zero append on exhausted journal. Expired shared deadline denies cleanup too: cleanup is then incomplete and owned recovery/physical retirement remain required, never implied success. |
| Temporal evidence | First-half scheduling and four bracketed healthy-window proofs reject absent/expired/noncurrent/mismatched/ambiguous accounts; late capture checks actual stored windows and shared deadline, not modified accounts/clock. Offline clocks do not prove native server timing. |
| Parent bounded execution | FAIL: exact consumed C7 source permits postdeadline signatures and outputs. Cannot advance current C2 preparation. |
| Original failures and EMPTY preservation | Immutable C1/C7 and producer extension-handler setup failures preserved; original43 EMPTY forged/synthetic/unknown root errors remain executable. Review has no oldQA writes; its own relocation failure is retained. |

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment |2/5| Required consumed parent boundary fails finite deadline before privileged actions. |
| Code Quality |2/5| Hash-bound parent main lacks preeffect deadline checks; profile guard itself passed independent limit hostilities. |
| Test Quality |4/5|22+43 meaningful compiled-handler families;20+5+9 fresh adversaries; explicit native/offline separation. Parent defect demonstrates why independent review remains required. |
| Pattern Adherence |4/5| Exact product/schema copies, internal validators, scoped ownership, no provider/public proxy or resets. |
| Completeness |2/5| Mandatory parent preparation prerequisite is rejected; official native outcomes remain pending. |

Average2.8/5. No wholeTask04/full03-final/goal PASS is claimed.

## Review-owned execution and provenance

Clone changes are disclosed in clone-adaptations.json and publication-relocation-fix.json: root/repo/scratch and offline work paths relocate into the unique review tree; clone runtime-freeze hashes were locally rebound where necessary. Fixtures/product/assertions are unchanged. Original immutable runtime freezes and complete manifests are copied under original-inputs, separate from modified review clones. The budget adversaries evaluate the unmodified original guard in an owned synthetic path/VM with real local filesystem tickets and dummy time/artifacts; they dispatch no service or native RPC. All discovered case counts and budgets are in case-discovery-and-counts.json. Original source comparisons and complete pre/post evidence are independently recorded.
'''
(Q/'report.md').write_text(report)
# Recursive public review deliverable manifest, excludes itself only.
files=[]
for p in sorted(Q.rglob('*')):
 if p.is_file() and p.name!='full-manifest.json':files.append({'path':str(p.relative_to(Q)),'bytes':p.stat().st_size,'sha256':h(p)})
write(Q/'full-manifest.json',{'scope':'INDEPENDENT_C2_PREPARATION_REVIEW_ONLY','files':files})
print(json.dumps({'verdict':summary['verdict'],'report':str(Q/'report.md'),'reportSHA256':h(Q/'report.md'),'manifest':str(Q/'full-manifest.json'),'manifestSHA256':h(Q/'full-manifest.json'),'rows':len(files)},indent=2))
