from pathlib import Path
import os,subprocess,json,datetime,concurrent.futures
root=Path('/workspace/Project-Cortex/work/backend-runtime/task03b2a-checkout')
out=Path('/workspace/Project-Cortex/work/backend-runtime/task03b2a-judge-cycle2')
env=os.environ.copy();env.update(CONVEX_URL='http://127.0.0.1:1', CONVEX_TEST_MODE='local')
commands=[
('types-scoped',['node','node_modules/typescript/bin/tsc','-p',str(out/'tsconfig.backend.json'),'--pretty','false']),
('types-tests',['node','node_modules/typescript/bin/tsc','-p',str(out/'tsconfig.tests.json'),'--pretty','false']),
('types-actual-es2021',['node','node_modules/typescript/bin/tsc','-p',str(out/'tsconfig.backend.es2021.json'),'--pretty','false']),
('lint',['node','node_modules/eslint/bin/eslint.js','convex-dev/schema.ts','convex-dev/immutable.ts','convex-dev/mutable.ts','convex-dev/users.ts','convex-dev/sessions.ts','convex-dev/runtimeMetadataAuth.ts','tests/unit/runtimeMetadataAuth','--report-unused-disable-directives']),
('discovery',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str(out/'jest.config.mjs'),'--testPathPatterns=tests/unit/runtimeMetadataAuth','--listTests','--json','--runInBand']),
('jest',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str(out/'jest.config.mjs'),'--testPathPatterns=tests/unit/runtimeMetadataAuth','--runInBand','--forceExit','--silent','--json','--outputFile='+str(out/'jest-results.json')]),
('inventory',['node','_goals/convex-backend-runtime-2026-10-02/qa/task03b2a/inventory.mjs',str(out/'catalog')]),
('registration',['node','--import','tsx',str(out/'registration.mjs')]),
('baseline',['node',str(out/'baseline.mjs')]),
('full-root-types',['node','node_modules/typescript/bin/tsc','--noEmit','--pretty','false']),
('known-probes',['node','--import','tsx',str(out/'probes.mjs')]),
('known-additional',['node','--import','tsx',str(out/'additional-probes.mjs')]),
('known-numeric',['node','--import','tsx',str(out/'numeric-probe.mjs')]),
('diff-check',['git','diff','--check'])]
def run(command):
 name,argv=command;start=datetime.datetime.now(datetime.timezone.utc).isoformat();r=subprocess.run(argv,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 (out/(name+'.log')).write_text(r.stdout)
 receipt=dict(name=name,argv=argv,cwd=str(root),startedAt=start,endedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),exitCode=r.returncode,log=str(out/(name+'.log')))
 print(json.dumps(dict(name=name,exitCode=r.returncode)),flush=True)
 return receipt
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor: receipts=list(executor.map(run,commands))
(out/'commands.json').write_text(json.dumps(receipts,indent=2)+'\n')
