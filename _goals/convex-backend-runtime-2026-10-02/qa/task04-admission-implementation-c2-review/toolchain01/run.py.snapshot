import json,hashlib,subprocess,sys,datetime,pathlib
root=pathlib.Path('/workspace/Project-Cortex');out=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-admission-implementation-c2-review';work=root/'work/resume/task04-admission-c2-review'
name=sys.argv[1];argv=sys.argv[2:];d=out/name;d.mkdir(exist_ok=False)
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
files=set(root.glob('convex-dev/**/*.ts'))|set(root.glob('src/**/*.ts'))|set(root.glob('tests/unit/**/*.ts'))|set(work.glob('*'))|{root/p for p in ['package.json','package-lock.json','tsconfig.json','tsconfig.lint.json','eslint.config.js','jest.config.mjs']}
files|={root/'node_modules/jest/bin/jest.js',root/'node_modules/typescript/bin/tsc',root/'node_modules/eslint/bin/eslint.js'}
def hashes():return [{'path':str(p.relative_to(root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(files) if p.is_file()]
pre=hashes();(d/'pre-execution.json').write_text(json.dumps({'startedUTC':utc(),'cwd':str(root),'argv':argv,'discoveredCandidates':[str(p.relative_to(root)) for p in sorted(files) if p.name.endswith('.test.ts')],'sourcesAndConfigs':pre},indent=2))
for p in work.glob('*'):
 if p.is_file():(d/(p.name+'.snapshot')).write_bytes(p.read_bytes())
r=subprocess.run(argv,cwd=root,capture_output=True);(d/'stdout.txt').write_bytes(r.stdout);(d/'stderr.txt').write_bytes(r.stderr);post=hashes();(d/'post-execution-sources.json').write_text(json.dumps(post,indent=2));result={'exitCode':r.returncode,'finishedUTC':utc(),'sourceChangedDuringExecution':[p for p in post if p not in pre]}
if (d/'jest-result.json').exists():
 j=json.loads((d/'jest-result.json').read_text());result.update({k:j[k] for k in ['numTotalTests','numPassedTests','numFailedTests','numPendingTests','numTotalTestSuites']});result['discoveredExecutedTestFiles']=[x['name'] for x in j['testResults']]
(d/'result.json').write_text(json.dumps(result,indent=2));print(name,json.dumps(result));print(r.stderr.decode()[-1500:])
