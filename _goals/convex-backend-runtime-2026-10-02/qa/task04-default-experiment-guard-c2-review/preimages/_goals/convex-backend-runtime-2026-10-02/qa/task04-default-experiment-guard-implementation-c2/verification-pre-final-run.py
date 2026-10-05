from pathlib import Path
import subprocess,datetime,os,json,hashlib,shutil
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-default-experiment-guard-implementation-c2';w=r/'work/resume/task04-default-experiment-guard-implementation-c2';env={**os.environ,'PATH':str(r/'work/resume/toolchain-bin')+':'+os.environ['PATH']}
def fingerprint():
 paths=[p for root in [q/'fixture',q/'scripts'] for p in root.rglob('*') if p.is_file()]+[q/'eslint.config.mjs',q/'repair-verifier.py']
 return [{'path':str(p.relative_to(q)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(paths)]
pre=fingerprint();(q/'repair-source-config-pre.json').write_text(json.dumps(pre,indent=2)+'\n');receipts=[]
for name,argv in [('final-quality',[shutil.which('node',path=env['PATH']),str(q/'scripts/verify.mjs')]),('final-refinements',['python3',str(w/'run.py')])]:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();x=subprocess.run(argv,cwd=r,env=env,capture_output=True);end=datetime.datetime.now(datetime.timezone.utc).isoformat()
 for s in ['stdout','stderr']:(q/f'raw/{name}.{s}').write_bytes(getattr(x,s))
 receipts.append({'name':name,'argv':argv,'cwd':str(r),'utcStart':start,'utcEnd':end,'exit':x.returncode,'stdoutSHA256':hashlib.sha256(x.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(x.stderr).hexdigest()});(q/'final-command-receipts.json').write_text(json.dumps(receipts,indent=2)+'\n');assert x.returncode==0,x.stderr.decode()
post=fingerprint();assert pre==post;(q/'repair-source-config-post.json').write_text(json.dumps(post,indent=2)+'\n');print(json.dumps({'finalQuality':'PASS','baseline':23,'judgeSix':6,'refinementGroups':4,'native':'NOT_RUN','sourceConfigRows':len(pre),'sourceConfigChanges':0}))
