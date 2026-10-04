from pathlib import Path
import subprocess,json,hashlib,os,datetime,sys
root=Path('/workspace/Project-Cortex');qa=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-terminal-composition-implementation-c1';work=root/'work/resume/task04-gateway-terminal-composition-implementation-c1'
name=sys.argv[1];args=sys.argv[2:];folder=qa/'evidence'/name;folder.mkdir(parents=True,exist_ok=False)
files=[root/'convex-dev/runtimeGateway.ts',root/'tests/unit/runtime/gateway-terminal-composition.test.ts',root/'convex-dev/runtimeModelPolicy.ts',root/'convex-dev/runtimePolicySchema.ts',root/'tests/unit/runtime/model-policy-admission.test.ts',root/'tests/unit/runtime/gateway-dispatch.test.ts']+list(qa.glob('*.json'))+[qa/'current-resolver.cjs']
hashes=lambda:{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
if name.startswith('historical'):
 f=json.loads((qa/'historical/freeze.json').read_text());files.extend(qa/'historical'/x['catalog'] for x in f['local']);files.extend(qa/'historical'/x for x in ['guard.mjs','resolver.cjs','run-historical.mjs','freeze.json','jest.historical.json'])
files=list(dict.fromkeys(files))
pre=hashes();before=folder/'preimages';before.mkdir()
for p in files: target=before/p.relative_to(root);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(p.read_bytes())
env=os.environ.copy();env['PATH']=str(root/'work/resume/toolchain-bin')+':'+env['PATH'];env['NODE_USE_ENV_PROXY']='1'
start=datetime.datetime.now(datetime.timezone.utc).isoformat();r=subprocess.run(args,cwd=root,env=env,capture_output=True,text=True);end=datetime.datetime.now(datetime.timezone.utc).isoformat()
(folder/'stdout.txt').write_text(r.stdout);(folder/'stderr.txt').write_text(r.stderr)
(folder/'receipt.json').write_text(json.dumps({'argv':args,'cwd':str(root),'startUTC':start,'endUTC':end,'exitCode':r.returncode,'environmentPolicy':{'PATH':env['PATH'],'NODE_USE_ENV_PROXY':'1','CA/proxy':'preserved ambient; no env file loader/services/private keys'},'pre':pre,'post':hashes()},indent=2)+'\n');print(r.stdout[-6000:]);print(r.stderr[-6000:]);sys.exit(r.returncode)
