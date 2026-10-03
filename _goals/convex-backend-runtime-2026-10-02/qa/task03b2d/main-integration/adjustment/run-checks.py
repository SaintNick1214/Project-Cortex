import datetime, hashlib, json, pathlib, subprocess, time
root = pathlib.Path.cwd()
qa = pathlib.Path('_goals/convex-backend-runtime-2026-10-02/qa/task03b2d')
target = qa / 'main-integration/adjustment'
files = [root / p for p in ['convex-dev/admin.ts','convex-dev/governance.ts','convex-dev/graphSync.ts','convex-dev/runtimeWorkerAuth.ts','convex-dev/schema.ts','tests/unit/runtimeWorkerAuth/admin-catalog.test.ts']]
commands = [
 ('typecheck', ['node','node_modules/typescript/bin/tsc','-p',str(qa / 'tsconfig.scoped.json'),'--pretty','false']),
 ('lint', ['node','node_modules/eslint/bin/eslint.js','tests/unit/runtimeWorkerAuth/admin-catalog.test.ts','--report-unused-disable-directives']),
 ('discovery', ['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str(qa / 'jest.scoped.cjs'),'--listTests','--runInBand']),
 ('tests', ['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str(qa / 'jest.scoped.cjs'),'--runInBand','--no-cache','--json','--outputFile',str(target / 'tests.json')]),
]
records = []
for name, argv in commands:
 start = datetime.datetime.now(datetime.timezone.utc).isoformat(); tick = time.monotonic()
 hashes = [{'file':str(p.relative_to(root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
 run = subprocess.run(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 log = target / (name+'.log'); log.write_text(run.stdout)
 records.append({'name':name,'argv':argv,'cwd':str(root),'startedAt':start,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':time.monotonic()-tick,'exitCode':run.returncode,'sourceHashes':hashes,'log':str(log)})
 (target / 'commands.json').write_text(json.dumps(records,indent=2)+'\n')
 print(name,run.returncode,flush=True)
