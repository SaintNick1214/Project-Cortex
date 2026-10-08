import pathlib,json,subprocess,datetime,hashlib,concurrent.futures,os
R=pathlib.Path('/workspace/Project-Cortex'); C=R/'work/resume/registry/candidate'; E=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03b2b1-resume-cycle4'; Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03b2b1-resume-cycle4-review'; S=R/'work/resume/registry-review'; raw=Q/'raw'
for name in ['registry','core']:
 j=json.loads((E/f'scripts/jest.{name}.json').read_text()); j['cacheDirectory']=str(S/f'cache-{name}'); (S/f'jest.{name}.json').write_text(json.dumps(j))
checks=[]
for name in ['registry','core']:
 checks.append((f'{name}-tests',['node','--experimental-vm-modules',str(C/'node_modules/jest/bin/jest.js'),'--config',str(S/f'jest.{name}.json'),'--runInBand','--json','--outputFile',str(Q/f'{name}-tests.json')]))
for name,config in [('backend-types',C/'convex-dev/tsconfig.json'),('scoped-types',E/'scripts/tsconfig.registry.json'),('core-types',E/'scripts/tsconfig.core.json'),('root-types',C/'tsconfig.json'),('root-lint-types',C/'tsconfig.lint.json')]:
 checks.append((name,['node',str(C/'node_modules/typescript/bin/tsc'),'-p',str(config),'--noEmit']))
checks.append(('scoped-lint',['node',str(C/'node_modules/eslint/bin/eslint.js'),'convex-dev/runtimeRegistryAuth.ts','convex-dev/agents.ts','convex-dev/memorySpaces.ts','convex-dev/contexts.ts','convex-dev/schema.ts','tests/unit/runtimeRegistryAuth','--max-warnings','0']))
checks.append(('catalog',['node','_goals/convex-backend-runtime-2026-10-02/qa/task03b2b1/inventory.mjs',str(Q/'catalog')]))
for name in ['original-authority','original-native','required-graph','required-accessor','required-stateful','required-admission','db-read-matrix','identity-required']:
 checks.append((name,['node',str(C/'node_modules/tsx/dist/cli.mjs'),str(E/f'scripts/{name}.mts')]))
def run(pair):
 name,cmd=pair; start=datetime.datetime.now(datetime.timezone.utc).isoformat(); env=dict(os.environ,CONVEX_URL='http://127.0.0.1:1',NEXT_PUBLIC_CONVEX_URL='http://127.0.0.1:1'); p=subprocess.run(cmd,cwd=C,env=env,capture_output=True,text=True);(raw/f'{name}.stdout').write_text(p.stdout);(raw/f'{name}.stderr').write_text(p.stderr); rec={'name':name,'command':cmd,'cwd':str(C),'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':p.returncode}; (raw/f'{name}.command.json').write_text(json.dumps(rec,indent=2));print(name,p.returncode,flush=True);return rec
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: results=list(pool.map(run,checks))
(Q/'commands.json').write_text(json.dumps(results,indent=2))
