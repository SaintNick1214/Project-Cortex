from pathlib import Path
import hashlib
q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');s=Path('work/resume/task04-evidence-transport-c4-c1');b=(s/'directory-helper-template.py').read_bytes();b=b.replace(b"NORMALIZER_SHA='UNBUILT'",("NORMALIZER_SHA="+repr(hashlib.sha256((q/'restore-git-modes.py').read_bytes()).hexdigest())).encode());(q/'restore-directory-modes.py').write_bytes(b)
