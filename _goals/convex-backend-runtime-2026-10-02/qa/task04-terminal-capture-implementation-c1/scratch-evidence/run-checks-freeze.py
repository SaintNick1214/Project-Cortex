from pathlib import Path
import subprocess,json,hashlib,datetime,os
root=Path('/workspace/Project-Cortex'); packet=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-implementation-c1'
os.environ['PATH']='/workspace/Project-Cortex/work/resume/toolchain-bin:'+os.environ['PATH']
files=['convex-dev/runtimeModelPolicy.ts','convex-dev/runtimePolicySchema.ts','tests/unit/runtime/model-policy-admission.test.ts','work/resume/foundation-jest.config.mjs','jest.config.mjs','tsconfig.json','tsconfig.lint.json','eslint.config.mjs']
def snapshot(label):
 out=packet/label;out.mkdir(exist_ok=True); rows=[]
 for f in files:
  p=root/f
  if p.exists():
   b=p.read_bytes();(out/f.replace('/','--')).write_bytes(b);rows.append({'path':f,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 return rows
def run(name,argv):
 receipt={'cwd':str(root),'argv':argv,'startUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pre':snapshot(name+'-pre')}
 result=subprocess.run(argv,cwd=root,capture_output=True)
 (packet/(name+'.stdout.log')).write_bytes(result.stdout);(packet/(name+'.stderr.log')).write_bytes(result.stderr)
 receipt.update(exitCode=result.returncode,endUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),post=snapshot(name+'-post'))
 (packet/(name+'.command.json')).write_text(json.dumps(receipt,indent=2));print(name,result.returncode,flush=True)
jest=['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config','work/resume/foundation-jest.config.mjs','--runInBand','--runTestsByPath','tests/unit/runtime/model-policy-admission.test.ts']
run('config-freeze',jest+['--showConfig']);run('discovery-freeze',jest+['--listTests']);run('tests-freeze',jest+['--json','--outputFile',str(packet/'tests-freeze.results.json')])
run('typecheck-freeze',['node','node_modules/typescript/bin/tsc','--project','tsconfig.lint.json','--noEmit'])
run('lint-freeze',['node','node_modules/eslint/bin/eslint.js','convex-dev/runtimePolicySchema.ts','convex-dev/runtimeModelPolicy.ts','tests/unit/runtime/model-policy-admission.test.ts','--report-unused-disable-directives'])
