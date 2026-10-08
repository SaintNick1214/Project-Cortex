from pathlib import Path
import json,hashlib
r=Path.cwd();q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-terminal-composition-implementation-c1';w=r/'work/resume/task04-gateway-terminal-composition-implementation-c1'
old=json.loads((q/'historical/freeze.json').read_text());paths={Path(x['path']) for x in old['official']}
paths.update(r/p for p in ['convex-dev/runtimeGateway.ts','src/domain/model-policy.ts','src/domain/profile.ts','tests/unit/runtime/gateway-terminal-composition.test.ts','convex-dev/runtimeModelPolicy.ts','convex-dev/runtimePolicySchema.ts','tests/unit/runtime/model-policy-admission.test.ts','tests/unit/runtime/gateway-dispatch.test.ts'])
paths.update(q/p for p in ['current-resolver.cjs','run-current.mjs','jest.current.json'])
f={'config':json.loads((q/'jest.current.json').read_text()),'work':str(w),'files':[{'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(paths)]};(q/'current-freeze.json').write_text(json.dumps(f,indent=2)+'\n')
