import hashlib, json, pathlib, shutil, subprocess, sys, time
root=pathlib.Path('/workspace/Project-Cortex')
qa=root/'_goals/convex-backend-runtime-2026-10-02/qa'
candidate=qa/'task03-foundation-live-preparation'
review=qa/'task03-foundation-live-preparation-review'
scratch=root/'work/resume/current-guard-prep-judge'
digest=hashlib.sha256((candidate/'runtime-freeze.json').read_bytes()).hexdigest()
assert digest==sys.argv[1], 'Expected final frozen digest'
commands=[]
def run(name,args):
    start=time.monotonic()
    result=subprocess.run(args,cwd=root,capture_output=True,text=True,timeout=90)
    (review/(name+'.stdout')).write_text(result.stdout)
    (review/(name+'.stderr')).write_text(result.stderr)
    receipt={'name':name,'argv':args,'cwd':str(root),'exitCode':result.returncode,'elapsedMs':round((time.monotonic()-start)*1000),'candidateSha256':digest}
    commands.append(receipt)
    (review/'commands.json').write_text(json.dumps(commands,indent=2)+'\n')
    print(json.dumps(receipt),flush=True)
run('independent-probe',['node','--import','tsx',str(scratch/'probe.mjs')])
for name in ['provision','deploy','driver','qualify','cleanup','retire','key-check']:
    run('entrypoint-'+name,['node','--import','tsx',str(scratch/'entrypoint-denial-probe.mjs'),str(candidate/'scripts'/f'{name}.mjs')])
for name in ['offline-arguments-check','offline-closure-check','auth-classifier-check','management-check']:
    run(name,['node','--import','tsx',str(candidate/'scripts'/f'{name}.mjs')])
files=[str(p) for folder in ['scripts','cases'] for p in sorted((candidate/folder).glob('*.mjs'))]
run('scoped-lint',['node',str(root/'node_modules/eslint/bin/eslint.js'),'--config',str(candidate/'eslint.config.mjs'),*files,str(candidate/'scripts/contracts.ts')])
run('native-contract-types',['node',str(root/'node_modules/typescript/bin/tsc'),'--ignoreConfig','--noEmit','--strict','--skipLibCheck','--module','ESNext','--moduleResolution','Bundler','--target','ES2022',str(candidate/'scripts/contracts.ts')])
offline=scratch/'offline-fixture'
shutil.copytree(qa/'task03-foundation-live-fixture/fixture',offline,ignore=shutil.ignore_patterns('node_modules','_generated'),dirs_exist_ok=True)
shutil.copytree(root/'convex-dev/_generated',offline/'convex/_generated',dirs_exist_ok=True)
run('offline-fixture-types',['node',str(root/'node_modules/typescript/bin/tsc'),'-p',str(offline/'convex/tsconfig.json'),'--noEmit'])
assert hashlib.sha256((candidate/'runtime-freeze.json').read_bytes()).hexdigest()==digest,'Freeze changed during review'
summary={'candidateSha256':digest,'commands':len(commands),'failed':sum(c['exitCode']!=0 for c in commands),'serviceCalls':0,'signatures':0,'officialCodegen':'NOT_RUN_REQUIRED_AFTER_REVIEW_ON_ACTUAL_TARGET','offlineBindingsProvenance':'Existing versioned root _generated copied solely for offline fixture typecheck; not target codegen evidence'}
(review/'independent-check-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary),flush=True)
