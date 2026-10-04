from pathlib import Path
import hashlib,json,datetime
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-implementation-c2'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
subjects=[(Q/'design-clarification-c2','387dd064242a6d339a964730f2f75a84948f1e98ccf73220b6af2c122e01e935'),(Q/'design-clarification-c3','9e6e7d9061f4d0220479dafd8ff63793ecc75cff4e093a0e70344992a226d10e'),(R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-driver-c2-staging-money-clarification-review','5f736974b9d7077371f97207f49ea8d1dff27483c2afb1bfb369b9398931d024'),(R/'work/resume/task04-driver-c2-staging-money-clarification-review','de2d0617bd6df012abce02d52a2fe61199e37eb09b96272452e13d98e236b7f0'),(R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-staging-design-c3-fresh-review','6ada98ecfcf9143cce68e690e0274e8f38ff662824da280c52bda213c65edba0'),(R/'work/resume/task04-staging-design-c3-fresh-review','f308388e980e7e994d1e785c9c6f4bf7992964ab4cb76a4f7dc1291832bf0f7e')]
closures=[]
for root,expectedHash in subjects:
 m=root/'manifest.json';value=json.loads(m.read_text());rows=value.get('rows',value.get('files'));expected={row['path']:(row['bytes'],row['sha256']) for row in rows};actual={str(p.relative_to(root)):(p.stat().st_size,digest(p)) for p in root.rglob('*') if p.is_file() and p!=m};assert expected==actual,str(root)
 # Exact immutable actual manifest pin recorded; previous parent message values are cross checked for accepted subject/review.
 assert digest(m)==expectedHash,(str(root),digest(m),expectedHash)
 closures.append({'path':str(root.relative_to(R)),'manifestSHA256':digest(m),'files':len(actual),'exactRecursiveClosure':True,'excludesOnly':'manifest.json'})
vm=[]
for original in (Q/'fixture/convex').glob('*.ts'):
 target=Q/'fixture-vm/convex'/original.name;raw=original.read_text();changed=raw
 if original.name=='runner.ts':changed=raw.replace("from '@convex-dev/ai-sdk-provider'","from './dummy-port.mjs'").replace('const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=null;','const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=new Uint8Array(32).fill(0x44);')
 assert target.read_text()==changed,original.name
 vm.append({'path':original.name,'sourceSHA256':digest(original),'vmSHA256':digest(target),'exactExceptTwoFixedRunnerConfigReplacements':True})
runner=Q/'fixture/convex/runner.ts';pins=(Q/'fixture/convex/stage-pins.ts').read_text();assert digest(runner) in pins
assert 'const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=null;' in runner.read_text()
source=runner.read_text();a=source.index('const finalAdmissionAt=Date.now();');b=source.index('const stagePending=life.track(firstRpc);',a);finalBlock=source[a:b];assert 'await ' not in finalBlock and 'submitted=true;\n  const firstRpc=ctx.runMutation(REFERENCES.stage,stageArgs);' in finalBlock
independent=json.loads((Q/'test-discovery.json').read_text())['originalIndependentControlBytesUnchanged'];assert all(digest(Q/row['path'])==row['sha256'] for row in independent)
value={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'historicalClosures':closures,'vmExactSourceMap':vm,'originalIndependentControlBytesUnchanged':True,'issuerAndVerifierSourceSHA256':digest(runner),'fixedNoAsyncFinalBlock':finalBlock,'actualPrivateKey':'UNINSTALLED_NULL','actualCryptoRuntimeQualification':'NOT_RUN_NODE_ONLY','actualPositiveMoneyPipeline':'BLOCKED_EMPTY_DOMAIN'}
(Q/'final-source-verification.json').write_text(json.dumps(value,indent=2)+'\n');print(json.dumps(value))
