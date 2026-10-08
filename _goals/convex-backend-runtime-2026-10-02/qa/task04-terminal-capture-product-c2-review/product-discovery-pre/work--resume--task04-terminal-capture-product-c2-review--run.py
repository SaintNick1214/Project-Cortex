from pathlib import Path
import subprocess,json,hashlib,datetime,os
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-product-c2-review';w=r/'work/resume/task04-terminal-capture-product-c2-review'
env=os.environ.copy();env['PATH']=str(r/'work/resume/toolchain-bin')+':'+env['PATH']
files=['convex-dev/runtimeModelPolicy.ts','convex-dev/runtimePolicySchema.ts','convex-dev/schema.ts','convex-dev/runtimeModelPolicyBootstrap.ts','convex-dev/runtimeGateway.ts','convex-dev/runtimeAuth.ts','convex-dev/runtimeMemoryRepository.ts','src/domain/model-policy.ts','src/domain/profile.ts','tests/unit/runtime/model-policy-admission.test.ts','tests/unit/runtimeMemory/fixture.ts','work/resume/foundation-jest.config.mjs','jest.config.mjs','tsconfig.json','tsconfig.lint.json','eslint.config.js','package.json','package-lock.json','convex.json','work/resume/task04-terminal-capture-product-c2-review/hostile.test.ts','work/resume/task04-terminal-capture-product-c2-review/jest.config.mjs','work/resume/task04-terminal-capture-product-c2-review/run.py']
(q/'binding-files.json').write_text(json.dumps(files,indent=2))
def snapshot(name):
 d=q/name;d.mkdir(exist_ok=True);rows=[]
 for f in files:
  b=(r/f).read_bytes();(d/f.replace('/','--')).write_bytes(b);rows.append({'path':f,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 return rows
j=['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--runInBand']
p=j+['--config','work/resume/foundation-jest.config.mjs','--runTestsByPath','tests/unit/runtime/model-policy-admission.test.ts']
h=j+['--config',str(w/'jest.config.mjs'),'--runTestsByPath',str(w/'hostile.test.ts')]
commands=[('node-version',['node','--version']),('npm-version',['npm','--version']),('product-config',p+['--showConfig']),('product-discovery',p+['--listTests']),('product',p+['--json','--outputFile',str(q/'product.results.json')]),('hostile-config',h+['--showConfig']),('hostile-discovery',h+['--listTests']),('hostile',h+['--json','--outputFile',str(q/'hostile.results.json')]),('types',['node','node_modules/typescript/bin/tsc','--project','tsconfig.lint.json','--noEmit']),('lint',['node','node_modules/eslint/bin/eslint.js','convex-dev/runtimeModelPolicy.ts','convex-dev/runtimePolicySchema.ts','tests/unit/runtime/model-policy-admission.test.ts','--report-unused-disable-directives'])]
for name,argv in commands:
 pre=snapshot(name+'-pre');start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=r,env=env,capture_output=True);end=datetime.datetime.now(datetime.timezone.utc).isoformat();post=snapshot(name+'-post')
 (q/(name+'.stdout')).write_bytes(p.stdout);(q/(name+'.stderr')).write_bytes(p.stderr);(q/(name+'.command.json')).write_text(json.dumps({'argv':argv,'cwd':str(r),'startUTC':start,'endUTC':end,'exitCode':p.returncode,'pre':pre,'post':post,'unchanged':pre==post},indent=2));print(name,p.returncode,flush=True)
