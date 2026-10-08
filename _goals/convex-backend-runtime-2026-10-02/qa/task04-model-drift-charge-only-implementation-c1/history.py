from pathlib import Path
import json,hashlib
root=Path('/workspace/Project-Cortex');base=root/'_goals/convex-backend-runtime-2026-10-02/qa';qa=base/'task04-model-drift-charge-only-implementation-c1';h=qa/'historical';old=base/'task04-gateway-terminal-composition-implementation-c1/historical';work=root/'work/resume/task04-model-drift-charge-only-implementation-c1/historical';h.mkdir(exist_ok=True);work.mkdir(exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
config=json.loads((old/'jest.historical.json').read_text());config['resolver']=str(h/'resolver.cjs');(h/'jest.historical.json').write_text(json.dumps(config,indent=2)+'\n')
freeze=json.loads((old/'freeze.json').read_text());freeze['config']=config;(h/'freeze.json').write_text(json.dumps(freeze,indent=2)+'\n')
resolver=(old/'resolver.cjs').read_text().replace(str(root/'work/resume/task04-gateway-terminal-composition-implementation-c1/historical'),str(work));(h/'resolver.cjs').write_text(resolver)
guard=(old/'guard.mjs').read_text();guard=guard.replace('export const qa="'+str(old)+'"','export const qa="'+str(h)+'";export const catalogQA="'+str(old)+'"').replace(str(root/'work/resume/task04-gateway-terminal-composition-implementation-c1/historical'),str(work))
guard=guard.replace('b90a6afc980fcd6dfeb41d977e0ba3f0865d52dc72c6f11f33b0130e2fc6ffd9',sha(h/'resolver.cjs')).replace('eab4b3bf55a6abf062c88d71298ec9cc1bf3623b4417e8b089368c2d64946a96',sha(h/'freeze.json'))
for literal in ["path.join(qa,'catalog')","path.join(qa,'official-preimages')","path.join(qa,r.catalog)","path.join(qa,r.snapshot)"]:
 guard=guard.replace(literal,literal.replace('qa,','catalogQA,'))
(h/'guard.mjs').write_text(guard)
runner=(old/'run-historical.mjs').read_text().replace("loadFreeze,qa,work","loadFreeze,qa,work,catalogQA")
for suffix in ['catalog/convex-dev/runtimeGateway.ts','catalog/src/domain/model-policy.ts','catalog/src/domain/profile.ts']:runner=runner.replace("path.join(qa,'"+suffix+"')","path.join(catalogQA,'"+suffix+"')")
(h/'run-historical.mjs').write_text(runner)
(q:=qa/'historical-adaptations.json').write_text(json.dumps(dict(scope='HISTORICAL_ONLY old source unchanged; no current qualification',inputCatalog=str(old),changes=['ownQA output/config/freeze paths; original catalog read-only','own scratch output/log paths','config resolver pointer and corresponding freeze/resolver hardpins','import assertion paths read original catalog'],originalFreezeSHA256=sha(old/'freeze.json'),originalGatewaySHA256=sha(old/'catalog/convex-dev/runtimeGateway.ts'),originalTestsSHA256=sha(root/'tests/unit/runtime/gateway-dispatch.test.ts'),newFreezeSHA256=sha(h/'freeze.json')),indent=2)+'\n')
f=json.loads((qa/'current-freeze.json').read_text());
for p in h.iterdir():
 if p.is_file():
  f['files'].append(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p)));dst=qa/'execution-source-preimages'/p.relative_to(root);dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(p.read_bytes())
(qa/'current-freeze.json').write_text(json.dumps(f,indent=2)+'\n')
print('historical cloned output-only bindings; original catalog/closure all pinned')
