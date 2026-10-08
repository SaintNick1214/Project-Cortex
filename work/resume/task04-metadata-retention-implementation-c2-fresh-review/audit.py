from pathlib import Path
import json,hashlib,gzip
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c2';w=r/'work/resume/task04-metadata-retention-implementation-c2';own=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c2-fresh-review'; h=lambda b:hashlib.sha256(b).hexdigest()
out={}
for base,name,expected in [(q,'qa-seal.json','67ff776a6d6e0f7c548345f0315c448b8969f4f4cfbc6ffba73918d59a69304d'),(w,'scratch-seal.json','876cc2e2c1329f945ac894e0fea7a7d5734b8153e9429e90e6f202011cfb5172')]:
 seal=json.loads((base/name).read_text());assert h((base/name).read_bytes())==expected
 actual={str(p.relative_to(base)) for p in base.rglob('*') if p.is_file() and p!=base/name};assert actual=={x['path'] for x in seal['files']}
 for pin in seal['files']:
  p=base/pin['path'];assert not p.is_symlink() and p.stat().st_nlink==1 and p.stat().st_size==pin['bytes'] and h(p.read_bytes())==pin['sha256']; assert oct(p.stat().st_mode&0o777)==pin['mode']
 out[str(base.relative_to(r))]={'rows':len(actual),'sha256':expected}
assert h((q/'report.md').read_bytes())=='8f87941157665e8555f85cb160c1a0e250bf5590eea8c4e9a493508275af5854'
v=json.loads((q/'verification.json').read_text());old=q.parent/'task04-metadata-retention-implementation-c1'
for pin in v['preservedOriginalAssertions']:assert (r/pin['candidate']).read_bytes()==(r/pin['historical']).read_bytes() and h((r/pin['candidate']).read_bytes())==pin['sha256']
assert len(v['preservedOriginalAssertions'])==47
for pin in v['unchangedModules']:assert (q/'fixture/convex'/pin['name']).read_bytes()==(old/'fixture/convex'/pin['name']).read_bytes()
a=(old/'fixture/checks/metadata.mjs').read_text();b=(q/'fixture/checks/metadata.mjs').read_text();assert a[a.index('await test('):]==b[b.index('await test('):]
for n in ['metadata-stage.mjs','metadata-purge.mjs','metadata-resource.mjs']:assert (q/'fixture/checks'/n).read_bytes()==(old/'fixture/checks'/n).read_bytes()
cap=json.loads((q/'candidate-installation.json').read_text());mods={p.name:h(p.read_bytes()) for p in (q/'fixture/convex').glob('*.ts') if p.name not in ['installed.ts','stage-pins.ts']};assert mods==cap['exactSourceModules']
closure=h(json.dumps({'domain':'metadata-retention-implementation-c2-uninstalled-source-capsule','design':cap['designSha256'],'modules':mods},sort_keys=True,separators=(',',':')).encode());assert closure==cap['installedClosureHash'];assert cap['privateKey'] is None and cap['actualProofs']==[] and cap['nativeEnabled'] is False
for p in (q/'fixture/convex').glob('*.ts'):
 expected=p.read_text()
 if p.name=='runner.ts':expected=expected.replace("import {convexGateway} from '@convex-dev/ai-sdk-provider';","import {convexGateway} from './dummy-port.mjs';").replace('const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=null;','const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=new Uint8Array(32).fill(0x44);')
 assert expected==(q/'fixture-vm/convex'/p.name).read_text()
for name,pin in v['leafPins'].items():assert h((q/'fixture/convex'/name).read_bytes())==pin
refs=0
for base in [q,own]:
 for bracket in list(base.glob('*-pre.json'))+list(base.glob('*-post.json')):
  j=json.loads(bracket.read_text())
  for name,pin in j['files'].items():
   obj=base/pin['beforeByteObject'];raw=gzip.decompress(obj.read_bytes());assert h(raw)==pin['sha256'] and len(raw)==pin['bytes'];assert h(obj.read_bytes())==pin['objectSha256'] and obj.stat().st_size==pin['objectBytes'] and obj.stat().st_nlink==1;refs+=1
 for obj in (base/'source-byte-store').glob('*.gz'):assert h(gzip.decompress(obj.read_bytes()))==obj.stem
for tag,pin in v['finalControls'].items():
 receipt=json.loads((q/(tag+'-receipt.json')).read_text());assert receipt['exit']==pin['exit'] and receipt['argv']==pin['argv']
 for suffix in ['stdout','stderr']:assert h((q/(tag+'.'+suffix)).read_bytes())==pin[suffix+'Sha256']
 for name,p in json.loads((q/(tag+'-pre.json')).read_text())['files'].items():
  if Path(name).suffix in ['.ts','.mts','.mjs']:assert h((r/name).read_bytes())==p['sha256']
oldseal=json.loads((old/'qa-seal.json').read_text());assert {str(p.relative_to(old)) for p in old.rglob('*') if p.is_file() and p!=old/'qa-seal.json'}=={x['path'] for x in oldseal['files']}
for pin in oldseal['files']:assert h((old/pin['path']).read_bytes())==pin['sha256'] and (old/pin['path']).stat().st_size==pin['bytes']
print(json.dumps({'PASS':True,'closure':closure,'assertionFiles':47,'unchangedC1Modules':len(v['unchangedModules']),'metadata16BodiesIdentical':True,'losslessReferences':refs,'C1SealRows':len(oldseal['files']),'closures':out,'sourcePins':mods,'leafPins':v['leafPins']},indent=2))
