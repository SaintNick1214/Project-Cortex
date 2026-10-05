import subprocess,sys
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');T=Path('/tmp/cortex-evidence-transport-c4-c1/clean-checkout')
T.mkdir(exist_ok=False)
subprocess.run([sys.executable,str(Q/'materialize.py'),'--target',str(T),'--materialize'],check=True)
