from pathlib import Path
import shutil,json,hashlib,datetime,subprocess,sys
root=Path('/workspace/Project-Cortex');base=root/'_goals/convex-backend-runtime-2026-10-02/qa';q=base/'task04-default-native-driver-design-c2'
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def fp(p):
 b=p.read_bytes();return {'path':str(p.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def write(p,x):p.write_text(x if isinstance(x,str) else json.dumps(x,indent=2)+'\n')
# Preserve full exact original packet and fresh review, including nested manifests/failures.
for name in ['task04-default-native-driver-design-c1','task04-default-native-driver-design-c1-review']:
 dst=q/'lineage'/name
 if not dst.exists():shutil.copytree(base/name,dst)
for name in ['task04-default-native-driver-design-c1-coordinator-rejection.json','task04-model-drift-charge-only-c1-coordinator-acceptance.json']:
 shutil.copyfile(base/name,q/'lineage'/name)
shutil.copyfile(base/'task04-default-native-driver-design-c1'/'initial14-identities.json',q/'initial14-identities.json')
old=json.loads((base/'task04-default-native-driver-design-c1'/'source-matrix.json').read_text())
paths=list(dict.fromkeys(r['path'] for r in old['sources']))
paths += ['node_modules/@ai-sdk/openai-compatible/src/embedding/openai-compatible-embedding-model.ts','node_modules/@ai-sdk/openai-compatible/src/embedding/openai-compatible-embedding-model-options.ts','node_modules/@ai-sdk/openai-compatible/src/chat/map-openai-compatible-finish-reason.ts','node_modules/@ai-sdk/provider/package.json','node_modules/@ai-sdk/openai-compatible/package.json','node_modules/@ai-sdk/provider/src/language-model/v4/language-model-v4-generate-result.ts','node_modules/@ai-sdk/provider/src/language-model/v4/language-model-v4-stream-result.ts','node_modules/@ai-sdk/provider/src/language-model/v4/language-model-v4-stream-part.ts','node_modules/@ai-sdk/provider/src/language-model/v4/language-model-v4-finish-reason.ts','node_modules/@ai-sdk/provider/src/language-model/v4/language-model-v4-usage.ts','node_modules/@ai-sdk/provider/src/embedding-model/v4/embedding-model-v4-call-options.ts','node_modules/@ai-sdk/provider/src/embedding-model/v4/embedding-model-v4-result.ts','node_modules/@ai-sdk/provider/src/embedding-model/v4/embedding-model-v4.ts']
paths += [str((base/p).relative_to(root)) for p in ['task04-default-native-driver-design-c1-review/report.md','task04-default-native-driver-design-c1-review/qa-manifest.json','task04-default-native-driver-design-c1-coordinator-rejection.json','task04-model-drift-charge-only-c1-coordinator-acceptance.json']]
paths=list(dict.fromkeys(paths));pre=[fp(root/p) for p in paths];write(q/'source-matrix.json',{'utc':now(),'classification':'CURRENT_DEDUPLICATED_READ_ONLY_REFERENCES','sources':pre})
start=now();args=[sys.executable,str(q/'checks/design-model.py')];r=subprocess.run(args,cwd=root,capture_output=True,text=True);end=now()
write(q/'raw/design-model.stdout',r.stdout);write(q/'raw/design-model.stderr',r.stderr)
write(q/'command-receipts.json',{'commands':[{'argv':args,'cwd':str(root),'startedAtUTC':start,'endedAtUTC':end,'exit':r.returncode,'stdout':'raw/design-model.stdout','stderr':'raw/design-model.stderr','scope':'pure design-model only'}]})
if r.returncode:
 (q/'failures').mkdir(exist_ok=True);shutil.copyfile(q/'checks/design-model.py',q/'failures/design-model-failed.py');raise RuntimeError('Design model failed; preserve preimage/raw first')
ids=json.loads((q/'initial14-identities.json').read_text())['cases'];assert len(ids)==14 and len({x['normalizedNativeRequestHash'] for x in ids})==13 and sum(x['candidateReservationKMicroUSD'] for x in ids)==314310
post=[fp(root/p) for p in paths];assert pre==post;assert len(paths)==len(set(paths));write(q/'verification.json',{'utc':now(),'result':'PASS_DESIGN_INTEGRITY_ONLY','pureDesignGroups':json.loads(r.stdout)['groups'],'sourceCount':len(paths),'sourcesUnchanged':True,'sourceDeduplicated':True,'initial14ExactCopy':True,'actualProofRegistry':'EMPTY','actualServingBillingDecoderManaged':'NOT_RUN','nativeProductSourceAcceptance':'NOT_RUN','freshIndependentReview':'PENDING'})
write(q/'failures-history.json',{'newExploratoryFailures':[],'status':'No new failed command observed in C2 through finalizer; older C1 full failure preimages/raw copied unchanged under lineage; do not infer missing historical UTC.'})
write(q/'report.md','''# Task Completion Report

## Status: COMPLETE — DESIGN C2 REPAIR ONLY; FRESH REVIEW REQUIRED

Resolved C1's four finite-contract gaps in separate receipt/state, observer/proof, managed fixture and staging/control contracts. Typed exact keys/types/null/zero/limits, cross-field matrix/parser order and immutable two-dimension refinement/STOP publication are explicit. Closed source proof resolver is finite and ACTUAL_PROOFS EMPTY: honest unknown/STOP/fullK is executable without invented serving/currency/whole-charge proof. Managed source/grant/chunk/vector/index1536/write/search/hydrate/tombstone contracts and C09/C10 atomic once-only inaccessible staging/control triggers are fixed. Minor source matrix duplicates removed; embedding raw schema/provider v4 type pins included.

Changes: proposal.md; contracts/{receipt-state,observer-proofs,managed-fixture,staging-trigger}.md; check-plan.md; illustrative checks/design-model.py; exact unchanged initial14-identities.json; deduplicated source-matrix.json; raw/UTC command evidence and verification.json; complete lineage snapshots of original17-row subject and64-row fresh review, including failures/preimages/nested manifests and coordinator rejection/accepted offline product receipt. No original/product/config/test/oldQA file changed.

Requirements preserved: official v4 methods/action-local getServiceToken after reserve/checkpoint/current-enter; one account/active/permit/no15th/replay/renew/reset; absolute1000/15000/1000/1000 ownership; actualraw model truth/independent full conditional charge incldrift; supported unknown branches; private capture-before-attach; exact immutable initial14 identities/ORDER and conditional U/M/K/output hypotheses; fixture-only bootstrap then separate accepted actual-root/policy/Gateway test, production EMPTY root; root-only newtarget/security/source-load/codegen/native-control/review/retire before paid. Persistent fresh/no-cap authorization and numerical-caps-only waiver unchanged. Original Task04/08/09/14/fullcore/all17 acceptance remains incomplete.

Verification: pure illustrative design-model schema/adverse/arithmetic/branch checks PASS (group count in verification.json); all deduplicated current hashes unchanged, exact14/13unique/K314310 copy verified. These do not execute normative production parser/driver, actual observer/Gateway, managed repository, native/provider/services or paid work. Actual proof registry EMPTY; serving/modelrevision/decoder/complete aggregateUSD/categories/lifetime/managed source/write/search evidence UNKNOWN/NOT_RUN. No build/lint/application/native/source-specific native PASS or acceptance follows. Fresh independent design judgment required before implementation/native gates. Current accepted offline c827/e7964.4 source does not certify three changed-source native capsules (ACTIVE/NOT_RUN).

New failures if any are reported in failures-history.json with raw/preimage; historical missing original UTC is retained unchanged, never fabricated. Complete root manifest recursively includes nested lineage manifests and all failures, excludes only itself. Root final report/manifest hashes are communicated separately after closure.
''')
# Finalizer itself is a retained design tooling source, not a product implementation.
shutil.copyfile(root/'work/resume/task04-default-native-driver-design-c2/finalize-packet.py',q/'checks/finalize-packet.py')
rows=[]
for p in sorted(q.rglob('*')):
 if p.is_file() and p!=q/'qa-manifest.json':
  x=fp(p);x['path']=str(p.relative_to(q));rows.append(x)
write(q/'qa-manifest.json',{'utc':now(),'classification':'DESIGN_ONLY_NOT_ACCEPTED','excludes':['qa-manifest.json'],'files':rows})
for row in rows:
 f=q/row['path'];b=f.read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
assert {p.relative_to(q).as_posix() for p in q.rglob('*') if p.is_file() and p!=q/'qa-manifest.json'}=={x['path'] for x in rows}
print(json.dumps({'rows':len(rows),'reportSHA256':hashlib.sha256((q/'report.md').read_bytes()).hexdigest(),'manifestSHA256':hashlib.sha256((q/'qa-manifest.json').read_bytes()).hexdigest(),'status':'DESIGN_ONLY_COMPLETE'}))
