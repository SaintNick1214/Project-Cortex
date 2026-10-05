import subprocess,sys
from pathlib import Path
R=Path.cwd();Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1';S=R/'work/resume/task04-evidence-transport-c4-c1';T=Path('/tmp/cortex-evidence-transport-c4-c1/clean-checkout')
for tag,args in [('idempotence',['--target',str(T),'--materialize']),('readonly',['--target',str(T)]),('source-after',['--target',str(R)])]:
 subprocess.run([sys.executable,str(S/'record.py'),tag,sys.executable,str(Q/'materialize.py'),*args],check=True)
