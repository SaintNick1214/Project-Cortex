from pathlib import Path
import hashlib,re,json
q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-terminal-composition-implementation-c1');h=q/'historical';p=q/'evidence/historical-run01/failed-runner-preimages';p.mkdir();
for name in ['guard.mjs','resolver.cjs','freeze.json','run-historical.mjs','jest.historical.json']:(p/name).write_bytes((h/name).read_bytes())
hash=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
s=(h/'resolver.cjs').read_text();s=s.replace('7412c8fbaec1de5036b0e683d90145b29c77c97b9c3d3ba5453bcc28f546d95a',hash(h/'freeze.json'));(h/'resolver.cjs').write_text(s)
s=(h/'guard.mjs').read_text();s=re.sub(r'const expectedResolverHash="[a-f0-9]+"',f'const expectedResolverHash="{hash(h/"resolver.cjs")}"',s);(h/'guard.mjs').write_text(s)
(q/'historical-adaptations.json').write_text(json.dumps({'original':'qa/task04-gateway-historical-catalog-preparation-c1','clone':'historical/','changes':'QA/work path relocation; freeze hard pins in BOTH guard/resolver consequently rebound; guard resolver hard pin rebound. No source/test/dependency/behavior/assertion changes.','firstFailure':'historical list/run01 resolver freeze pin not rebound; retained exit1 before test discovery'},indent=2)+'\n')
p=Path('work/resume/task04-gateway-terminal-composition-implementation-c1/record.py');s=p.read_text();s=s.replace('pre=hashes();before=', '''if name.startswith('historical'):
 f=json.loads((qa/'historical/freeze.json').read_text());files.extend(qa/'historical'/x['catalog'] for x in f['local']);files.extend(qa/'historical'/x for x in ['guard.mjs','resolver.cjs','run-historical.mjs','freeze.json','jest.historical.json'])
files=list(dict.fromkeys(files))
pre=hashes();before=''');p.write_text(s)
