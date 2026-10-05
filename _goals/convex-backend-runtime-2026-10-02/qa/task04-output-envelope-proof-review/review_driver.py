from pathlib import Path
import hashlib,json,subprocess,datetime,sys,shutil,os
root=Path('/workspace/Project-Cortex'); out=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-output-envelope-proof-review'; work=root/'work/resume/task04-output-envelope-proof-review'; goal='_goals/convex-backend-runtime-2026-10-02'; prep=root/goal/'qa/task04-output-envelope-proof-preparation'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(name,v):
 with (out/name).open('x') as f:json.dump(v,f,indent=2);f.write('\n')
paths=set()
for directory in ['src','convex-dev','tests','.agents',goal+'/qa/task04-output-envelope-proof-preparation',goal+'/qa/task04-output-vocabulary-acquisition',goal+'/qa/task04-input-result-bound-research',goal+'/qa/task04-structured-gateway-preparation']:
 paths.update(p for p in (root/directory).rglob('*') if p.is_file())
paths.update(root/p for p in ['AGENTS.md','package.json','package-lock.json',goal+'/implementation-prompt.md',goal+'/goal.md',goal+'/tasks/04-model-policy.md','_research/convex-ai-gateway-2026-10-02/decision-gates.md','_research/convex-ai-gateway-2026-10-02/architecture.md'])
pre={str(p.relative_to(root)):sha(p) for p in sorted(paths)};write('pre-fingerprints.json',pre)
write('discovery.json',{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'cwd':str(root),'preparationFiles':[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(prep.iterdir()) if p.is_file()],'sourceEvidenceMatches':sha(prep/'source-evidence.json')=='a1f80341e00fcc550028578b361de579716abea96346642fdfe33329548e7124','reportMatches':sha(prep/'report.md')=='30fe13b8c5f63faedc13923cec02662bb6cfb5bad2309bea8dce1b1ffc5dc343','readOnlyOriginals':True})
commands=[]
def run(label,argv,cwd=root):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=cwd,capture_output=True,timeout=150)
 for ext,data in [('stdout',p.stdout),('stderr',p.stderr)]:
  with (out/(label+'.'+ext)).open('xb') as f:f.write(data)
 receipt={'label':label,'argv':argv,'cwd':str(cwd),'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':p.returncode,'stdout':label+'.stdout','stderr':label+'.stderr','stdoutSHA256':hashlib.sha256(p.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(p.stderr).hexdigest()};commands.append(receipt)
 write(label+'.receipt.json',receipt)
 if p.returncode:raise RuntimeError(label+' failed; raw failure preserved')
mirror=work/'mirror';mp=mirror/goal/'qa/task04-output-envelope-proof-preparation';mp.mkdir(parents=True)
for p in prep.iterdir():
 if p.is_file():shutil.copyfile(p,mp/p.name)
(mirror/'src').symlink_to(root/'src',target_is_directory=True)
(mp.parent/'task04-output-vocabulary-acquisition').symlink_to(root/goal/'qa/task04-output-vocabulary-acquisition',target_is_directory=True)
run('python-runtime',['python','--version']);run('node-runtime',['node','--version'])
run('reproduce-fragment',['python',str(mp/'fragment-proof.py')]);run('reproduce-envelope',['node',str(mp/'envelope-proof.mjs')])
comparisons={p.name:{'originalSHA256':sha(p),'reproducedSHA256':sha(mp/p.name),'equal':p.read_bytes()==(mp/p.name).read_bytes()} for p in prep.iterdir() if p.name in ['fragment-proof-result.json','envelope-proof-result.json','maximum-escaped-witness-0.bin','default-vector-max-witness.json']}
write('reproduction-comparison.json',comparisons);assert all(v['equal'] for v in comparisons.values())
run('independent-adversarial',['node',str(work/'independent-check.mjs')])
post={str(p.relative_to(root)):sha(p) for p in sorted(paths)};write('post-fingerprints.json',post)
write('preservation.json',{'filesCovered':len(pre),'allFingerprintsUnchanged':pre==post,'changed':[k for k in pre if pre[k]!=post[k]],'scope':'all src/convex-dev/tests/orchestration, all four prerequisite packets, goal/task/authoritative context and manifests; no Git invocation'})
assert pre==post
write('commands.json',commands)
write('skip-receipts.json',{'network':'NOT_RUN: offline scope','modelsServicesTargetsCredentials':'NOT_RUN: explicitly excluded','applicationTests':'NOT_RUN: no product changes; formal proof gate only','servingTokenizerOutputCapDecoderNativeCorrespondence':'NOT_RUN: required later qualification','inputFramingCostCurrencyReadiness':'NOT_RUN: outside conditional output proof','productionRoot':'EMPTY: no installation performed','originalTask04':'INCOMPLETE','fullGoal':'INCOMPLETE'})
print(json.dumps({'allReproductionsMatch':True,'protectedFilesUnchanged':len(pre),'independentChecksPassed':True}))
