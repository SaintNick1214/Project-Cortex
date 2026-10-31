from pathlib import Path
import subprocess,json,datetime,hashlib
q=Path(__file__).resolve().parent;r=q.parents[3];bin=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin');node=str(bin/'node')
env={'PATH':str(bin)+':/usr/bin:/bin','TMPDIR':str(q/'tmp'),'NO_COLOR':'1','NODE_OPTIONS':'--require '+str(q/'offline-network.cjs')}
receipts=[]
def run(name,argv,expected=0,timeout=180):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=r,env=env,text=True,capture_output=True,timeout=timeout);(q/(name+'.stdout')).write_text(p.stdout);(q/(name+'.stderr')).write_text(p.stderr)
 row={'name':name,'argv':argv,'cwd':str(r),'startedAtUtc':start,'endedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':p.returncode,'expectedExitCode':expected,'status':'PASS' if p.returncode==expected else 'FAIL','stdout':name+'.stdout','stderr':name+'.stderr'};receipts.append(row);(q/'managed-offline-command-receipts.json').write_text(json.dumps({'externalRequests':0,'actualDeployments':0,'commands':receipts},indent=2)+'\n');print(json.dumps(row),flush=True)
 if p.returncode!=expected:print(p.stdout[-3000:]+p.stderr[-3000:]);raise RuntimeError(name)
run('current-sdk-build',[node,str(r/'node_modules/tsup/dist/cli-default.js'),'src/index.ts','--format','cjs,esm','--dts','--out-dir',str(q/'sdk-dist'),'--clean'])
run('managed-fixture-types',[node,str(r/'node_modules/typescript/bin/tsc'),'--project',str(q/'managed-fixture/fixture/convex/tsconfig.json'),'--noEmit'])
run('managed-native-audit',[node,'--import','tsx',str(q/'managed-native-audit.mts')])
for p in sorted((q/'scripts').glob('*.mjs')):run('syntax-'+p.stem,[node,'--check',str(p)],timeout=30)
print(json.dumps({'status':'PASS','commands':len(receipts),'externalRequests':0,'actualDeployments':0}))
