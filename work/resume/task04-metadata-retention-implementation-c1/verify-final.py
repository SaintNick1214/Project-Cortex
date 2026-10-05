from pathlib import Path
import json,hashlib,gzip,re
r=Path('/workspace/Project-Cortex'); q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c1'; old=q.parent/'task04-default-native-driver-implementation-c2';w=r/'work/resume/task04-metadata-retention-implementation-c1'
h=lambda b:hashlib.sha256(b).hexdigest()
out={'scope':'isolated offline candidate, no actual qualification','assertionPreservation':[],'unchangedSource':[],'changedSource':[],'sourceObjects':0,'sourceCaptureReferences':0}
for p in sorted((q/'fixture/checks').glob('*.mjs')):
 a=old/'fixture/checks'/p.name
 if a.exists():
  assert p.read_bytes()==a.read_bytes(),p
  out['assertionPreservation'].append({'candidate':str(p.relative_to(r)),'frozen':str(a.relative_to(r)),'sha256':h(p.read_bytes())})
for p in sorted((q/'regression').rglob('*')):
 if p.is_file() and p.suffix in ['.mjs','.ts','.json']:
  a=old/p.relative_to(q)
  if a.exists():
   assert p.read_bytes()==a.read_bytes(),p
   out['assertionPreservation'].append({'candidate':str(p.relative_to(r)),'frozen':str(a.relative_to(r)),'sha256':h(p.read_bytes())})
for p in sorted((q/'fixture/convex').glob('*.ts')):
 a=old/'fixture/convex'/p.name
 row={'name':p.name,'sha256':h(p.read_bytes()),'bytes':p.stat().st_size}
 if a.exists() and p.read_bytes()==a.read_bytes():out['unchangedSource'].append(row)
 else:out['changedSource'].append(row)
for name in ['canonical.ts','cases.ts','contracts.ts','convex.config.ts','guard.ts','lifecycle.ts','managed.ts','repository-codec.ts','requests.ts','schema.ts','store.ts','validate.ts']:assert name in [x['name'] for x in out['unchangedSource']]
mods={p.name:h(p.read_bytes()) for p in sorted((q/'fixture/convex').glob('*.ts')) if p.name not in ['installed.ts','stage-pins.ts']}
cap=json.loads((q/'candidate-installation.json').read_text());assert cap['exactSourceModules']==mods
closure=h(json.dumps({'domain':'metadata-retention-c2-uninstalled-source-capsule','design':cap['designSha256'],'modules':mods},sort_keys=True,separators=(',',':')).encode())
assert closure==cap['installedClosureHash']
assert cap['nativeEnabled'] is False and cap['privateKey'] is None and cap['actualProofs']==[]
runner=(q/'fixture/convex/runner.ts').read_text();assert 'const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=null;' in runner
assert 'NATIVE_INSTALLATION_ENABLED=false' in (q/'fixture/convex/installed.ts').read_text().replace(' ','')
proof=(q/'fixture/convex/proofs.ts').read_text();assert 'ACTUAL_PROOFS:readonly Data[]=Object.freeze([]);' in proof
for p in sorted((q/'fixture/convex').glob('*.ts')):
 v=q/'fixture-vm/convex'/p.name
 expect=p.read_text()
 if p.name=='runner.ts':
  expect=expect.replace("import {convexGateway} from '@convex-dev/ai-sdk-provider';","import {convexGateway} from './dummy-port.mjs';").replace('const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=null;','const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=new Uint8Array(32).fill(0x44);')
 assert v.read_text()==expect,v
out['capsule']=cap;out['leaves']={name:h((q/'fixture/convex'/name).read_bytes()) for name in ['installed.ts','stage-pins.ts']}
for p in sorted((q/'source-byte-store').glob('*.gz')):
 assert not p.is_symlink() and p.stat().st_nlink==1,p
 raw=gzip.decompress(p.read_bytes());assert h(raw)==p.stem,p
 out['sourceObjects']+=1
out['encodedStoreBytes']=sum(p.stat().st_size for p in (q/'source-byte-store').glob('*.gz'))
# Per-command before/post evidence retains exact content for every recorded reference.
for p in sorted(q.glob('*-pre.json'))+sorted(q.glob('*-post.json')):
 data=json.loads(p.read_text());phase='pre' if p.name.endswith('-pre.json') else 'post'
 for name,ref in data.get('files',{}).items():
  if 'beforeByteObject' in ref:
   obj=q/ref['beforeByteObject'];raw=gzip.decompress(obj.read_bytes());assert h(obj.read_bytes())==ref['objectSha256']
  elif phase=='pre':
   tag=p.name[:-len('-pre.json')]
   candidates=[q/'preimages'/tag/name,q/'preimages'/name]
   candidates=[x for x in candidates if x.is_file() and h(x.read_bytes())==ref['sha256']]
   assert candidates,(p,name)
   raw=candidates[0].read_bytes()
  else:continue
  assert len(raw)==ref['bytes'] and h(raw)==ref['sha256'],(p,name)
  out['sourceCaptureReferences']+=1
out['archiveRestoration']=json.loads((q/'archive-restoration.json').read_text())
for base in [q,w]:
 for p in base.rglob('*'):
  assert not p.is_symlink(),p
  if p.is_file():assert p.stat().st_nlink==1,p
out['allOwnRegularFilesNlink1']=True
out['controls']={}
for p in sorted(q.glob('*-receipt.json')):
 data=json.loads(p.read_text());out['controls'][p.name[:-len('-receipt.json')]]={'exit':data['exit'],'argv':data['argv'],'stdoutSha256':h((q/(p.name[:-len('-receipt.json')]+'.stdout')).read_bytes()),'stderrSha256':h((q/(p.name[:-len('-receipt.json')]+'.stderr')).read_bytes())}
(q/'verification.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'pass':True,'preservedAssertionFiles':len(out['assertionPreservation']),'unchangedModules':len(out['unchangedSource']),'changedModules':[x['name'] for x in out['changedSource']],'sourceObjects':out['sourceObjects'],'encodedStoreBytes':out['encodedStoreBytes'],'sourceCaptureReferences':out['sourceCaptureReferences'],'allOwnRegularFilesNlink1':True,'closure':closure}))
