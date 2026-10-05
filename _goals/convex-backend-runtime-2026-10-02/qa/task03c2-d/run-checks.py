import subprocess,pathlib,json,datetime,time,concurrent.futures
root=pathlib.Path('/workspace/Project-Cortex')
qa=root/'_goals/convex-backend-runtime-2026-10-02/qa/task03c2-d'
snapshot=pathlib.Path(json.loads((qa/'snapshot-provenance.json').read_text())['snapshot'])
relative='_goals/convex-backend-runtime-2026-10-02/qa/task03c2-d'
checks=[
 ('scoped-types',[str(snapshot/'node_modules/.bin/tsc'),'--project',relative+'/tsconfig.scoped.json','--noEmit'],snapshot),
 ('lint',[str(snapshot/'node_modules/.bin/eslint'),'src/governance/index.ts','src/index.ts','tests/unit/runtimeWorkerClient/governance.test.ts','--report-unused-disable-directives'],snapshot),
 ('jest-discovery',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',relative+'/jest.scoped.cjs','--listTests','--runInBand'],snapshot),
 ('jest-outcomes',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',relative+'/jest.scoped.cjs','--runInBand','--json','--outputFile='+str(qa/'tests.json')],snapshot),
 ('root-types-current',['node','node_modules/typescript/bin/tsc','--noEmit'],root),
]
def run(check):
 name,argv,cwd=check;start=datetime.datetime.now(datetime.timezone.utc).isoformat();now=time.monotonic()
 result=subprocess.run(argv,cwd=cwd,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 (qa/(name+'.log')).write_text(result.stdout)
 return {'name':name,'argv':argv,'cwd':str(cwd),'startedAt':start,'durationSeconds':round(time.monotonic()-now,3),'exitCode':result.returncode,'log':relative+'/'+name+'.log'}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 results=list(pool.map(run,checks))
(qa/'commands.json').write_text(json.dumps(results,indent=2)+'\n')
for r in results: print(r['name'],r['exitCode'],r['durationSeconds'])
