import subprocess,pathlib,json,datetime,time,os,sys
root=pathlib.Path('/tmp/task03c2-d-review1-o0v1eus6');snap=root/'snapshot';raw=root/'raw'
name=sys.argv[1]; qa='_goals/convex-backend-runtime-2026-10-02/qa/task03c2-d';node=subprocess.check_output(['which','node'],text=True).strip()
commands={
 'node-version':[node,'--version'],
 'npm-version':['npx','--yes','--package=npm@12.2.0','--','npm','--version'],
 'types':[node,'node_modules/typescript/bin/tsc','--project',qa+'/tsconfig.scoped.json','--noEmit','--pretty','false'],
 'lint':[node,'node_modules/eslint/bin/eslint.js','src/governance/index.ts','src/index.ts','tests/unit/runtimeWorkerClient/governance.test.ts','--report-unused-disable-directives'],
 'discovery':[node,'--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',qa+'/jest.scoped.cjs','--listTests','--runInBand'],
 'outcomes':[node,'--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',qa+'/jest.scoped.cjs','--runInBand','--json','--outputFile='+str(raw/'outcomes.json')],
 'build':['npx','--yes','--package=npm@12.2.0','--','npm','run','build'],
 'packed-contract':[node,qa+'/packed-browser-contract.mjs'],
}
env=dict(os.environ);env['npm_config_cache']='/workspace/Project-Cortex/work/backend-runtime/npm12-cache';env['CORTEX_GOVERNANCE_QA_OUTPUT']=str(raw)
start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
with (raw/(name+'.log')).open('w') as out:result=subprocess.run(commands[name],cwd=snap,env=env,stdout=out,stderr=subprocess.STDOUT)
record={'name':name,'argv':commands[name],'cwd':str(snap),'startedAt':start,'durationSeconds':round(time.monotonic()-t,3),'exitCode':result.returncode,'nodeExecutable':node,'nodeVersion':subprocess.check_output([node,'--version'],text=True).strip(),'environmentOverrides':{'npm_config_cache':env['npm_config_cache'],'CORTEX_GOVERNANCE_QA_OUTPUT':str(raw)},'log':str(raw/(name+'.log'))}
(raw/(name+'.command.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record));print((raw/(name+'.log')).read_text()[-6000:]);sys.exit(result.returncode)
