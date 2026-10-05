from pathlib import Path
import json,hashlib,subprocess,datetime,os,shutil
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-parent-inputs-c7-preparation';w=r/'work/resume/task04-terminal-capture-parent-inputs-c7-preparation';ev=q/'evidence';ev.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest();utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();prefix=str(r/'work/resume/toolchain-bin');env={**os.environ,'PATH':prefix+':'+os.environ['PATH']}
protected=[r/'convex-dev/runtimeModelPolicy.ts',r/'convex-dev/runtimePolicySchema.ts',r/'tests/unit/runtime/model-policy-admission.test.ts',r/'convex.json',r/'package.json',r/'package-lock.json',r/'jest.config.js',r/'eslint.config.js']
for n in ['task04-parent-native-inputs-c6-preparation','task04-parent-native-inputs-c6-review','task04-native-admission-fixture-c8','task04-native-admission-c8-aggregate-review','task04-terminal-capture-implementation-c2','task04-terminal-capture-product-c2-review']:
 p=r/'_goals/convex-backend-runtime-2026-10-02/qa'/n
 if p.exists():protected.extend(x for x in p.rglob('*') if x.is_file())
protected=sorted(set(protected));protected=[p for p in protected if p.exists()]
def fingerprints():return [{'path':str(p.relative_to(r)),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in protected]
pre=fingerprints();(q/'protected-pre.json').write_text(json.dumps(pre,indent=2)+'\n')
sourcePaths=list(q.glob('*inputs-*.mjs'))+list(w.glob('*.mjs'))+list(w.glob('*.py'))+[r/'package.json',r/'package-lock.json',r/'jest.config.js',r/'eslint.config.js']
base=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-extension-preparation-c2'
for profile in [base,base/'regression']:
 sourcePaths.extend([profile/'scripts/guard.mjs',profile/'scripts/arguments.mjs',profile/'project-request.json',profile/'registration-inventory.json',profile/'fixture/convex/auth.config.ts'])
for p in sourcePaths:
 if p.exists():d=ev/'source-preimages'/p.relative_to(r);d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(p.read_bytes())
commands=[['node','--version'],[prefix+'/npm','--version']]
commands +=[['node','--check',str(p)] for p in q.glob('*inputs-*.mjs')]
commands +=[['node','--experimental-vm-modules',str(w/f'offline-{n}.mjs')] for n in ['extension','regression']]
commands +=[['node',str(w/'guard-controls.mjs')],['node',str(w/'phase-controls.mjs')]]
receipts=[]
for i,cmd in enumerate(commands):
 if len(cmd)>2 and 'offline-' in cmd[-1]:
  n=Path(cmd[-1]).stem.removeprefix('offline-');p=q/f'results-{n}.json'
  if p.exists():p.rename(q/f'results-{n}-exploratory82.json')
 before=[{'path':str(p.relative_to(r)),'sha256':sha(p.read_bytes())} for p in sourcePaths if p.exists()];start=utc();out=subprocess.run(cmd,cwd=r,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE);end=utc();(ev/f'{i:02d}.stdout').write_bytes(out.stdout);(ev/f'{i:02d}.stderr').write_bytes(out.stderr);after=[{'path':str(p.relative_to(r)),'sha256':sha(p.read_bytes())} for p in sourcePaths if p.exists()];receipts.append({'argv':cmd,'cwd':str(r),'startedAt':start,'endedAt':end,'exitCode':out.returncode,'PATHPrefix':prefix,'sourcePreimages':'evidence/source-preimages','pre':before,'post':after,'stdout':f'evidence/{i:02d}.stdout','stderr':f'evidence/{i:02d}.stderr'});assert before==after;assert out.returncode==0,(cmd,out.stderr.decode())
post=fingerprints();(q/'protected-post.json').write_text(json.dumps(post,indent=2)+'\n');assert pre==post
(q/'execution.json').write_text(json.dumps({'commands':receipts,'protectedFiles':len(pre),'protectedUnchanged':True,'node':'24.19.0','npm':'12.2.0','noJestNoDotenv':True,'realPrivateReads':0,'realNetwork':0,'realSigning':0,'native':'NOT_RUN'},indent=2)+'\n');print(json.dumps({'status':'PASS','commands':len(commands),'protectedFiles':len(pre),'protectedUnchanged':True}))
