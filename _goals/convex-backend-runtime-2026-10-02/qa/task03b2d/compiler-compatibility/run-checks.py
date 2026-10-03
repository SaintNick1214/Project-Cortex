import datetime, hashlib, json, pathlib, subprocess, time
root=pathlib.Path.cwd();qa=pathlib.Path('_goals/convex-backend-runtime-2026-10-02/qa/task03b2d');target=qa/'compiler-compatibility'
files=[pathlib.Path(p) for p in ['convex-dev/governance.ts','convex-dev/runtimeWorkerAuth.ts','convex-dev/tsconfig.json']]
commands=[
 ('backend-final',['node','node_modules/typescript/bin/tsc','-p','convex-dev/tsconfig.json','--pretty','false']),
 ('scoped-types',['node','node_modules/typescript/bin/tsc','-p',str(qa/'tsconfig.scoped.json'),'--pretty','false']),
 ('lint',['node','node_modules/eslint/bin/eslint.js','convex-dev/governance.ts','convex-dev/runtimeWorkerAuth.ts','--report-unused-disable-directives']),
 ('tests',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str(qa/'jest.scoped.cjs'),'--runInBand','--no-cache','--json','--outputFile',str(target/'tests.json')]),
 ('diff',['git','diff','--check','--','convex-dev/governance.ts','convex-dev/runtimeWorkerAuth.ts']),
]
records=json.load(open(target/'commands.json'))
for name,argv in commands:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();tick=time.monotonic()
 hashes=[{'file':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
 run=subprocess.run(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 log=target/(name+'.log');log.write_text(run.stdout)
 records.append({'name':name,'argv':argv,'cwd':str(root),'startedAt':start,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':time.monotonic()-tick,'exitCode':run.returncode,'sourceHashes':hashes,'log':str(log)})
 (target/'commands.json').write_text(json.dumps(records,indent=2)+'\n')
 print(name,run.returncode,flush=True)
