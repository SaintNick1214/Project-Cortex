from pathlib import Path
import json,hashlib,datetime,subprocess,sys,shutil
root=Path('/workspace/Project-Cortex');base=root/'_goals/convex-backend-runtime-2026-10-02/qa';q=base/'task04-default-native-driver-design-c3'
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def write(name,x):
 p=q/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(x if isinstance(x,str) else json.dumps(x,indent=2)+'\n')
def fp(p):
 b=p.read_bytes();return {'path':str(p.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
old=json.loads((q/'source-matrix.json').read_text());paths=list(dict.fromkeys(x['path'] for x in old['sources']))
paths += [str((base/'task04-default-native-driver-design-c2-review'/n).relative_to(root)) for n in ['report.md','qa-manifest.json']]
reject=base/'task04-default-native-driver-design-c2-coordinator-rejection.json'
if reject.exists():paths.append(str(reject.relative_to(root)));shutil.copyfile(reject,q/'lineage'/reject.name)
paths=list(dict.fromkeys(paths));pre=[fp(root/p) for p in paths];write('source-matrix.json',{'utc':now(),'classification':'CURRENT_READ_ONLY_DEDUPLICATED','sources':pre})
for path,pin in [('convex-dev/runtimeModelPolicy.ts','c8279d4496eb9b6eb5763732dbb7e54cefe27e028f285fe3e31a639af1535710'),('convex-dev/runtimeGateway.ts','e796e43aafe70c37d8af7330a969e5b643eb58e86be7621cc7c08991ff1224be')]:assert fp(root/path)['sha256']==pin
commands=[];results=[]
for name in ['design-model.py','replay-cleanup-model.py']:
 args=[sys.executable,str(q/'checks'/name)];start=now();r=subprocess.run(args,cwd=root,capture_output=True,text=True);end=now();prefix=name[:-3]
 write('raw/'+prefix+'.stdout',r.stdout);write('raw/'+prefix+'.stderr',r.stderr);commands.append({'argv':args,'cwd':str(root),'startedAtUTC':start,'endedAtUTC':end,'exit':r.returncode,'stdout':'raw/'+prefix+'.stdout','stderr':'raw/'+prefix+'.stderr','scope':'PURE_ILLUSTRATIVE_DESIGN_ONLY'})
 write('command-receipts.json',{'commands':commands})
 if r.returncode:
  shutil.copyfile(q/'checks'/name,q/'raw'/('failed-preimage-'+name));raise RuntimeError('design check failed; raw UTC/preimage preserved')
 results.append(json.loads(r.stdout))
ids=json.loads((q/'initial14-identities.json').read_text());assert (q/'initial14-identities.json').read_bytes()==(base/'task04-default-native-driver-design-c2'/'initial14-identities.json').read_bytes();assert len(ids['cases'])==14 and len({x['normalizedNativeRequestHash'] for x in ids['cases']})==13;assert sum(x['candidateReservationKMicroUSD'] for x in ids['cases'])==314310
post=[fp(root/p) for p in paths];assert pre==post
# Verify original lineage closures by exact bytes, including nested manifests.
lineageRows=0
for name in ['task04-default-native-driver-design-c2','task04-default-native-driver-design-c2-review']:
 original=base/name;copy=q/'lineage'/name
 assert {p.relative_to(original) for p in original.rglob('*') if p.is_file()}=={p.relative_to(copy) for p in copy.rglob('*') if p.is_file()}
 for p in original.rglob('*'):
  if p.is_file():assert p.read_bytes()==(copy/p.relative_to(original)).read_bytes();lineageRows+=1
write('verification.json',{'utc':now(),'status':'PASS_DESIGN_MODEL_AND_PACKET_INTEGRITY_ONLY','groups':[{'classification':x['classification'],'groups':x['groups'],'result':x['result']} for x in results],'sourcesUnique':len(paths),'sourceBytesUnchanged':True,'lineageFilesByteExact':lineageRows,'initial14Exact':True,'nativeHashes13':True,'provisionalK314310':True,'actualProofRegistry':'EMPTY','actualNativePaidManaged':'NOT_RUN','freshReview':'PENDING'})
write('failures-history.json',{'newFailures':[],'status':'No new failed C3 command observed. Complete C1/C2 historical failure/raw/preimage lineage copied unchanged; historical missing UTC never fabricated.'})
write('report.md','''# Task Completion Report

## Status: COMPLETE — C3 DESIGN REPAIR ONLY; FRESH INDEPENDENT REVIEW REQUIRED

Fixed both deterministic C2 conflicts in a new immutable packet. Complete StageIdentity stores sequence/rawPartDigest/dispatch/BindingV2/contentHash, persisted canonical/hash and redundant row fields; exact historical replay precedes live grant fences with no private response. Same-text changed-part collisions and new late insertion denials remain distinct. ROOT owned destructive/recovery APIs define exact intent/result schemas, ownership-before-replay, live-versus-lifecycle fences, current fresh-effect epochs, exact replay after own tombstone/revocation, hash-only inspect/evidence recovery and bounded evidence-before-purge. Unknown/known liabilities and tombstones never erased. Format version2 stays immutable; Convex OCC concurrency, no custom storage revision.

Changes: proposal/check-plan; corrected five normative contracts; copied illustrative C2 design model plus independently authored replay-cleanup adversaries; exact fixed14 identity copy; source pins/deduplicated matrix; raw argv/cwd/UTC/exit evidence; complete byte-exact101-row C2 subject and163-row C2 review lineage (including all nested C1 failures/preimages/review rejection) and coordinator rejection if present. No original/product/config/tests/.agents/oldQA edits.

Verification: copied25-group design subset and new19-group independent illustrative contract model PASS; exact initial14/13unique hashes/K314310 preserved; all unique source hashes unchanged including frozen c827/e796; full lineage byte identity and complete own recursive closure checked. These are symbolic in-memory models, not Convex stage/repository transactions or driver/native/serving/managed acceptance. Fresh design review pending; builds/lint/application/services/native/paid NOT_RUN. No new exploration failure observed; original UTC omissions preserved.

Persistent fresh/no-cap authorization/numeric-caps-only waiver unchanged. Original fixed14 ORDER/U/M/K/output assumptions/EMPTY actualproofs/no new request/reset/regrant/production claim retained. Root only provision/sign/stage/deploy/paid/cleanup; source-specific native/security/codegen/OCC/currentgrant/source/serial/unknown/missingdriver/retirement gates remain independent. All original Task04/08/09/14/all13operations/all17/fullcore scope remains required and incomplete. KnownwholeUSD/actual serving/modelrevision/decoder/nativefinish/managed evidence remains UNKNOWN/NOT_RUN. Standalone experiment bootstrap and later accepted fixture-only actual-root/Gateway qualification remain separate, production EMPTY root unchanged.

Own qa-manifest recursively includes every nested manifest/failure and excludes ONLY itself. Final report/manifest SHA256 communicated after closure. No permission question or gate waiver introduced.
''')
shutil.copyfile(root/'work/resume/task04-default-native-driver-design-c3/finalize-packet.py',q/'checks/finalize-packet.py')
rows=[]
for p in sorted(q.rglob('*')):
 if p.is_file() and p!=q/'qa-manifest.json':
  x=fp(p);x['path']=str(p.relative_to(q));rows.append(x)
write('qa-manifest.json',{'utc':now(),'classification':'DESIGN_ONLY_NOT_ACCEPTED','excludes':['qa-manifest.json'],'files':rows})
actual={str(p.relative_to(q)) for p in q.rglob('*') if p.is_file() and p!=q/'qa-manifest.json'};assert actual=={x['path'] for x in rows}
for x in rows:
 b=(q/x['path']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256']
print(json.dumps({'status':'COMPLETE_DESIGN_ONLY','rows':len(rows),'reportSHA256':fp(q/'report.md')['sha256'],'manifestSHA256':fp(q/'qa-manifest.json')['sha256']}))
