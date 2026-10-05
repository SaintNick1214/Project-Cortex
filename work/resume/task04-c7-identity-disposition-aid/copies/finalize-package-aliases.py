from fs_identity import loads as authority_loads
from fs_identity import fs_identity
from pathlib import Path
import json,hashlib
T=Path('/dev/shm/cortex-native-c7-exact-identity-repair');W=Path('/workspace/Project-Cortex/work/resume/task04-c7-exact-identity-repair/candidate');H=lambda b:hashlib.sha256(b).hexdigest()
p=T/'package-aliases.json';before=p.read_bytes();x=authority_loads(before)
for row in x['directories']:
 s=Path(row['path']).lstat();row['identity']=fs_identity(s)
p.write_text(json.dumps(x,indent=2)+'\n');pin=W/'prepared-source-inputs.json';old=pin.read_bytes();v=authority_loads(old);row=next(r for r in v['files']if r['path']==str(p));assert row['sha256']==H(before);row.update(bytes=p.stat().st_size,sha256=H(p.read_bytes()));pin.write_text(json.dumps(v,indent=2)+'\n');print(json.dumps({'status':'FINAL_OWN_ALIAS_DIRECTORY_IDENTITIES_AFTER_LINK_CREATION','declaredGeneratedDeltas':[{'path':str(p),'beforeSHA256':H(before),'afterSHA256':H(p.read_bytes())},{'path':str(pin),'beforeSHA256':H(old),'afterSHA256':H(pin.read_bytes())}]}))
