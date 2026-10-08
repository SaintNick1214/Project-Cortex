import pathlib,json,hashlib,datetime,subprocess,os,re
R=pathlib.Path('/workspace/Project-Cortex')
G='_goals/convex-backend-runtime-2026-10-02/'
C=R/G/'qa/task05-current-seam-refresh-c1'
Q=R/G/'qa/task05-current-seam-refresh-c1-fresh-review'
W=R/'work/resume/task05-current-seam-refresh-c1-fresh-review'
CW=R/'work/resume/task05-current-seam-refresh-c1'
utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda b:hashlib.sha256(b).hexdigest()
def fp(p):
 b=p.read_bytes();return {'path':str(p.relative_to(R)),'bytes':len(b),'sha256':sha(b)}
def write(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
rows=json.loads((C/'preimages.json').read_text())['artifacts']+json.loads((C/'supplement-preimages.json').read_text())['artifacts']
inputs={R/x['path'] for x in rows}
inputs.update(R/p for p in ['.agents/roles/pessimistic-judge.md','.agents/skills/judge-task/SKILL.md',G+'qa/task05-current-seam-refresh-c1/report.md',G+'qa/task05-current-seam-refresh-c1/evidence-manifest.json','work/resume/task05-current-seam-refresh-c1/work-manifest.json',G+'qa/task05-current-seam-refresh-c1-root-inspection.json'])
inputs.update(CW.glob('*'))
inputs.add(W/'review.py')
before=[]
for p in sorted(inputs):
 if not p.is_file():continue
 b=p.read_bytes();dest=Q/'preimages'/str(p.relative_to(R)).replace('/','--');dest.write_bytes(b)
 before.append({**fp(p),'archive':str(dest.relative_to(R)),'capturedUTC':utc()})
write(Q/'preimages.json',{'utc':utc(),'artifacts':before,'classification':'genuine reviewer current bytes BEFORE every controlled invocation'})
verification=[]
folders=['task05-runtime-contract-lock-preparation','task05-runtime-contract-lock-review','task05-runtime-contract-lock-preparation-c2','task05-runtime-contract-lock-preparation-c2-review','task05-runtime-contract-lock-preparation-c3','task05-runtime-contract-lock-preparation-c3-review','task05-current-seam-refresh-c1']
for folder in folders:
 m=R/G/'qa'/folder/'evidence-manifest.json';d=json.loads(m.read_text());bad=[]
 for row in d['artifacts']:
  p=R/row['path'];b=p.read_bytes()
  if len(b)!=row['bytes'] or sha(b)!=row['sha256']:bad.append(row['path'])
 entry={'manifest':fp(m),'verifiedRows':len(d['artifacts']),'mismatches':bad}
 if folder=='task05-current-seam-refresh-c1':
  actual={str(p.relative_to(R)) for root in [C,CW] for p in root.rglob('*') if p.is_file() and p!=m}
  listed={x['path'] for x in d['artifacts']};entry.update({'closureMissing':sorted(actual-listed),'closureExtra':sorted(listed-actual)})
 verification.append(entry)
 assert not bad
wm=CW/'work-manifest.json';wd=json.loads(wm.read_text());actual={str(p.relative_to(R)) for p in CW.rglob('*') if p.is_file() and p!=wm};listed={x['path'] for x in wd['artifacts']}
assert actual==listed
write(Q/'manifest-verification.json',{'utc':utc(),'manifests':verification,'historicalRows':sum(x['verifiedRows'] for x in verification[:-1]),'workManifest':fp(wm),'workRows':len(listed),'workExactClosure':True})
assert fp(C/'report.md')['sha256']=='8c580c5b53347e625cd3138a3b1cb76ddbf01506a27539d4563e5af368e87503'
assert fp(C/'evidence-manifest.json')['sha256']=='2a5f22540b872cce1625b284517f1dec0191c043b07506995dfc347e17413cc6'
assert fp(wm)['sha256']=='e017783c9eefc6b039790e30e28a51b1cd1e6dcd11263f365a551b62d69a4182'
transform=[]
for name in ['mapping-probe','hostile-probe','repaired-boundaries','fresh-probes','seam-controls']:
 original=CW/(name+'.mjs');a=original.read_text();b=a.replace(str(C.relative_to(R))+'/',str(Q.relative_to(R))+'/');dest=W/(name+'.mjs');dest.write_text(b)
 assert b.replace(str(Q.relative_to(R))+'/',str(C.relative_to(R))+'/')==a
 transform.append({'original':fp(original),'reviewCopy':fp(dest),'reversePathSubstitutionExact':True,'assertions':'UNCHANGED; only candidate archive prefix replaced with reviewer archive prefix'})
write(Q/'assertion-preservation.json',transform)
def run(name,argv,classification):
 tracked=[R/x['path'] for x in before]+list(W.glob('*.mjs'))
 write(Q/(name+'.pre-execution.json'),{'utc':utc(),'argv':argv,'cwd':str(R),'fingerprints':[fp(p) for p in sorted(set(tracked))]})
 start=utc();result=subprocess.run(argv,cwd=R,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={**os.environ,'PATH':str(R/'work/resume/toolchain-bin')+':'+os.environ['PATH']})
 (Q/(name+'.stdout')).write_bytes(result.stdout);(Q/(name+'.stderr')).write_bytes(result.stderr)
 receipt={'argv':argv,'cwd':str(R),'startUTC':start,'endUTC':utc(),'exitCode':result.returncode if result.returncode>=0 else None,'signal':-result.returncode if result.returncode<0 else None,'groups':len(re.findall(rb'^PASS ',result.stdout,re.M)),'skips':[],'classification':classification}
 write(Q/(name+'.receipt.json'),receipt);assert result.returncode==0,(name,result.stderr.decode());return receipt
receipts=[run('node',['node','--version'],'TOOLCHAIN_ONLY'),run('npm',['npm','--version'],'TOOLCHAIN_ONLY')]
for name in ['mapping-probe','hostile-probe','repaired-boundaries','fresh-probes','seam-controls']:
 receipts.append(run(name,['node',str((W/(name+'.mjs')).relative_to(R))],'STATIC_SOURCE_ONLY_NOT_NATIVE' if name=='seam-controls' else 'OFFLINE_REFERENCE_AND_EXTRACTED_SOURCE_FAKE_CONTEXT_NOT_NATIVE'))
post=[{**fp(R/x['path']),'beforeSHA256':x['sha256'],'equal':fp(R/x['path'])['sha256']==x['sha256']} for x in before]
write(Q/'postimages.json',{'utc':utc(),'artifacts':post,'drift':[x['path'] for x in post if not x['equal']]})
write(Q/'execution-summary.json',{'utc':utc(),'receipts':len(receipts),'behavioralGroups':sum(x['groups'] for x in receipts if x['classification'].startswith('OFFLINE')),'staticGroups':sum(x['groups'] for x in receipts if x['classification'].startswith('STATIC')),'nonzeroExits':sum(x['exitCode']!=0 for x in receipts),'skips':0,'historicalManifestRows':sum(x['verifiedRows'] for x in verification[:-1]),'candidateRows':verification[-1]['verifiedRows'],'capturedFiles':len(before),'sourceDrift':sum(not x['equal'] for x in post),'native':'NOT_RUN','projectTypecheckLintBuildJest':'NOT_RUN','transitiveInstalledGraph':'NOT_CAPTURED'})
print((Q/'execution-summary.json').read_text())
