import pathlib,json,hashlib,datetime,subprocess,os,re
R=pathlib.Path('/workspace/Project-Cortex');G='_goals/convex-backend-runtime-2026-10-02/';Q=R/G/'qa/task05-current-seam-refresh-c1-fresh-review';W=R/'work/resume/task05-current-seam-refresh-c1-fresh-review';C=R/G/'qa/task05-current-seam-refresh-c1'
utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda b:hashlib.sha256(b).hexdigest()
def fp(p):
 b=p.read_bytes();return {'path':str(p.relative_to(R)),'bytes':len(b),'sha256':sha(b)}
def write(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
rows=json.loads((C/'preimages.json').read_text())['artifacts']+json.loads((C/'supplement-preimages.json').read_text())['artifacts'];assert len(rows)==84
for row in rows:
 assert (R/row['path']).read_bytes()==(R/row['archive']).read_bytes()
 assert fp(R/row['path'])['sha256']==row['sha256']
deltas=json.loads((C/'source-deltas.json').read_text())
for row in deltas:
 b=(R/row['currentArchive']).read_bytes();assert sha(b)==row['currentSHA256']
 if row['equal'] is not None:
  a=(R/row['oldArchive']).read_bytes();assert sha(a)==row['oldSHA256'];assert (a==b)==row['equal']
assert sum(x['equal'] is None for x in deltas)==17
assert sum(x['equal'] is False for x in deltas)==5
assert sum(x['equal'] is True for x in deltas)==32
P=R/G/'qa/task05-runtime-contract-lock-preparation-c3/preimages'
assert not (P/'convex-dev--runtimeGateway.ts').exists()
sourcepaths={x['path'] for x in rows if x['path'].startswith(('src/','convex-dev/','node_modules/','.agents/')) or x['path'] in ['AGENTS.md','package.json','package-lock.json','tsconfig.json','jest.config.mjs','convex.json'] or x['path'].startswith('tests/')}
assert len(sourcepaths)==65
write(Q/'candidate-recheck.json',{'utc':utc(),'genuineCandidateBeforeArchives':len(rows),'consumedSourceFiles':len(sourcepaths),'sourceCountDefinition':'58 product/installed/config/test files plus 7 AGENTS/.agents orchestration instruction/config files','comparisons':len(deltas),'unchanged':32,'changed':5,'historicalMissing':17,'oldStandaloneGateway':'NOT_CAPTURED; absence freshly verified','fullInstalledTransitiveGraph':'NOT_CAPTURED'})
inputs=[R/x['path'] for x in json.loads((Q/'preimages.json').read_text())['artifacts']]+[W/'negative-source-controls.mjs',W/'supplement-review.py']
argv=['node',str((W/'negative-source-controls.mjs').relative_to(R))]
write(Q/'negative-source-controls.pre-execution.json',{'utc':utc(),'argv':argv,'cwd':str(R),'fingerprints':[fp(p) for p in sorted(set(inputs))]})
start=utc();r=subprocess.run(argv,cwd=R,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={**os.environ,'PATH':str(R/'work/resume/toolchain-bin')+':'+os.environ['PATH']})
(Q/'negative-source-controls.stdout').write_bytes(r.stdout);(Q/'negative-source-controls.stderr').write_bytes(r.stderr)
write(Q/'negative-source-controls.receipt.json',{'argv':argv,'cwd':str(R),'startUTC':start,'endUTC':utc(),'exitCode':r.returncode,'signal':None,'groups':len(re.findall(rb'^PASS ',r.stdout,re.M)),'skips':[],'classification':'STATIC_NEGATIVE_GUARD_SENSITIVITY_ONLY_NO_NATIVE_PROOF'})
assert r.returncode==0,r.stderr.decode();assert len(re.findall(rb'^PASS ',r.stdout,re.M))==8
post=[{**fp(R/x['path']),'beforeSHA256':x['sha256'],'equal':fp(R/x['path'])['sha256']==x['sha256']} for x in json.loads((Q/'preimages.json').read_text())['artifacts']]
write(Q/'final-postimages.json',{'utc':utc(),'artifacts':post,'drift':[x['path'] for x in post if not x['equal']]})
print(json.dumps({'candidateBeforeBytesVerified':84,'sourceFiles':65,'historicalComparisonsAbsent':17,'staticNegativeGroups':8,'exitCode':r.returncode,'drift':sum(not x['equal'] for x in post)}))
