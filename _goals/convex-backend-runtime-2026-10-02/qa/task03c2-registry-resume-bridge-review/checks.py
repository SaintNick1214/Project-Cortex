import subprocess,json,pathlib,datetime,concurrent.futures,hashlib,os
root=pathlib.Path('/workspace/Project-Cortex'); out=root/'_goals/convex-backend-runtime-2026-10-02/qa/task03c2-registry-resume-bridge-review'; scratch=root/'work/resume/sdk-bridge-review'
rows=json.loads((root/'_goals/convex-backend-runtime-2026-10-02/qa/task03c2-registry-resume-bridge/sources.json').read_text())
assert all(hashlib.sha256((root/r['path']).read_bytes()).hexdigest()==r['sha256'] for r in rows)
(out/'sources-before.json').write_text(json.dumps(rows,indent=2))
commands=[('root-types',['node','node_modules/typescript/bin/tsc','--noEmit']),('lint-types',['node','node_modules/typescript/bin/tsc','--project','tsconfig.lint.json','--noEmit']),('eslint',['node','node_modules/eslint/bin/eslint.js']+[r['path'] for r in rows]+['--max-warnings','0']),('focused',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--testPathPatterns=tests/unit/runtimeRegistryClient','--runInBand','--no-cache','--json','--outputFile='+str(out/'focused.json')])]
def run(row):
 name,argv=row; start=datetime.datetime.now(datetime.timezone.utc).isoformat(); env=os.environ.copy();env['CONVEX_URL']='https://example.convex.cloud';env['JEST_CACHE_DIRECTORY']=str(scratch/'cache')
 p=subprocess.run(argv,cwd=root,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT); (out/(name+'.log')).write_text(p.stdout)
 return dict(name=name,argv=argv,cwd=str(root),start=start,end=datetime.datetime.now(datetime.timezone.utc).isoformat(),exit=p.returncode)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: result=list(pool.map(run,commands))
(out/'commands.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
