from pathlib import Path
import subprocess,json,hashlib,datetime,shutil,sys
root=Path('/workspace/Project-Cortex');qa=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-historical-catalog-preparation-c1';work=root/'work/resume/task04-gateway-historical-catalog-preparation-c1'
(work/'tmp').mkdir(exist_ok=True)
env={'PATH':'/workspace/Project-Cortex/work/resume/toolchain-bin:/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin','TMPDIR':str(work/'tmp'),'NO_COLOR':'1'}
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def fp(p):
 b=p.read_bytes();return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
freeze=json.loads((qa/'freeze.json').read_text())
paths=[qa/'freeze.json',qa/'local-catalog.json',qa/'official-catalog.json',qa/'expected-config.json',qa/'jest.historical.json',qa/'guard.mjs',qa/'resolver.cjs',qa/'run-historical.mjs',qa/'tamper-controls.mjs',qa/'current-guard-template.json',work/'record-run.py',work/'build-official.mjs',work/'create-runner.py']
paths += [qa/r['catalog'] for r in freeze['local']]+[root/r['original'] for r in freeze['local']]+[Path(r['path']) for r in freeze['official']]
paths=list(dict.fromkeys(paths))
for p in paths[:13]:
 dest=qa/'runner-preimages'/p.relative_to(root);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
def fingerprints():return {str(p):fp(p) for p in paths}
commands=[('node-version',['node','--version']),('npm-version',['npm','--version']),('discovery',['node',str(qa/'run-historical.mjs'),'--list']),('historical78',['node',str(qa/'run-historical.mjs'),'--run']),('tamper-controls',['node',str(qa/'tamper-controls.mjs')])]
labelSuffix=sys.argv[1] if len(sys.argv)>1 else '01'
for label,argv in commands:
 dest=qa/'evidence'/(label+labelSuffix);dest.mkdir(parents=True,exist_ok=False);pre=fingerprints();started=now()
 (dest/'pre-execution.json').write_text(json.dumps({'argv':argv,'cwd':str(root),'startedUTC':started,'environment':env,'sourceConfigPreimages':pre},indent=2)+'\n')
 proc=subprocess.run(argv,cwd=root,env=env,capture_output=True,timeout=60)
 (dest/'stdout.txt').write_bytes(proc.stdout);(dest/'stderr.txt').write_bytes(proc.stderr);post=fingerprints()
 receipt={'argv':argv,'cwd':str(root),'startedUTC':started,'endedUTC':now(),'exitCode':proc.returncode,'allSourcesConfigsStable':pre==post,'sourceConfigPostimages':post}
 (dest/'result.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps({'label':label+labelSuffix,'exitCode':proc.returncode,'sourcesStable':pre==post}),flush=True)
 if (work/'imports.ndjson').exists():shutil.copyfile(work/'imports.ndjson',dest/'imports.ndjson')
 if proc.returncode or pre!=post:sys.exit(1)
assert (qa/'evidence'/('node-version'+labelSuffix)/'stdout.txt').read_text().strip()=='v24.19.0'
assert (qa/'evidence'/('npm-version'+labelSuffix)/'stdout.txt').read_text().strip()=='12.2.0'
