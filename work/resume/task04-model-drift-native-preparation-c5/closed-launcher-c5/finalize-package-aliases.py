from pathlib import Path
import json,hashlib
T=Path('/tmp/cortex-native-c5-closed-launcher-c5');W=Path('/workspace/Project-Cortex/work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c5');H=lambda b:hashlib.sha256(b).hexdigest()
p=T/'package-aliases.json';before=p.read_bytes();x=json.loads(before)
for row in x['directories']:
 s=Path(row['path']).lstat();row['identity']={k:getattr(s,'st_'+k)for k in ['dev','ino','mode','uid','nlink','size','mtime_ns','ctime_ns']}
p.write_text(json.dumps(x,indent=2)+'\n');pin=W/'prepared-source-inputs.json';old=pin.read_bytes();v=json.loads(old);row=next(r for r in v['files']if r['path']==str(p));assert row['sha256']==H(before);row.update(bytes=p.stat().st_size,sha256=H(p.read_bytes()));pin.write_text(json.dumps(v,indent=2)+'\n');print(json.dumps({'status':'FINAL_OWN_ALIAS_DIRECTORY_IDENTITIES_AFTER_LINK_CREATION','declaredGeneratedDeltas':[{'path':str(p),'beforeSHA256':H(before),'afterSHA256':H(p.read_bytes())},{'path':str(pin),'beforeSHA256':H(old),'afterSHA256':H(pin.read_bytes())}]}))
