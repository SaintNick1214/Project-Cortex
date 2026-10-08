from pathlib import Path
import subprocess,json,hashlib,datetime,os
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-parent-inputs-c9-preparation';w=r/'work/resume/task04-terminal-capture-parent-inputs-c9-preparation';ev=q/'evidence-final';ev.mkdir(exist_ok=True);sha=lambda b:hashlib.sha256(b).hexdigest();utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();prefix=str(r/'work/resume/toolchain-bin');env={**os.environ,'PATH':prefix+':'+os.environ['PATH']}
protected=[]
for name in ['task04-terminal-capture-parent-inputs-c8-preparation','task04-terminal-capture-parent-inputs-c8-review','task04-terminal-capture-native-extension-preparation-c3','task04-terminal-capture-native-profiles-c3-review','task04-terminal-capture-parent-inputs-c7-preparation','task04-terminal-capture-parent-inputs-c7-review','task04-terminal-capture-native-extension-preparation-c2','task04-parent-native-inputs-c6-preparation','task04-parent-native-inputs-c6-review','task04-terminal-capture-product-c2-review','task04-terminal-capture-implementation-c2']:
 d=r/'_goals/convex-backend-runtime-2026-10-02/qa'/name;protected.extend(p for p in d.rglob('*') if p.is_file())
protected+=[r/p for p in ['convex-dev/runtimeModelPolicy.ts','convex-dev/runtimePolicySchema.ts','tests/unit/runtime/model-policy-admission.test.ts','package.json','package-lock.json','convex.json','jest.config.mjs','eslint.config.js']];protected=sorted(set(protected),key=lambda p:str(p));finger=lambda:[{'path':str(p.relative_to(r)),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in protected];pre=finger();(q/'protected-pre.json').write_text(json.dumps(pre,indent=2)+'\n')
sourcePaths=list(w.glob('*.mjs'))+list(w.glob('*.py'))+list(q.glob('*inputs-*.mjs'))+[r/p for p in ['package.json','package-lock.json','jest.config.mjs','eslint.config.js']];base=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-extension-preparation-c4'
for profile in [base,base/'regression']:
 sourcePaths += [profile/s for s in ['project-request.json','registration-inventory.json','scripts/guard.mjs','scripts/arguments.mjs','fixture/convex/auth.config.ts']]
for p in sourcePaths:
 d=ev/'source-preimages'/p.relative_to(r);d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(p.read_bytes())
commands=[('node',['node','--version'],0,{}),('npm',[prefix+'/npm','--version'],0,{})]
commands += [(p.stem+'-syntax',['node','--check',str(p)],0,{}) for p in q.glob('*inputs-*.mjs')]
for profile in ['extension','regression']:
 commands += [('offline-'+profile,['node','--experimental-vm-modules',str(w/f'offline-{profile}.mjs')],0,{})]
commands += [('guard',['node',str(w/'guard-controls.mjs')],0,{}),('phase',['node',str(w/'phase-controls.mjs')],0,{})]
for profile in ['extension','regression']:
 commands += [('effect-matrix-'+profile,['node','--experimental-vm-modules',str(w/f'effect-matrix-{profile}.mjs')],0,{})]
 for subject,expected in [('c7',1),('c8',0)]:commands += [('prior-C7-requirement-'+profile+'-'+subject,['node','--experimental-vm-modules',str(w/f'prior-requirement-{profile}.mjs')],expected,{'C8_SUBJECT':subject})]
 commands += [('prior-C8-violations-'+profile,['node','--experimental-vm-modules',str(w/f'prior-C8-violations-{profile}.mjs')],0,{})]
 for subject,expected in [('c8',1),('c9',0)]:commands += [('shared-C8-requirement-'+profile+'-'+subject,['node','--experimental-vm-modules',str(w/f'real-chain-{profile}.mjs')],expected,{'C9_SUBJECT':subject,'C9_REQUIREMENT_ONLY':'1'})]
 commands += [('real-chain-'+profile,['node','--experimental-vm-modules',str(w/f'real-chain-{profile}.mjs')],0,{})]
receipts=[]
for name,argv,expectedExit,extraEnv in commands:
 if name.startswith('offline-'):
  n=name.removeprefix('offline-');p=q/f'results-{n}.json'
  if p.exists():p.rename(q/f'results-{n}-exploratory84.json')
 if name.startswith('effect-matrix-') or name.startswith('real-chain-'):
  p=q/(name+'.json')
  if p.exists():p.rename(q/(name+'-exploratory.json'))
 before=[{'path':str(p.relative_to(r)),'sha256':sha(p.read_bytes())} for p in sourcePaths];start=utc();out=subprocess.run(argv,cwd=r,env={**env,**extraEnv},stdout=subprocess.PIPE,stderr=subprocess.PIPE);end=utc();(ev/(name+'.stdout')).write_bytes(out.stdout);(ev/(name+'.stderr')).write_bytes(out.stderr);after=[{'path':str(p.relative_to(r)),'sha256':sha(p.read_bytes())} for p in sourcePaths];receipts.append({'name':name,'argv':argv,'cwd':str(r),'startedAt':start,'endedAt':end,'environmentOverrides':extraEnv,'PATHPrefix':prefix,'expectedExit':expectedExit,'actualExit':out.returncode,'pre':before,'post':after,'stdout':str((ev/(name+'.stdout')).relative_to(q)),'stderr':str((ev/(name+'.stderr')).relative_to(q)),'sourcePreimages':'evidence-final/source-preimages'});assert before==after;assert out.returncode==expectedExit,(name,out.stderr.decode())
post=finger();(q/'protected-post.json').write_text(json.dumps(post,indent=2)+'\n');assert pre==post;(q/'execution.json').write_text(json.dumps({'commands':receipts,'protectedFiles':len(pre),'protectedUnchanged':True,'node':'24.19.0','npm':'12.2.0','noJestNoDotenv':True,'actualEffects':'NOT_RUN'},indent=2)+'\n');print(json.dumps({'status':'PASS_OFFLINE','commands':len(commands),'protectedFiles':len(pre),'sameRequirements':'C7_RED_C8_GREEN_AND_C8_RED_C9_GREEN_BOTH_PROFILES'}))
