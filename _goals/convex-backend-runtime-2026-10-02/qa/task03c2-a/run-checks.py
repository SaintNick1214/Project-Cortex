import subprocess,pathlib,json,datetime,time,concurrent.futures
root=pathlib.Path('/workspace/Project-Cortex')
qa=root/'_goals/convex-backend-runtime-2026-10-02/qa/task03c2-a'
snapshot=pathlib.Path(json.loads((qa/'snapshot-provenance.json').read_text())['snapshot'])
relative='_goals/convex-backend-runtime-2026-10-02/qa/task03c2-a'
checks=[
 ('scoped-types',['node','node_modules/typescript/bin/tsc','--project',relative+'/tsconfig.scoped.json','--noEmit','--pretty','false'],snapshot),
 ('owned-lint',['node','node_modules/eslint/bin/eslint.js','src/users/index.ts','src/sessions/index.ts','src/index.ts','tests/unit/runtimeWorkerClient/metadata-consumers.test.ts','tests/unit/runtimeWorkerClient/sessions-maintenance.test.ts','--report-unused-disable-directives'],snapshot),
 ('scoped-discovery',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',relative+'/jest.scoped.cjs','--listTests','--json','--runInBand'],snapshot),
 ('scoped-outcomes',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',relative+'/jest.scoped.cjs','--runInBand','--json','--outputFile='+str(qa/'tests.json')],snapshot),
 ('main-root-types',['node','node_modules/typescript/bin/tsc','--noEmit','--pretty','false'],root),
]
def run(check):
 name,argv,cwd=check;start=datetime.datetime.now(datetime.timezone.utc).isoformat();now=time.monotonic()
 result=subprocess.run(argv,cwd=cwd,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 (qa/(name+'.log')).write_text(result.stdout)
 return {'name':name,'argv':argv,'cwd':str(cwd),'startedAt':start,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'durationSeconds':round(time.monotonic()-now,3),'exitCode':result.returncode,'log':relative+'/'+name+'.log'}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:results=list(pool.map(run,checks))
(qa/'commands.json').write_text(json.dumps(results,indent=2)+'\n')
for r in results:print(r['name'],r['exitCode'],r['durationSeconds'])
