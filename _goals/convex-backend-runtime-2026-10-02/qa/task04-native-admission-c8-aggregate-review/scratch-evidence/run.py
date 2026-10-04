import subprocess,json,hashlib,datetime,shutil
from pathlib import Path
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-native-admission-c8-aggregate-review';O=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-c8-aggregate-review'
h=lambda b:hashlib.sha256(b).hexdigest(); now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
files=['convex-dev/runtimeModelPolicy.ts','convex-dev/runtimeModelPolicyBootstrap.ts','convex-dev/runtimePolicySchema.ts','convex-dev/schema.ts','tests/unit/runtime/model-policy-admission.test.ts','tests/unit/runtimeMemory/fixture.ts','package.json','package-lock.json','work/resume/task04-native-admission-c8-aggregate-review/main.jest.mjs']
pre={}
for f in files:
 p=R/f;data=p.read_bytes();pre[f]={'sha256':h(data),'bytes':len(data)};out=O/'check-preimages'/f;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(data)
argv=['/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config','work/resume/task04-native-admission-c8-aggregate-review/main.jest.mjs','--runInBand','--no-cache','--json','--outputFile','work/resume/task04-native-admission-c8-aggregate-review/jest-results02.json']
start=now()
with (W/'jest02.stdout').open('wb') as out,(W/'jest02.stderr').open('wb') as err:r=subprocess.run(argv,cwd=R,stdout=out,stderr=err,timeout=120)
post={f:{'sha256':h((R/f).read_bytes()),'bytes':(R/f).stat().st_size} for f in files};assert pre==post
result=json.loads((W/'jest-results02.json').read_text());assert r.returncode==0 and result['numPassedTests']==76 and result['numPendingTests']==0 and result['numTodoTests']==0 and result['numFailedTests']==0
receipt={'argv':argv,'cwd':str(R),'startedAt':start,'endedAt':now(),'exitCode':r.returncode,'sourceBefore':pre,'sourceAfter':post,'passed':76,'skipped':0,'failed':0,'classification':'OFFLINE_HANDLER_TESTS_NOT_NATIVE_OCC_OR_PAID_PROOF'}
(O/'fresh-b76-command.json').write_text(json.dumps(receipt,indent=2)+'\n')
for name in ['jest02.stdout','jest02.stderr','jest-results02.json']:shutil.copyfile(W/name,O/name)
