import sys,subprocess,json,datetime,hashlib
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex');OUT=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-30';WORK=ROOT/'work/resume/task04-evidence-transport-30'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
r={'argv':sys.argv,'utcPre':now(),'failures':[],'checks':[],'helperSha256':hashlib.sha256((OUT/'materialize.py').read_bytes()).hexdigest()}
for name,args in [('final-idempotence',['--materialize']),('final-readonly',[])]:
 cmd=[sys.executable,str(OUT/'materialize.py'),'--target',str(WORK/'replica'),*args];pre=now();p=subprocess.run(cmd,cwd=ROOT,capture_output=True);(OUT/(name+'.stdout')).write_bytes(p.stdout);(OUT/(name+'.stderr')).write_bytes(p.stderr);r['checks'].append({'argv':cmd,'utcPre':pre,'utcPost':now(),'exitCode':p.returncode});
 if p.returncode:r['failures'].append({'name':name,'stderr':p.stderr.decode()})
r['utcPost']=now();r['exitCode']=1 if r['failures'] else 0;(OUT/'final-verification-receipt.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));sys.exit(r['exitCode'])
