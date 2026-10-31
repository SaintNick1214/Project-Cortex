"""Runs each selected mocked/source check once and retains raw command outputs."""
from pathlib import Path
import datetime, json, subprocess, sys, time
sys.dont_write_bytecode=True
B=Path(__file__).resolve().parent
OUT=B/'raw'/'commands';OUT.mkdir(parents=True)
rows=[]
for script in ('inspect-source.py','guard-controls.py','focused-main-controls.py'):
    started=datetime.datetime.now(datetime.timezone.utc).isoformat();clock=time.monotonic()
    command=[sys.executable,'-B',str(B/script)]
    completed=subprocess.run(command,cwd=B,capture_output=True,timeout=190,check=False)
    (OUT/(script+'.stdout')).write_bytes(completed.stdout)
    (OUT/(script+'.stderr')).write_bytes(completed.stderr)
    row={'command':command,'cwd':str(B),'startedAtUtc':started,'elapsedSeconds':time.monotonic()-clock,'exitCode':completed.returncode,'stdout':str((OUT/(script+'.stdout')).relative_to(B)),'stderr':str((OUT/(script+'.stderr')).relative_to(B)),'status':'PASS' if completed.returncode==0 else 'FAIL','maximumSeconds':190,'invocations':1}
    rows.append(row)
    print(json.dumps(row),flush=True)
    if completed.returncode!=0:break
(B/'command-receipts.json').write_text(json.dumps({'scope':'SCOPED_SOURCE_MOCKED_CONTROLS_ONLY','checks':rows,'status':'PASS' if len(rows)==3 and all(r['exitCode']==0 for r in rows) else 'FAIL'},indent=2)+'\n')
if len(rows)!=3 or any(r['exitCode']!=0 for r in rows):raise SystemExit(1)
