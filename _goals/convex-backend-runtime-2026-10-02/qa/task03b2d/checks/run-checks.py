import datetime, hashlib, json, pathlib, subprocess, time
root = pathlib.Path.cwd()
qa = root / '_goals/convex-backend-runtime-2026-10-02/qa/task03b2d'
files = [root / p for p in ['convex-dev/admin.ts','convex-dev/governance.ts','convex-dev/graphSync.ts','convex-dev/runtimeWorkerAuth.ts','convex-dev/schema.ts']]
files += sorted((root / 'tests/unit/runtimeWorkerAuth').glob('*.ts'))
commands = [
 ('typecheck', ['node','node_modules/typescript/bin/tsc','-p',str(qa.relative_to(root) / 'tsconfig.scoped.json'),'--pretty','false']),
 ('lint', ['node','node_modules/eslint/bin/eslint.js','convex-dev/admin.ts','convex-dev/governance.ts','convex-dev/graphSync.ts','convex-dev/runtimeWorkerAuth.ts','convex-dev/schema.ts','tests/unit/runtimeWorkerAuth','--report-unused-disable-directives']),
 ('discovery', ['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str(qa.relative_to(root) / 'jest.scoped.cjs'),'--listTests','--runInBand']),
 ('tests', ['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str(qa.relative_to(root) / 'jest.scoped.cjs'),'--runInBand','--json','--outputFile',str(qa.relative_to(root) / 'checks/tests-final.json')]),
 ('catalog', ['node',str(qa.relative_to(root) / 'inventory.mjs'),str(qa.relative_to(root) / 'catalog')]),
 ('root-types-tests-diagnostics', ['node','node_modules/typescript/bin/tsc','--noEmit','--pretty','false']),
 ('root-diagnostics', ['node','node_modules/typescript/bin/tsc','--project','tsconfig.lint.json','--noEmit','--pretty','false']),
]
records = []
for name, argv in commands:
 start = datetime.datetime.now(datetime.timezone.utc).isoformat(); tick = time.monotonic()
 hashes = [{'file':str(p.relative_to(root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
 run = subprocess.run(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 log = qa / ('checks/'+name+'-final.log'); log.write_text(run.stdout)
 records.append({'name':name,'argv':argv,'cwd':str(root),'startedAt':start,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':time.monotonic()-tick,'exitCode':run.returncode,'sourceHashes':hashes,'log':str(log.relative_to(root))})
 (qa / 'checks/commands.json').write_text(json.dumps(records,indent=2)+'\n')
 print(name,run.returncode,flush=True)
