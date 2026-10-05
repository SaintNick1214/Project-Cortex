import subprocess,pathlib,json,datetime,time,os
root=pathlib.Path('/workspace/Project-Cortex');relative='_goals/convex-backend-runtime-2026-10-02/qa/task03c2-a';qa=root/relative
snapshot=pathlib.Path(json.loads((qa/'snapshot-provenance.json').read_text())['snapshot'])
env=os.environ.copy();env['npm_config_cache']='/workspace/Project-Cortex/work/backend-runtime/npm12-cache';env['CORTEX_METADATA_QA_OUTPUT']=str(qa)
checks=[
 ('packed-browser-contract-final',['node',relative+'/packed-browser-contract.mjs'],snapshot),
 ('existing-public-contracts',['npx','--yes','--package=npm@12.2.0','--','npm','run','test:contracts'],snapshot),
 ('source-boundary',['node',relative+'/source-boundary.cjs'],root),
 ('owned-diff-whitespace',['git','diff','--check','--','src/users/index.ts','src/sessions/index.ts','src/index.ts'],root),
]
for name,argv,cwd in checks:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();now=time.monotonic();r=subprocess.run(argv,cwd=cwd,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 (qa/(name+'.log')).write_text(r.stdout)
 receipts=json.loads((qa/'commands.json').read_text());receipts.append({'name':name,'argv':argv,'cwd':str(cwd),'environment':{'npm_config_cache':env['npm_config_cache'],'CORTEX_METADATA_QA_OUTPUT':env['CORTEX_METADATA_QA_OUTPUT']},'startedAt':start,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'durationSeconds':round(time.monotonic()-now,3),'exitCode':r.returncode,'log':relative+'/'+name+'.log'})
 (qa/'commands.json').write_text(json.dumps(receipts,indent=2)+'\n')
 print(name,r.returncode,flush=True)
 if r.returncode:print(r.stdout);raise SystemExit(r.returncode)
