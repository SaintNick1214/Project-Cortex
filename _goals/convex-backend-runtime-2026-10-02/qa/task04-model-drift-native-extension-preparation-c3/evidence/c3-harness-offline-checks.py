from pathlib import Path
import subprocess,json,hashlib,datetime,time
repo=Path('/workspace/Project-Cortex');q=repo/'_goals/convex-backend-runtime-2026-10-02/qa';work=repo/'work/resume/task04-model-drift-native-preparation-c3'
for kind in ['extension','regression','extra']:
 root=q/('task04-model-drift-native-'+kind+'-preparation-c3');dest=root/'evidence';dest.mkdir(exist_ok=True)
 cmd=['node','node_modules/typescript/bin/tsc','--noEmit','--project',str(root/'fixture/convex/tsconfig.json')];start=datetime.datetime.now(datetime.timezone.utc).isoformat();begin=time.monotonic();r=subprocess.run(cmd,cwd=repo,capture_output=True,text=True,timeout=120)
 (dest/'fixture-types.stdout').write_text(r.stdout);(dest/'fixture-types.stderr').write_text(r.stderr);(dest/'fixture-types.receipt.json').write_text(json.dumps({'argv':cmd,'cwd':str(repo),'startedAt':start,'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'elapsedMs':int((time.monotonic()-begin)*1000),'native':'NOT_RUN'},indent=2)+'\n');print(kind,r.returncode,r.stdout[:1500],r.stderr[:200])
