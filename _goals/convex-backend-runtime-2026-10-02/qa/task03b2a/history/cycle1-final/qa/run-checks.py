from pathlib import Path
import subprocess, datetime, json, os, hashlib
root=Path.cwd()
qa=root/'_goals/convex-backend-runtime-2026-10-02/qa/task03b2a'
commands=[
 ('backend-types',['node','node_modules/typescript/bin/tsc','--project',str(qa.relative_to(root)/'tsconfig.backend.json'),'--pretty','false']),
 ('test-types',['node','node_modules/typescript/bin/tsc','--project',str(qa.relative_to(root)/'tsconfig.tests.json'),'--pretty','false']),
 ('scoped-lint',['node','node_modules/eslint/bin/eslint.js','convex-dev/immutable.ts','convex-dev/mutable.ts','convex-dev/users.ts','convex-dev/sessions.ts','convex-dev/runtimeMetadataAuth.ts','tests/unit/runtimeMetadataAuth','--report-unused-disable-directives']),
 ('scoped-jest',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--testPathPatterns=tests/unit/runtimeMetadataAuth','--runInBand','--forceExit','--silent','--json','--outputFile='+str(qa.relative_to(root)/'jest-results.json')]),
 ('ast-inventory',['node',str(qa.relative_to(root)/'inventory.mjs')]),
 ('framework-registration',['node','--import','tsx',str(qa.relative_to(root)/'registration-probe.mjs')]),
 ('full-root-types',['node','node_modules/typescript/bin/tsc','--noEmit','--pretty','false'])]
env=os.environ.copy();env.update(CONVEX_URL='http://127.0.0.1:1', CONVEX_TEST_MODE='local')
receipts=[]
previous=qa/'check-receipts.json'
retained_baseline=[receipt for receipt in json.loads(previous.read_text()) if receipt['name']=='baseline-root-types'] if previous.exists() else []
for name,argv in commands:
 started=datetime.datetime.now(datetime.timezone.utc).isoformat()
 result=subprocess.run(argv,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 ended=datetime.datetime.now(datetime.timezone.utc).isoformat()
 log=qa/'checks'/f'{name}.log';log.write_text(result.stdout)
 receipt={'name':name,'argv':argv,'cwd':str(root),'startedAt':started,'endedAt':ended,'exitCode':result.returncode,'log':str(log.relative_to(root))}
 receipts.append(receipt); print(json.dumps(receipt),flush=True)
(qa/'check-receipts.json').write_text(json.dumps(receipts+retained_baseline,indent=2)+'\n')
files=['convex-dev/schema.ts','convex-dev/immutable.ts','convex-dev/mutable.ts','convex-dev/users.ts','convex-dev/sessions.ts','convex-dev/runtimeMetadataAuth.ts']+[str(p.relative_to(root)) for p in (root/'tests/unit/runtimeMetadataAuth').glob('*.ts')]
(qa/'source-hashes.json').write_text(json.dumps([{'file':f,'sha256':hashlib.sha256((root/f).read_bytes()).hexdigest()} for f in sorted(files)],indent=2)+'\n')
