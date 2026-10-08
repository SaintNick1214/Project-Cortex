from pathlib import Path
import json,hashlib
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-charge-only-c1-product-review';stage=q/'stages/probe11';stage.mkdir(parents=True)
for name in ['independent-probe.test.ts','probe-results.json','probe-run.stdout','probe-run.stderr','probe-run-receipt.json','current-freeze.json']:
 if name=='independent-probe.test.ts':continue
 (stage/name).write_bytes((q/name).read_bytes())
f=json.loads((q/'current-freeze.json').read_text());p=q/'independent-probe.test.ts'
for row in f['files']:
 if row['path']==str(p):row['sha256']=hashlib.sha256(p.read_bytes()).hexdigest();row['bytes']=p.stat().st_size
(q/'current-freeze.json').write_text(json.dumps(f,indent=2)+'\n')
