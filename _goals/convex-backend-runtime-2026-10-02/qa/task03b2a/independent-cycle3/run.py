from pathlib import Path
import subprocess,json,datetime,hashlib,os,concurrent.futures
root=Path('/workspace/Project-Cortex/work/backend-runtime/task03b2a-checkout'); out=Path('/tmp/task03b2a-review3-tgufib91'); qa=root/'_goals/convex-backend-runtime-2026-10-02/qa/task03b2a'
(out/'tmp').mkdir(exist_ok=True)
records=[]
env=os.environ.copy(); env.update({'CONVEX_URL':'http://127.0.0.1:1','LOCAL_CONVEX_URL':'http://127.0.0.1:1','CONVEX_TEST_MODE':'local','TMPDIR':str(out/'tmp')})
def run(name,argv):
 started=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with (out/(name+'.log')).open('w') as log:
  result=subprocess.run(argv,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
 record={'name':name,'argv':argv,'cwd':str(root),'startedAt':started,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':result.returncode,'log':str(out/(name+'.log'))}
 records.append(record); print(json.dumps({'name':name,'exitCode':result.returncode}),flush=True); return record
for name in ['boundary-probes','extra-probes']:
 src=qa/'history/cycle2-final/independent'/(name+'.mjs.text'); old=src.read_text(); new=old.replace('/workspace/Project-Cortex/work/backend-runtime/task03b2a-judge-cycle2/'+name+'.json',str(out/(name+'.json')))
 assert new!=old
 (out/(name+'.mjs')).write_text(new)
 (out/(name+'.provenance.json')).write_text(json.dumps({'archivedScript':str(src),'archiveSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'onlyChange':'terminal JSON output path redirected to this reviewer-owned /tmp directory','retargetedSha256':hashlib.sha256(new.encode()).hexdigest()},indent=2)+'\n')
src=(qa/'baseline-root-types.mjs').read_text().replace('import ts from "typescript";',f'import ts from "{root}/node_modules/typescript/lib/typescript.js";').replace('"_goals/convex-backend-runtime-2026-10-02/qa/task03b2a/baseline-diagnostics.json"',json.dumps(str(out/'baseline-diagnostics.json')))
(out/'baseline.mjs').write_text(src)
src=(qa/'registration-probe.mjs').read_text().replace('`../../../../convex-dev/${module}.ts`',f'`{root}/convex-dev/${{module}}.ts`').replace('"_goals/convex-backend-runtime-2026-10-02/qa/task03b2a/framework-registration.json"',json.dumps(str(out/'framework-registration.json')))
(out/'registration.mjs').write_text(src)
run('node-version',['node','--version']); run('npm-version',['npm','--version'])
checks=[
('actual-backend-types',['node','node_modules/typescript/bin/tsc','-p','convex-dev/tsconfig.json','--pretty','false']),
('backend-types',['node','node_modules/typescript/bin/tsc','-p',str(qa.relative_to(root)/'tsconfig.backend.json'),'--pretty','false']),
('test-types',['node','node_modules/typescript/bin/tsc','-p',str(qa.relative_to(root)/'tsconfig.tests.json'),'--pretty','false']),
('lint',['node','node_modules/eslint/bin/eslint.js','convex-dev/schema.ts','convex-dev/immutable.ts','convex-dev/mutable.ts','convex-dev/users.ts','convex-dev/sessions.ts','convex-dev/runtimeMetadataAuth.ts','tests/unit/runtimeMetadataAuth','--report-unused-disable-directives']),
('discovery',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--testPathPatterns=tests/unit/runtimeMetadataAuth','--listTests','--json','--runInBand','--cacheDirectory='+str(out/'jest-cache')]),
('full-root-types',['node','node_modules/typescript/bin/tsc','--noEmit','--pretty','false']),
('baseline-root-types',['node',str(out/'baseline.mjs')]),
('inventory',['node',str(qa.relative_to(root)/'inventory.mjs'),str(out/'catalog')]),
('registration',['node','--import','tsx',str(out/'registration.mjs')]),
('boundary-probes',['node','--import','tsx',str(out/'boundary-probes.mjs')]),
('extra-probes',['node','--import','tsx',str(out/'extra-probes.mjs')]),
('diff-check',['git','diff','--check']),
('compiler-unchanged',['git','diff','--exit-code','--','convex-dev/tsconfig.json'])]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: list(pool.map(lambda args:run(*args),checks))
canon=[qa/'catalog/public-path-inventory.json',qa/'catalog/public-path-inventory.md']
hashcat=lambda: {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in canon}
before={'catalog':hashcat(),'temporary':list((out/'tmp').glob('cortex-metadata-inventory-*'))}
run('ordinary-jest',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--testPathPatterns=tests/unit/runtimeMetadataAuth','--runInBand','--forceExit','--silent','--json','--outputFile='+str(out/'jest-results.json'),'--cacheDirectory='+str(out/'jest-cache')])
after={'catalog':hashcat(),'temporary':list((out/'tmp').glob('cortex-metadata-inventory-*'))}
(out/'ordinary-test-preservation.json').write_text(json.dumps({'before':before,'after':after,'catalogUnchanged':before['catalog']==after['catalog'],'temporaryClean':not before['temporary'] and not after['temporary']},indent=2,default=str)+'\n')
(out/'commands.json').write_text(json.dumps(sorted(records,key=lambda r:r['startedAt']),indent=2)+'\n')
