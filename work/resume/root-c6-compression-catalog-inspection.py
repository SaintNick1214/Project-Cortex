from pathlib import Path
import os, stat, json, hashlib, datetime
T=Path('/dev/shm/cortex-native-c6-closed-launcher-c6')
Q=Path('/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa')
def held(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd); assert stat.S_ISREG(a.st_mode) and a.st_uid==os.getuid() and a.st_nlink==1
  with os.fdopen(os.dup(fd),'rb') as f:b=f.read()
  keys=('st_dev','st_ino','st_uid','st_gid','st_mode','st_nlink','st_size','st_mtime_ns','st_ctime_ns')
  ident={k:getattr(a,k) for k in keys};assert ident=={k:getattr(os.fstat(fd),k) for k in keys}=={k:getattr(os.lstat(p),k) for k in keys}
  return b,hashlib.sha256(b).hexdigest(),ident
 finally:os.close(fd)
raw,h,i=held(T/'cumulative-evidence-compression.json');d=json.loads(raw)
assert d['kind']=='CONTENT_ONLY_HISTORICAL_EVIDENCE_NOT_RUNTIME_SOURCE_SUBSTITUTION' and len(d['indexes'])==2
paths=set();checks=[]
for ref,name in zip(d['indexes'],('task04-native-c6-root-completed-evidence-compression-inspection.json','task04-native-c6-root-completed-evidence-compression-2-inspection.json')):
 previous=json.loads(held(Q/name)[0]);sb,sh,si=held(ref['summary']);ib,ih,ii=held(ref['index'])
 assert sh==ref['summarySHA256']==previous['summarySHA256'] and ih==ref['indexSHA256']==previous['mappingSHA256']
 for observed,prior in ((si,previous['summaryFreshIdentity']),(ii,previous['mappingFreshIdentity'])):
  assert {k.removeprefix('st_'):v for k,v in observed.items()}==prior
 summary=json.loads(sb);rows=[json.loads(line) for line in ib.splitlines()];assert len(rows)==summary['count']==previous['count']
 assert summary['index']==ref['index'] and summary['indexSHA256']==ih
 for row in rows:
  assert row['path'] not in paths and not os.path.lexists(row['path']);paths.add(row['path'])
 checks.append(dict(summarySHA256=sh,indexSHA256=ih,count=len(rows),priorIndependentInspection=name))
assert len(paths)==64
out=dict(utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),status='CONTENT_ONLY_CATALOG_AUTHENTICATED_EXACT64_UNIQUE_PATHS',catalogSHA256=h,catalogFreshIdentity=i,indexes=checks,qualification='NONE_NO_OLD_INODE_OR_RUNTIME_SOURCE_SUBSTITUTION')
with (Q/'task04-native-c6-root-compression-catalog-inspection.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
