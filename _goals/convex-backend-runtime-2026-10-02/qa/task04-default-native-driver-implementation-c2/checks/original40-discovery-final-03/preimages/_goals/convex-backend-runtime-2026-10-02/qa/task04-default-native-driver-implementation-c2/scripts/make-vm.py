from pathlib import Path
import shutil,json,hashlib
D=Path('/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-implementation-c2');vm=D/'fixture-vm';vm.mkdir(exist_ok=True);(vm/'convex').mkdir(exist_ok=True)
rows=[]
for p in (D/'fixture/convex').glob('*.ts'):
 source=p.read_text();body=source
 if p.name=='runner.ts':
  assert source.count("import {convexGateway} from '@convex-dev/ai-sdk-provider';")==1
  assert source.count('const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=null;')==1
  body=source.replace("import {convexGateway} from '@convex-dev/ai-sdk-provider';","import {convexGateway} from './dummy-port.mjs';").replace('const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=null;','const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=new Uint8Array(32).fill(0x44);')
 (vm/'convex'/p.name).write_text(body);rows.append({'path':p.name,'sourceSHA256':hashlib.sha256(source.encode()).hexdigest(),'vmSHA256':hashlib.sha256(body.encode()).hexdigest(),'exactExceptPublicDUMMYConfigAndFactoryImport':True})
(vm/'package.json').write_text('{"type":"module"}\n')
(vm/'convex/dummy-port.mjs').write_text("let parts=[];export function setParts(value){parts=value;}export function convexGateway(){return {doStream:async()=>({stream:new ReadableStream({start(controller){for(const part of parts)controller.enqueue(part);controller.close();}})})};}\n")
(vm/'convex/dummy-port.d.mts').write_text("export declare const convexGateway:typeof import('@convex-dev/ai-sdk-provider').convexGateway;\n")
(vm/'source-map.json').write_text(json.dumps(rows,indent=2)+'\n')
