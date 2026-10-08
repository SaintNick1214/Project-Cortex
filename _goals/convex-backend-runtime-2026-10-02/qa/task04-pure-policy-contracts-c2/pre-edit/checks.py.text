import subprocess,json,datetime,pathlib,hashlib
root=pathlib.Path('/workspace/Project-Cortex');out=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-pure-policy-contracts'
def run(name,args):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();r=subprocess.run(args,cwd=root,capture_output=True,text=True)
 (out/(name+'.stdout')).write_text(r.stdout);(out/(name+'.stderr')).write_text(r.stderr)
 receipt={'command':args,'cwd':str(root),'startedAtUTC':start,'finishedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode}
 (out/(name+'.receipt.json')).write_text(json.dumps(receipt,indent=2)+'\n');print(name,r.returncode)
run('toolchain',['node','/home/agent/.npm/_npx/1106a35d869e25fb/node_modules/npm/bin/npm-cli.js','--version'])
run('affected-typecheck',['node','node_modules/typescript/bin/tsc','--project','_goals/convex-backend-runtime-2026-10-02/qa/task04-pure-policy-contracts/tsconfig.scoped.json','--noEmit'])
run('scoped-lint',['node','node_modules/eslint/bin/eslint.js','src/domain/model-policy.ts','src/domain/index.ts','tests/unit/domain/model-policy.test.ts','--report-unused-disable-directives','--max-warnings=0'])
run('discovery',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config','_goals/convex-backend-runtime-2026-10-02/qa/task04-pure-policy-contracts/jest.scoped.mjs','--listTests','--runInBand'])
run('unit',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config','_goals/convex-backend-runtime-2026-10-02/qa/task04-pure-policy-contracts/jest.scoped.mjs','--runInBand','--json','--outputFile',str(out/'unit.result.json')])
run('root-build',['node','/home/agent/.npm/_npx/1106a35d869e25fb/node_modules/npm/bin/npm-cli.js','run','build'])
run('public-contracts',['node','/home/agent/.npm/_npx/1106a35d869e25fb/node_modules/npm/bin/npm-cli.js','run','test:contracts'])
