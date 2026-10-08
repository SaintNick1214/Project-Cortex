from pathlib import Path
import subprocess,json,datetime,hashlib,os
root=Path('/workspace/Project-Cortex');own=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-default-experiment-guard-c2-review';(own/'raw').mkdir(exist_ok=True)
node='/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node';env=os.environ.copy();env['PATH']=str(root/'work/resume/toolchain-bin')+':'+env['PATH']
commands=[('node',[node,'--version'],root,0),('npm',['npm','--version'],root,0),('baseline23',[node,'scripts/offline-check.mjs'],own/'copy-c2',0),('hostile6-c2',[node,'scripts/hostile.mjs'],own/'copy-c2',0),('refinement4',[node,'scripts/refinement-check.mjs'],own/'copy-c2',0),('independent5',[node,'scripts/independent.mjs'],own/'copy-c2',0),('hostile6-c1-red',[node,'scripts/hostile.mjs'],own/'copy-c1',1),('types',[node,str(root/'node_modules/typescript/bin/tsc'),'--project','fixture/tsconfig.json','--noEmit'],own/'copy-c2',0),('lint',[node,str(root/'node_modules/eslint/bin/eslint.js'),'--config','eslint.config.mjs','fixture/convex','scripts/offline-check.mjs','scripts/refinement-check.mjs','scripts/independent.mjs','--report-unused-disable-directives'],own/'copy-c2',0)]
receipts=[]
for name,argv,cwd,expected in commands:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=cwd,env=env,capture_output=True);end=datetime.datetime.now(datetime.timezone.utc).isoformat()
 stdout=own/'raw'/f'{name}.stdout';stderr=own/'raw'/f'{name}.stderr';stdout.write_bytes(p.stdout);stderr.write_bytes(p.stderr)
 receipts.append({'name':name,'argv':argv,'cwd':str(cwd),'utcStart':start,'utcEnd':end,'exitCode':p.returncode,'expectedExit':expected,'stdoutSha256':hashlib.sha256(p.stdout).hexdigest(),'stderrSha256':hashlib.sha256(p.stderr).hexdigest()});print(name,p.returncode,p.stdout.decode()[:100] if p.returncode==expected else p.stderr.decode()[:1000])
(own/'command-receipts.json').write_text(json.dumps(receipts,indent=2)+'\n')
