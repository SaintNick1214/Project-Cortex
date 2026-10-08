from pathlib import Path
q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1')
s=Path('work/resume/task04-evidence-transport-c4-c1')
(q/'materialize.py').write_bytes((s/'helper-template.py').read_bytes())
