from pathlib import Path
import hashlib,json,gzip,difflib
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c2';old=q.parent/'task04-metadata-retention-implementation-c1';w=r/'work/resume/task04-metadata-retention-implementation-c2'
h=lambda b:hashlib.sha256(b).hexdigest()
v=json.loads((old/'verification.json').read_text());out={'scope':'OFFLINE C2; no actual qualification','preservedOriginalAssertions':[],'unchangedModules':[],'changes':[],'captureReferences':0,'sourceObjects':0}
for row in v['assertionPreservation']:
 a=r/row['candidate'];b=q/a.relative_to(old);assert a.read_bytes()==b.read_bytes() and h(a.read_bytes())==row['sha256']
 out['preservedOriginalAssertions'].append({'candidate':str(b.relative_to(r)),'historical':row['candidate'],'sha256':row['sha256']})
for p in sorted((q/'fixture/convex').glob('*.ts')):
 a=old/'fixture/convex'/p.name
 if a.exists() and p.read_bytes()==a.read_bytes():out['unchangedModules'].append({'name':p.name,'sha256':h(p.read_bytes())})
 else:
  out['changes'].append({'name':p.name,'sha256':h(p.read_bytes()),'historicalSha256':h(a.read_bytes()) if a.exists() else None})
  if a.exists():(q/('change-'+p.name+'.diff')).write_text(''.join(difflib.unified_diff(a.read_text().splitlines(True),p.read_text().splitlines(True),fromfile=str(a.relative_to(r)),tofile=str(p.relative_to(r)))))
assert len(out['preservedOriginalAssertions'])==47
assert {x['name'] for x in v['unchangedSource']} <= {x['name'] for x in out['unchangedModules']}
assert len(v['unchangedSource'])==12
for name in ['metadata-stage.mjs','metadata-purge.mjs','metadata-resource.mjs']:assert (q/'fixture/checks'/name).read_bytes()==(old/'fixture/checks'/name).read_bytes()
a=(old/'fixture/checks/metadata.mjs').read_text();b=(q/'fixture/checks/metadata.mjs').read_text();assert a[a.index("await test("):]==b[b.index("await test("):]
(q/'metadata-plumbing.diff').write_text(''.join(difflib.unified_diff(a.splitlines(True),b.splitlines(True),fromfile=str(old/'fixture/checks/metadata.mjs'),tofile=str(q/'fixture/checks/metadata.mjs'))))
assert (w/'construction-historical.mjs').read_text()==(r/'work/resume/task04-metadata-retention-implementation-c1-fresh-review/construction.mjs').read_text().replace('task04-metadata-retention-implementation-c1/','task04-metadata-retention-implementation-c2/')
out['metadata16AssertionBodyEqual']=True;out['otherNewC1ControlsFullBytesEqual']=True;out['historicalConstructionOnlyImportPathChanged']=True
cap=json.loads((q/'candidate-installation.json').read_text());mods={p.name:h(p.read_bytes()) for p in sorted((q/'fixture/convex').glob('*.ts')) if p.name not in ['installed.ts','stage-pins.ts']}
assert mods==cap['exactSourceModules']
closure=h(json.dumps({'domain':'metadata-retention-implementation-c2-uninstalled-source-capsule','design':cap['designSha256'],'modules':mods},sort_keys=True,separators=(',',':')).encode())
assert closure==cap['installedClosureHash']
assert cap['nativeEnabled'] is False and cap['privateKey'] is None and cap['actualProofs']==[]
assert 'const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=null;' in (q/'fixture/convex/runner.ts').read_text()
assert 'ACTUAL_PROOFS:readonly Data[]=Object.freeze([]);' in (q/'fixture/convex/proofs.ts').read_text()
assert 'NATIVE_INSTALLATION_ENABLED=false;' in (q/'fixture/convex/installed.ts').read_text()
for p in (q/'fixture/convex').glob('*.ts'):
 expected=p.read_text()
 if p.name=='runner.ts':expected=expected.replace("import {convexGateway} from '@convex-dev/ai-sdk-provider';","import {convexGateway} from './dummy-port.mjs';").replace('const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=null;','const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=new Uint8Array(32).fill(0x44);')
 assert (q/'fixture-vm/convex'/p.name).read_text()==expected,p
out['capsule']=cap;out['leafPins']={n:h((q/'fixture/convex'/n).read_bytes()) for n in ['installed.ts','stage-pins.ts']}
for p in sorted(q.glob('*-pre.json'))+sorted(q.glob('*-post.json')):
 j=json.loads(p.read_text())
 for name,pin in j['files'].items():
  obj=q/pin['beforeByteObject'];raw=gzip.decompress(obj.read_bytes());assert len(raw)==pin['bytes'] and h(raw)==pin['sha256']
  assert len(obj.read_bytes())==pin['objectBytes'] and h(obj.read_bytes())==pin['objectSha256'];assert obj.stat().st_nlink==1
  out['captureReferences']+=1
for p in (q/'source-byte-store').glob('*.gz'):
 assert h(gzip.decompress(p.read_bytes()))==p.stem and p.stat().st_nlink==1
 out['sourceObjects']+=1
out['encodedSourceBytes']=sum(p.stat().st_size for p in (q/'source-byte-store').glob('*.gz'))
seal=json.loads((old/'qa-seal.json').read_text());assert {str(p.relative_to(old)) for p in old.rglob('*') if p.is_file() and p.name!='qa-seal.json'}=={x['path'] for x in seal['files']}
for pin in seal['files']:
 p=old/pin['path'];assert h(p.read_bytes())==pin['sha256'] and p.stat().st_size==pin['bytes']
out['historicalC1FullSealUnchanged']={'rows':len(seal['files']),'sha256':h((old/'qa-seal.json').read_bytes())}
for base in [q,w]:
 for p in base.rglob('*'):
  assert not p.is_symlink()
  if p.is_file():assert p.stat().st_nlink==1
out['allOwnRegularFilesNlink1']=True
# Final controls must be bracketed against final executable source, not superseded runs.
out['finalControls']={}
for p in sorted(q.glob('final-*-receipt.json')):
 tag=p.name[:-len('-receipt.json')];j=json.loads(p.read_text());pre=json.loads((q/(tag+'-pre.json')).read_text())
 for name,pin in pre['files'].items():
  file=r/name
  if file.suffix in ['.ts','.mts','.mjs'] and file.exists():assert h(file.read_bytes())==pin['sha256'],(tag,name)
 out['finalControls'][tag]={'exit':j['exit'],'argv':j['argv'],'stdoutSha256':h((q/(tag+'.stdout')).read_bytes()),'stderrSha256':h((q/(tag+'.stderr')).read_bytes())}
(q/'verification.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'pass':True,'assertionFiles':47,'unchangedDefaultModules':12,'unchangedC1Modules':len(out['unchangedModules']),'metadata16BodiesEqual':True,'sourceObjects':out['sourceObjects'],'encodedBytes':out['encodedSourceBytes'],'beforeReferences':out['captureReferences'],'finalControls':len(out['finalControls']),'oldC1FullSealUnchanged':True,'closure':closure}))
