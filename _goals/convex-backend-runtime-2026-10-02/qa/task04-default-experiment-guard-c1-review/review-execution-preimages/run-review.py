from pathlib import Path
import subprocess,datetime,json,hashlib,os
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-default-experiment-guard-c1-review';s=r/'work/resume/task04-default-experiment-guard-c1-review';node=Path('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node');raw=q/'raw';raw.mkdir(exist_ok=True)
commands=[('node',[str(node),'--version']),('npm',[str(r/'work/resume/toolchain-bin/npm'),'--version']),('baseline23',[str(node),'--experimental-strip-types',str(s/'scripts/offline-check.mjs')]),('hostile6',[str(node),'--experimental-strip-types',str(s/'scripts/hostile.mjs')]),('scoped-lint',[str(node),'node_modules/eslint/bin/eslint.js','--config',str(s/'eslint.config.mjs'),*[str(s/('fixture/convex/'+n+'.ts')) for n in ['canonical','compiled','guard','runner','schema']],*[str(s/('scripts/'+n+'.mjs')) for n in ['offline-check','verify','finalize']]]),('strict-typecheck',[str(node),'node_modules/typescript/bin/tsc','--project',str(s/'fixture/tsconfig.json')])]
receipts=[]
for name,argv in commands:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=r,capture_output=True,env={**os.environ,'PATH':str(r/'work/resume/toolchain-bin')+':'+os.environ['PATH']});end=datetime.datetime.now(datetime.timezone.utc).isoformat()
 (raw/(name+'.stdout')).write_bytes(p.stdout);(raw/(name+'.stderr')).write_bytes(p.stderr);receipts.append({'name':name,'argv':argv,'cwd':str(r),'utcStart':start,'utcEnd':end,'exit':p.returncode,'stdoutSHA256':hashlib.sha256(p.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(p.stderr).hexdigest()});print(name,p.returncode,p.stdout.decode()[:3000],p.stderr.decode()[:1000])
(q/'command-receipts.json').write_text(json.dumps(receipts,indent=2)+'\n')
