from fs_identity import loads as authority_loads
from fs_identity import fs_identity
from pathlib import Path
import os,stat,json,hashlib,gzip,re,datetime
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-c7-exact-identity-repair/candidate';T=Path('/dev/shm/cortex-native-c7-exact-identity-repair');M=T/'mirror';H=lambda b:hashlib.sha256(b).hexdigest()
p=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c4/scripts/guard.mjs';graph=authority_loads((T/'package-graph.json').read_bytes());expected=next(r for r in graph['files']if r['path']==str(p));assert H(p.read_bytes())==expected['sha256']
s=p.lstat();assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and p.resolve()==p;fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);primary=None;secondary=[]
try:
 a=os.fstat(fd);parts=[]
 while True:
  b=os.read(fd,1048576)
  if not b:break
  parts.append(b)
 identity=lambda z:fs_identity(z);assert identity(s)==identity(a)==identity(os.fstat(fd))==identity(p.lstat());b=b''.join(parts);assert len(b)==expected['bytes']and H(b)==expected['sha256']
except BaseException as e:primary=e
try:os.close(fd)
except BaseException as e:secondary.append(e)
if primary or secondary:raise Exception(json.dumps({'primary':str(primary)if primary else None,'allSecondary':[str(e)for e in secondary]}))
imports=re.findall(r"from\s*['\"]([^'\"]+)['\"]",b.decode());assert imports==['node:fs','node:path','node:url','node:crypto','node:util']
callers=[]
for profile in ['extension','regression','extra']:
 caller=R/('_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-'+profile+'-preparation-c5/scripts/offline-publication-artifacts.mjs');text=caller.read_bytes();literal="../../task04-native-admission-fixture-c4/scripts/guard.mjs";assert literal in text.decode()and(caller.parent/literal).resolve()==p;callers.append({'path':str(caller),'bytes':len(text),'sha256':H(text),'exactStaticImport':literal})
backing=T/'mirror-prebytes'/(H(b)+'.gz');encoded=gzip.compress(b,mtime=0)
if not backing.exists():backing.write_bytes(encoded)
assert gzip.decompress(backing.read_bytes())==b
q=M/p.relative_to(R);q.parent.mkdir(parents=True,exist_ok=True,mode=0o700);q.write_bytes(b);q.chmod(0o600);assert q.read_bytes()==b
mapPath=W/'mirror-source-transform-map.json';oldMap=mapPath.read_bytes();v=authority_loads(oldMap);assert not any(row['source']==str(p)for row in v['inputs']);v['inputs'].append({'source':str(p),'sha256':H(b),'bytes':len(b),'identity':identity(a),'beforeByteBacking':str(backing),'encodedSHA256':H(backing.read_bytes()),'destination':str(q),'destinationSHA256':H(b),'destinationBytes':len(b),'changes':[],'assertions':'BYTE_EXACT_ORIGINAL_NO_TRANSFORM_NO_ASSERTION_CAP_TIER_CHANGE','admission':'EXACT_PROVEN_ORIGINAL_STATIC_IMPORT_ONLY_NOT_BLANKET_293','callers':callers,'staticDependencies':imports});mapPath.write_text(json.dumps(v,indent=2)+'\n')
pin=W/'prepared-source-inputs.json';oldPin=pin.read_bytes();refs=authority_loads(oldPin);row=next(r for r in refs['files']if r['path']==str(mapPath));assert row['sha256']==H(oldMap);row.update(bytes=mapPath.stat().st_size,sha256=H(mapPath.read_bytes()));pin.write_text(json.dumps(refs,indent=2)+'\n');print(json.dumps({'status':'EXACT_ONE_STATIC_IMPORT_BYTEEXACT_MIRROR_SETUP_ONLY','source':str(p),'sha256':H(b),'bytes':len(b),'destination':str(q),'staticDependencies':imports,'declaredGeneratedDeltas':[{'path':str(mapPath),'beforeSHA256':H(oldMap),'afterSHA256':H(mapPath.read_bytes())},{'path':str(pin),'beforeSHA256':H(oldPin),'afterSHA256':H(pin.read_bytes())}],'original122':'HELD'}))
