from pathlib import Path
import json,hashlib,datetime,subprocess,sys,shutil
root=Path('/workspace/Project-Cortex');base=root/'_goals/convex-backend-runtime-2026-10-02/qa';q=base/'task04-default-native-driver-design-c4'
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def write(name,x):
 p=q/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(x if isinstance(x,str) else json.dumps(x,indent=2)+'\n')
def fp(p):
 b=p.read_bytes();return {'path':str(p.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
old=json.loads((q/'source-matrix.json').read_text());paths=list(dict.fromkeys(x['path'] for x in old['sources']))
paths += [str((base/'task04-default-native-driver-design-c3-review'/n).relative_to(root)) for n in ['report.md','qa-manifest.json']]
reject=base/'task04-default-native-driver-design-c3-coordinator-rejection.json'
if reject.exists():paths.append(str(reject.relative_to(root)));shutil.copyfile(reject,q/'lineage'/reject.name)
paths=list(dict.fromkeys(paths));pre=[fp(root/p) for p in paths];write('source-matrix.json',{'utc':now(),'classification':'CURRENT_READ_ONLY_DEDUPLICATED','sources':pre})
for path,pin in [('convex-dev/runtimeModelPolicy.ts','c8279d4496eb9b6eb5763732dbb7e54cefe27e028f285fe3e31a639af1535710'),('convex-dev/runtimeGateway.ts','e796e43aafe70c37d8af7330a969e5b643eb58e86be7621cc7c08991ff1224be')]:assert fp(root/path)['sha256']==pin
commands=[];results=[]
for name in ['design-model.py','replay-cleanup-model.py','hash-recovery-model.py']:
 args=[sys.executable,str(q/'checks'/name)];start=now();r=subprocess.run(args,cwd=root,capture_output=True,text=True);end=now();prefix=name[:-3]
 write('raw/'+prefix+'.stdout',r.stdout);write('raw/'+prefix+'.stderr',r.stderr);commands.append({'argv':args,'cwd':str(root),'startedAtUTC':start,'endedAtUTC':end,'exit':r.returncode,'stdout':'raw/'+prefix+'.stdout','stderr':'raw/'+prefix+'.stderr','scope':'PURE_ILLUSTRATIVE_DESIGN_ONLY'})
 write('command-receipts.json',{'commands':commands})
 if r.returncode:
  shutil.copyfile(q/'checks'/name,q/'raw'/('failed-preimage-'+name));raise RuntimeError('design check failed; raw UTC/preimage preserved')
 results.append(json.loads(r.stdout))
ids=json.loads((q/'initial14-identities.json').read_text());assert (q/'initial14-identities.json').read_bytes()==(base/'task04-default-native-driver-design-c3'/'initial14-identities.json').read_bytes();assert len(ids['cases'])==14 and len({x['normalizedNativeRequestHash'] for x in ids['cases']})==13;assert sum(x['candidateReservationKMicroUSD'] for x in ids['cases'])==314310
post=[fp(root/p) for p in paths];assert pre==post
lineageRows=0
for name in ['task04-default-native-driver-design-c3','task04-default-native-driver-design-c3-review']:
 original=base/name;copy=q/'lineage'/name
 assert {p.relative_to(original) for p in original.rglob('*') if p.is_file()}=={p.relative_to(copy) for p in copy.rglob('*') if p.is_file()}
 for p in original.rglob('*'):
  if p.is_file():assert p.read_bytes()==(copy/p.relative_to(original)).read_bytes();lineageRows+=1
write('verification.json',{'utc':now(),'status':'PASS_ILLUSTRATIVE_MODELS_AND_PACKET_INTEGRITY_ONLY','groups':[{'classification':x['classification'],'groups':x['groups'],'result':x['result']} for x in results],'sourcesUnique':len(paths),'sourceBytesUnchanged':True,'lineageFilesByteExact':lineageRows,'initial14Exact':True,'nativeHashes13':True,'provisionalK314310':True,'actualProofRegistry':'EMPTY','actualNativePaidManaged':'NOT_RUN','freshReview':'PENDING'})
write('failures-history.json',{'newFailures':[],'status':'No new failed C4 command observed. Complete C1/C2/C3 historical failure/raw/preimage lineage copied unchanged; original missing UTC never fabricated.'})
write('report.md','''# Task Completion Report

## Status: COMPLETE — C4 DESIGN HASH/RECOVERY REPAIR ONLY; FRESH REVIEW REQUIRED

Fixed exact versioned canonical lifecycle intent/receipt/state/evidence/liability/trigger preimages, domains, ordering, keys/limits and every-load stored-row redundancy checks. Purge retains full nontext triggerCanonical with complete StageIdentity; postpurge recovery recomputes account/attempt trigger relation against retained T, denying corruption0writes/no summary. Mutable current liability/refinement facts are independently validated and may change after purge without freezing known/reserved/active against a historical snapshot. Exact stage mutation replay after purge remains denied closed. Alreadytombstoned/revoked no-write receiptHash derives exact current snapshot preimages. Accepted C3 historical replay/ROOT cleanup repairs remain intact.

Changes: six corrected normative contracts including hash-recovery.md; proposal/check-plan; independent hash/recovery examples plus unchanged copied25+19 illustrative groups; exact initial14 copy; source/reference integrity; raw UTC/argv/cwd/exit/stdout/stderr; full byte-exact287-row C3 subject+361-row fresh C3 review snapshots including all nested C1/C2 failures/rejections/preimages; coordinator rejection where present. Writes only own C4 QA/scratch. No product/config/tests/oldQA/.agents/private/env/Git/services/network/native/paid/subagents.

Verification: all three pure illustrative contract example groups PASS (exact counts in verification.json); stored canonical/hash/redundancy/binding/corrupt-trigger/postpurge/late-accounting/revoke/purge/no-write examples are meaningful finite hash predicates, not actual Convex/account/native/provider validation. Exact fixed14/13nativehashes/K314310 copy preserved, source pins c827/e796 and all selected unique references unchanged, full lineage byte identity and complete recursive own closure verified. No build/lint/officialdriver/managed/native/source-specific native/serving/USD/decoder/UI/all17 acceptance. Actual proof registry EMPTY; model/serving/revision/decoder/lifetime/wholeUSD/categories/managed evidence UNKNOWN/NOT_RUN. Fresh independent DESIGN judgment required before implementation/native gates.

Scope retained: fixed14 ORDER/identityordinals/U/M/conditionaloutput/K; one active/permit/account/no15th/newrequest/model/options/tools/reset/regrant/windowrenewal/fallback/replay;1000/15000/1000/1000 absolute officialentry/lifecycle/token order; original liability/tombstones and ROOT ownership; experiment/bootstrap vs later accepted fixture-only actualroot/Gateway/productionEMPTY; all13operations/Task04/08/09/14/all17/fullcore/UI original gates. Persistent fresh/nocap authority and numericalcyclewaiverONLY unchanged; initial14/overall28/$10 engineeringguards not permissioncaps or clipped liabilities. Root actual source/native/security/codegen/OCC/currentgrant/serial/unknown/missingdriver/retirement/paid gates remain independent.

New failure list empty; old failed verdicts/exploration/reviewer failures including missing historical timestamps remain preserved. Own rootmanifest includes nested manifests and all failure artifacts and excludes ONLY itself. Final report/manifest hashes communicated after closure.
''')
shutil.copyfile(root/'work/resume/task04-default-native-driver-design-c4/finalize-packet.py',q/'checks/finalize-packet.py')
rows=[]
for p in sorted(q.rglob('*')):
 if p.is_file() and p!=q/'qa-manifest.json':
  x=fp(p);x['path']=str(p.relative_to(q));rows.append(x)
write('qa-manifest.json',{'utc':now(),'classification':'DESIGN_ONLY_NOT_ACCEPTED','excludes':['qa-manifest.json'],'files':rows})
actual={str(p.relative_to(q)) for p in q.rglob('*') if p.is_file() and p!=q/'qa-manifest.json'};assert actual=={x['path'] for x in rows}
for x in rows:
 b=(q/x['path']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256']
print(json.dumps({'status':'COMPLETE_DESIGN_ONLY','groups':[x['groups'] for x in results],'rows':len(rows),'reportSHA256':fp(q/'report.md')['sha256'],'manifestSHA256':fp(q/'qa-manifest.json')['sha256']}))
