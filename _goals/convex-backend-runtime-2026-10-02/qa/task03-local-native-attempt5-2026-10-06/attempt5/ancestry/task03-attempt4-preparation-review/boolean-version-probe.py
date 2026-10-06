"""Public dummy only: retain exact version:true frame and successful forbidden acquisition."""
import importlib.util, json, tempfile, os, struct, hashlib
from pathlib import Path
O=Path(__file__).resolve().parent
Q=O.parent.parent/'task03-local-native-attempt4-2026-10-06'
s=importlib.util.spec_from_file_location('public_control_fixture',Q/'attempt4/source-controls.py')
M=importlib.util.module_from_spec(s);s.loader.exec_module(M)
def durable(name,raw):
 with (O/name).open('xb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
with tempfile.TemporaryDirectory(prefix='version-type-confirmation-',dir=O/'dummy-tmp') as raw:
 base=Path(raw);_,stage,root,receipts,dest=M.fixture(base);producer=M.A.HeldProducer(stage,M.B)
 try:
  good=b''.join(producer.frames());bad=M.header_change(good,lambda h:h.update(version=True))
  durable('numeric-version-original-public-frame.bin',good)
  durable('boolean-version-rejected-contract-public-frame.bin',bad)
  header=json.loads(bad[12:12+struct.unpack('!I',bad[8:12])[0]])
  assert type(header['version']) is bool and header['version'] is True
  stream=base/'public-frame';stream.write_bytes(bad)
  with stream.open('rb') as f:out=M.A.receive_and_copy(root,'source-00000000-0000-0000-0000-000000000009',dest,M.B,receipts,f.fileno())
  producer.verify()
  assert out['status']=='PASS' and out['copiedFiles']==3
  for receipt in receipts.iterdir():durable('boolean-version-native-acquisition-receipt.json',receipt.read_bytes())
  durable('boolean-version-native-copy-receipt.json',(dest/'private-receive-custody.json').read_bytes())
  result={'scope':'PUBLIC_DUMMY_PROTOCOL_VERSION_TYPE_CONTROL','expectedReceiveSuccess':False,'observedReceiveSuccess':True,'headerVersion':True,'headerVersionJsonType':'boolean','copiedFiles':out['copiedFiles'],'payloadSha256':hashlib.sha256(bad).hexdigest(),'credentialReads':0,'services':0,'DockerCalls':0}
 finally:producer.close()
durable('boolean-version-confirmation.json',(json.dumps(result,indent=2)+'\n').encode())
print(json.dumps(result))
