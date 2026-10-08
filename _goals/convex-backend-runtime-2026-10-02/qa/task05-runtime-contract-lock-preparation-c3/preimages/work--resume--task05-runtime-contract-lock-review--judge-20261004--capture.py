import pathlib, hashlib, json, subprocess, datetime, os
root=pathlib.Path('/workspace/Project-Cortex')
out=root/'_goals/convex-backend-runtime-2026-10-02/qa/task05-runtime-contract-lock-review'
scratch=root/'work/resume/task05-runtime-contract-lock-review/judge-20261004'
prep=root/'_goals/convex-backend-runtime-2026-10-02/qa/task05-runtime-contract-lock-preparation'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def dump(p,o): p.write_text(json.dumps(o,indent=2)+'\n')
manifest=json.loads((prep/'evidence-manifest.json').read_text())
verification=[]
for row in manifest['artifacts']:
 p=root/row['path'];verification.append(dict(row,observedSHA256=sha(p),observedBytes=p.stat().st_size,match=sha(p)==row['sha256'] and p.stat().st_size==row['bytes']))
dump(out/'preparation-manifest-verification.json',{'utc':now(),'reportSHA256':sha(prep/'report.md'),'manifestSHA256':sha(prep/'evidence-manifest.json'),'rows':verification,'mismatches':sum(not x['match'] for x in verification)})
paths=[root/x['path'] for x in json.loads((prep/'preimages.json').read_text())['sources']]
paths += [root/'.agents/roles/pessimistic-judge.md',root/'.agents/skills/judge-task/SKILL.md',root/'.agents/skills/feature-orchestrator/SKILL.md',root/'_goals/convex-backend-runtime-2026-10-02/qa/task01/contracts.md',root/'node_modules/@convex-dev/agent/src/vercel/client/search.ts',root/'node_modules/@convex-dev/agent/src/vercel/client/start.ts',root/'node_modules/@convex-dev/agent/src/client/messages.ts',root/'node_modules/@convex-dev/agent/dist/client/messages.js',root/'node_modules/@convex-dev/agent/dist/vercel/client/search.js',prep/'report.md',prep/'evidence-manifest.json',scratch/'capture.py',scratch/'probe.mjs']
paths=list(dict.fromkeys(paths)); images=[]
for p in paths:
 rel=str(p.relative_to(root)); target=out/'preimages'/rel.replace('/','--'); target.write_bytes(p.read_bytes()); images.append({'path':rel,'bytes':p.stat().st_size,'sha256':sha(p),'preimage':str(target.relative_to(root))})
dump(out/'preimages.json',{'utc':now(),'sources':images})
environ=os.environ.copy();environ['PATH']=str(root/'work/resume/toolchain-bin')+':'+environ['PATH']
for name,argv in [('node',['node','--version']),('npm',['npm','--version']),('hostile-probe',['node',str(scratch/'probe.mjs')])]:
 receipt={'argv':argv,'cwd':str(root),'startUTC':now(),'classification':'offline only','sourcePreimages':'preimages.json','envChange':'PATH prepend work/resume/toolchain-bin; no secret/environment values recorded'}
 dump(out/(name+'.pre-execution.json'),receipt)
 result=subprocess.run(argv,cwd=root,env=environ,capture_output=True)
 (out/(name+'.stdout')).write_bytes(result.stdout);(out/(name+'.stderr')).write_bytes(result.stderr)
 receipt.update(endUTC=now(),exit=result.returncode,signal=-result.returncode if result.returncode<0 else None,stdout=name+'.stdout',stderr=name+'.stderr');dump(out/(name+'.receipt.json'),receipt)
 print(name,result.returncode,result.stdout.decode()[-1800:]);print(result.stderr.decode()[-1200:])
dump(out/'postimages.json',{'utc':now(),'sources':[dict(x,observedSHA256=sha(root/x['path']),unchanged=sha(root/x['path'])==x['sha256']) for x in images]})
print('verified',len(verification),'artifact rows; preserved',len(images),'source/config/probe preimages')
