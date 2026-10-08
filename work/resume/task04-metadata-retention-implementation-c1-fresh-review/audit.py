exec(open('work/resume/task04-metadata-retention-implementation-c1-fresh-review/review.py').read().split("if sys.argv[1]=='run':")[0])
v=json.loads((B/'verification.json').read_text());out={};old=B.parent/'task04-default-native-driver-implementation-c2'
for r in v['assertionPreservation']:
 p=ROOT/r['candidate']; f=ROOT/r['frozen'];assert p.read_bytes()==f.read_bytes() and sha(p.read_bytes())==r['sha256']
out['originalAssertionFilesEqual']=len(v['assertionPreservation'])
for r in v['unchangedSource']:
 p=B/'fixture/convex'/r['name'];assert p.read_bytes()==(old/'fixture/convex'/r['name']).read_bytes() and sha(p.read_bytes())==r['sha256']
out['unchangedModules']=len(v['unchangedSource'])
cap=json.loads((B/'candidate-installation.json').read_text());mods={p.name:sha(p.read_bytes()) for p in sorted((B/'fixture/convex').glob('*.ts')) if p.name not in ['installed.ts','stage-pins.ts']};assert mods==cap['exactSourceModules']
closure=sha(json.dumps({'domain':'metadata-retention-c2-uninstalled-source-capsule','design':cap['designSha256'],'modules':mods},sort_keys=True,separators=(',',':')).encode());assert closure==cap['installedClosureHash'];out['closure']=closure
for name,h in v['leaves'].items():assert sha((B/'fixture/convex'/name).read_bytes())==h
for p in (B/'fixture/convex').glob('*.ts'):
 text=p.read_text()
 if p.name=='runner.ts':text=text.replace("import {convexGateway} from '@convex-dev/ai-sdk-provider';","import {convexGateway} from './dummy-port.mjs';").replace('const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=null;','const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=new Uint8Array(32).fill(0x44);')
 assert (B/'fixture-vm/convex'/p.name).read_text()==text
out['exactVmCorrespondence']=True
refs=0
for p in sorted(B.glob('*-pre.json'))+sorted(B.glob('*-post.json')):
 data=json.loads(p.read_text());phase='pre' if p.name.endswith('-pre.json') else 'post'
 for name,ref in data.get('files',{}).items():
  if 'beforeByteObject' in ref:
   obj=B/ref['beforeByteObject'];assert sha(obj.read_bytes())==ref['objectSha256'];raw=gzip.decompress(obj.read_bytes())
  elif phase=='pre':
   tag=p.name[:-len('-pre.json')];candidates=[B/'preimages'/tag/name,B/'preimages'/name];candidates=[x for x in candidates if x.is_file() and sha(x.read_bytes())==ref['sha256']];assert candidates,(p,name);raw=candidates[0].read_bytes()
  else:continue
  assert len(raw)==ref['bytes'] and sha(raw)==ref['sha256'];refs+=1
out['losslessCandidateCaptureReferences']=refs
for tag,pin in v['controls'].items():
 d=json.loads((B/(tag+'-receipt.json')).read_text());assert sha((B/(tag+'.stdout')).read_bytes())==pin['stdoutSha256'];assert sha((B/(tag+'.stderr')).read_bytes())==pin['stderrSha256'];assert d['exit']==pin['exit']
out['rawReceiptStreamsVerified']=len(v['controls'])
out['additionalPostVerificationReceiptsSealed']=[p.name for p in B.glob('*-receipt.json') if p.name[:-len('-receipt.json')] not in v['controls']]
out['qaSeal']=sealcheck(B,'qa-seal.json');out['scratchSeal']=sealcheck(S,'scratch-seal.json')
print(json.dumps(out))
