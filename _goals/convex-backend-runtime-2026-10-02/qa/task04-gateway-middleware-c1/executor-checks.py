import pathlib,subprocess,datetime,json,hashlib,os,sys
root=pathlib.Path('/workspace/Project-Cortex'); qa=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-middleware-c1'; run=qa/sys.argv[1]; run.mkdir()
files=['convex-dev/runtimeGateway.ts','tests/unit/runtime/gateway-dispatch.test.ts','tsconfig.json','eslint.config.js',str((qa/'tsconfig.scoped.json').relative_to(root)),str((qa/'jest.scoped.mjs').relative_to(root))]
def hashes():return {f:hashlib.sha256((root/f).read_bytes()).hexdigest() for f in files}
(run/'pre.json').write_text(json.dumps(hashes(),indent=2))
for f in files[:2]: (run/pathlib.Path(f).name).write_bytes((root/f).read_bytes())
commands={
'discovery':['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str((qa/'jest.scoped.mjs').relative_to(root)),'--listTests','--runInBand'],
'unit':['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str((qa/'jest.scoped.mjs').relative_to(root)),'--runInBand','--silent'],
'scoped-types':['node','node_modules/typescript/bin/tsc','-p',str((qa/'tsconfig.scoped.json').relative_to(root)),'--noEmit'],
'root-types':['node','node_modules/typescript/bin/tsc','--noEmit'],
'owned-lint':['node','node_modules/eslint/bin/eslint.js','convex-dev/runtimeGateway.ts','tests/unit/runtime/gateway-dispatch.test.ts','--max-warnings','0']}
for name in sys.argv[2:]:
 args=commands[name]; checkpre=hashes(); start=datetime.datetime.now(datetime.timezone.utc).isoformat(); result=subprocess.run(args,cwd=root,env={'PATH':os.environ['PATH'],'TMPDIR':'/tmp','NO_COLOR':'1'},capture_output=True)
 (run/(name+'.stdout')).write_bytes(result.stdout);(run/(name+'.stderr')).write_bytes(result.stderr)
 receipt={'argv':args,'cwd':str(root),'environmentKeys':['PATH','TMPDIR','NO_COLOR'],'startedAt':start,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':result.returncode,'sourceAtStart':checkpre,'sourceAtEnd':hashes()}
 (run/(name+'.json')).write_text(json.dumps(receipt,indent=2));print(name,result.returncode);print((result.stdout+result.stderr).decode()[-16000:])
(run/'post.json').write_text(json.dumps(hashes(),indent=2))
