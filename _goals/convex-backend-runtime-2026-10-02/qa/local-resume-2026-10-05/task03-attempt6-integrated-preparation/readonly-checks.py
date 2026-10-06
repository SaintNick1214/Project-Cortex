from pathlib import Path
import json,subprocess,os,hashlib,datetime
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';Q=QA/'task03-local-native-attempt6-2026-10-06';P=QA/'local-resume-2026-10-05/task03-attempt6-integrated-preparation';N='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node';rows=[]
commands=[('node-version',[N,'--version']),('npm-version',['/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/npm','--version']),('source-preflight',[N,'--input-type=module','-e',"import{sourcePreflight}from'./_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt6-2026-10-06/scripts/guard.mjs';const r=sourcePreflight();console.log(JSON.stringify({scope:'PUBLIC_SOURCE_ONLY',source:r.source.files.length,fixture:r.copies.files.length,frozen:r.frozen.files.length,privateReads:0}));"]),('crypto-syntax',[N,'--check',str(Q/'integrated/linux-private-custody-crypto-observer.mjs')]),('management-syntax',[N,'--check',str(P/'target-management.mjs')])]
for name,argv in commands:
 result=subprocess.run(argv,cwd=R,env={**os.environ,'PATH':str(Path(N).parent)+':'+os.environ.get('PATH','')},capture_output=True,timeout=30)
 for kind,raw in [('stdout',result.stdout),('stderr',result.stderr)]:
  fd=os.open(P/(name+'.'+kind),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'wb')as f:f.write(raw);f.flush();os.fsync(f.fileno())
 rows.append({'name':name,'argv':argv,'exitCode':result.returncode,'stdoutSha256':hashlib.sha256(result.stdout).hexdigest(),'stderrSha256':hashlib.sha256(result.stderr).hexdigest(),'status':'PASS'if result.returncode==0 else'FAIL','privateReads':0})
assert commands and all(row['status']=='PASS'for row in rows)
value={'scope':'READONLY_PUBLIC_SOURCE_TOOLCHAIN_AND_SYNTAX_ONLY','status':'PASS','commands':rows,'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'privateAccess':0,'effects':0}
fd=os.open(P/'readonly-command-receipts.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w')as f:json.dump(value,f,indent=2);f.write('\n')
print(json.dumps({'status':'PASS','commands':len(rows),'privateAccess':0}))
