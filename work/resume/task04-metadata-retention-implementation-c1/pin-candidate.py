from pathlib import Path
import json,hashlib,re,shutil
q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c1');b=q/'fixture/convex'
h=lambda x:hashlib.sha256(x).hexdigest()
modules={p.name:h(p.read_bytes()) for p in sorted(b.glob('*.ts')) if p.name not in ['installed.ts','stage-pins.ts']}
design='155af8a352dc1d19da2910200cba97496ce1115b53c4f3af2b2dc981c32e7f09'
closure=h(json.dumps({'domain':'metadata-retention-c2-uninstalled-source-capsule','design':design,'modules':modules},sort_keys=True,separators=(',',':')).encode())
keyId=h(('metadata-retention-c2-UNINSTALLED-distinct-key-id:'+closure).encode())
manifest=h(('metadata-retention-c2-UNINSTALLED-manifest:'+closure+keyId).encode())
src=h(('metadata-retention-c2-UNINSTALLED-source:'+closure).encode())
p=b/'installed.ts';s=p.read_text()
s=re.sub(r'("manifestHash"\s*:\s*")[a-f0-9]{64}',lambda m:m[1]+manifest,s)
s=re.sub(r'("installedClosureHash"\s*:\s*")[a-f0-9]{64}',lambda m:m[1]+closure,s)
s=re.sub(r'("loadedClosureHash"\s*:\s*")[a-f0-9]{64}',lambda m:m[1]+closure,s)
s=re.sub(r'("sourceHash"\s*:\s*")[a-f0-9]{64}',lambda m:m[1]+src,s)
s=s.replace('fixed-uninstalled-owner-run-v2','metadata-c2-uninstalled-owner-run-v2')
p.write_text(s)
(b/'stage-pins.ts').write_text("// UNINSTALLED NEW metadata C2 candidate. No actual private key.\nexport const STAGE_KEY_ID='"+keyId+"';\nexport const STAGE_ISSUER_SOURCE_HASH='"+modules['runner.ts']+"';\nexport const STAGE_VERIFIER_SOURCE_HASH=STAGE_ISSUER_SOURCE_HASH;\n")
(q/'candidate-installation.json').write_text(json.dumps({'status':'UNINSTALLED_SYNTHETIC_OFFLINE_CAPSULE','nativeEnabled':False,'privateKey':None,'actualProofs':[],'designSha256':design,'manifestHash':manifest,'installedClosureHash':closure,'sourceHash':src,'distinctKeyId':keyId,'issuerVerifierHash':modules['runner.ts'],'exactSourceModules':modules,'selfReferences':'installed.ts and stage-pins.ts are external capsule leaves; exact leaf pins recorded in final source manifest, excluded from generating their own hash'},indent=2)+'\n')
vm=q/'fixture-vm';(vm/'convex').mkdir(parents=True,exist_ok=True)
for p in b.glob('*.ts'):shutil.copy2(p,vm/'convex'/p.name)
for name in ['dummy-port.mjs','dummy-port.d.mts']:
 source=Path('work/resume/task04-metadata-retention-implementation-c1/dummy-port.mjs') if name=='dummy-port.mjs' else Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-implementation-c2/fixture-vm/convex')/name
 shutil.copy2(source,vm/'convex'/name)
shutil.copy2(q/'fixture/package.json',vm/'package.json')
p=vm/'convex/runner.ts';s=p.read_text()
assert "import {convexGateway} from '@convex-dev/ai-sdk-provider';" in s
s=s.replace("import {convexGateway} from '@convex-dev/ai-sdk-provider';","import {convexGateway} from './dummy-port.mjs';")
assert 'const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=null;' in s
s=s.replace('const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=null;','const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=new Uint8Array(32).fill(0x44);')
p.write_text(s)
(q/'fixture-vm/source-map.json').write_text(json.dumps({'runnerReplacements':['fixed public DUMMY factory import','fixed public DUMMY32byte key only'],'actualKeyRemainsNull':True,'sourceModules':modules},indent=2)+'\n')
print(json.dumps({'closure':closure,'manifest':manifest,'keyId':keyId,'runnerHash':modules['runner.ts']}))
