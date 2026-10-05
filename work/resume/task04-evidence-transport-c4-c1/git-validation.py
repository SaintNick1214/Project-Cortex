import subprocess,sys
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');S=Path('work/resume/task04-evidence-transport-c4-c1');T=Path('/tmp/cortex-evidence-transport-c4-c1/clean-checkout')
for tag,script,args in [('git-mode-controls',S/'git-mode-controls.py',[]),('git-seed',S/'git-seed.py',[]),('git-mode-normalize',Q/'restore-git-modes.py',['--target',str(T)]),('git-clean-materialize',Q/'materialize.py',['--target',str(T),'--materialize']),('git-idempotence',Q/'materialize.py',['--target',str(T),'--materialize']),('git-readonly',Q/'materialize.py',['--target',str(T)])]:
 subprocess.run([sys.executable,str(S/'record.py'),tag,sys.executable,str(script),*args],check=True)
