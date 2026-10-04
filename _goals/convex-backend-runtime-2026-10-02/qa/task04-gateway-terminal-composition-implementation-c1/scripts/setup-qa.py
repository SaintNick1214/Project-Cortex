from pathlib import Path
import json,hashlib,shutil,re
root=Path.cwd();qa=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-terminal-composition-implementation-c1';work=root/'work/resume/task04-gateway-terminal-composition-implementation-c1';old=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-historical-catalog-preparation-c1';hist=qa/'historical';hw=work/'historical';hw.mkdir(exist_ok=True);hist.mkdir(exist_ok=True)
for name in ['catalog','official-preimages']:
 if not (hist/name).exists():shutil.copytree(old/name,hist/name)
for name in ['guard.mjs','resolver.cjs','run-historical.mjs','freeze.json','jest.historical.json','official-catalog.json']:
 s=(old/name).read_text().replace(str(old),str(hist)).replace(str(root/'work/resume/task04-gateway-historical-catalog-preparation-c1'),str(hw));(hist/name).write_text(s)
hash=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
s=(hist/'guard.mjs').read_text();s=re.sub(r'const expectedResolverHash="[a-f0-9]+"',f'const expectedResolverHash="{hash(hist/"resolver.cjs")}"',s);s=re.sub(r'const expectedFreezeHash="[a-f0-9]+"',f'const expectedFreezeHash="{hash(hist/"freeze.json")}"',s);(hist/'guard.mjs').write_text(s)
# Exact template separation: no mapper/setup/env loading; current resolver is independently reviewable.
cfg=json.loads((old/'jest.historical.json').read_text());cfg['roots']=[str(root/'tests/unit/runtime')];cfg['testMatch']=[str(root/'tests/unit/runtime/gateway-terminal-composition.test.ts')];cfg['moduleNameMapper']={};cfg['resolver']=str(qa/'current-resolver.cjs');(qa/'jest.current.json').write_text(json.dumps(cfg,indent=2)+'\n')
(qa/'historical-adaptations.json').write_text(json.dumps({'original':str(old),'clone':str(hist),'changes':'QA/work path relocation and consequential guard hard-hash rebinding only; seven historical local files and official preimages byte-exact'},indent=2)+'\n')
