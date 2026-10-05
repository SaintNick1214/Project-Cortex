from pathlib import Path
import json,hashlib,datetime
r=Path('/workspace/Project-Cortex');base=r/'_goals/convex-backend-runtime-2026-10-02/qa';old=base/'task04-model-drift-charge-only-implementation-c1';q=base/'task04-model-drift-charge-only-c1-product-review';w=r/'work/resume/task04-model-drift-charge-only-c1-product-review'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def dump(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
manifest=json.loads((old/'manifest.json').read_text());print(type(manifest),list(manifest)[:5]);dump(q/'subject-manifest-shape.json',{'keys':list(manifest)})
for p in ['checks.py','resolver.cjs','jest.current.json','jest.native.json']:
 s=(old/p).read_text().replace('task04-model-drift-charge-only-implementation-c1','task04-model-drift-charge-only-c1-product-review');(q/p).write_text(s)
# Independent probe uses only unchanged admission fixture declarations, with reviewer outcomes.
s=(r/'tests/unit/runtime/model-policy-model-drift.test.ts').read_text();s=s[:s.index('describe("truthful first model drift')];s=s.replace('../../../',str(r)+'/').replace('"../runtimeMemory/fixture"','"'+str(r)+'/tests/unit/runtimeMemory/fixture"')
(q/'independent-probe.test.ts').write_text(s)
c=json.loads((q/'jest.native.json').read_text());c['roots']=[str(q)];c['testMatch']=[str(q/'independent-probe.test.ts')];dump(q/'jest.probe.json',c)
# Historical input catalog remains read only; only own outputs and hardpins change.
h=q/'historical';h.mkdir(exist_ok=True);(w/'historical').mkdir(exist_ok=True)
for p in ['resolver.cjs','jest.historical.json','freeze.json','run-historical.mjs']:
 (h/p).write_text((old/'historical'/p).read_text().replace('task04-model-drift-charge-only-implementation-c1','task04-model-drift-charge-only-c1-product-review'))
# Freeze config path must match exact cloned config.
f=json.loads((h/'freeze.json').read_text());f['config']=json.loads((h/'jest.historical.json').read_text());dump(h/'freeze.json',f)
s=(old/'historical/guard.mjs').read_text().replace('task04-model-drift-charge-only-implementation-c1','task04-model-drift-charge-only-c1-product-review').replace(sha(old/'historical/resolver.cjs'),sha(h/'resolver.cjs')).replace(sha(old/'historical/freeze.json'),sha(h/'freeze.json'));(h/'guard.mjs').write_text(s)
