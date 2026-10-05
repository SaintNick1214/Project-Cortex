from pathlib import Path
import os,stat,json,hashlib,datetime
R=Path('/workspace/Project-Cortex')
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa'
A=Q/'task04-native-c6-capture-performance-source-aid'
W=R/'work/resume/task04-native-c6-capture-performance-source-aid'
def held(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1
  with os.fdopen(os.dup(fd),'rb') as f:b=f.read()
  keys=('st_dev','st_ino','st_mode','st_uid','st_gid','st_nlink','st_size','st_mtime_ns','st_ctime_ns')
  i={k:getattr(a,k) for k in keys};assert i=={k:getattr(os.fstat(fd),k) for k in keys}=={k:getattr(os.lstat(p),k) for k in keys}
  return b,hashlib.sha256(b).hexdigest(),i
 finally:os.close(fd)
checks=[]
for root,pin in ((A,'a6ee1ea645d7ac856135715d294cb957fb84ead3470ac3133de09ce13e839f0c'),(W,'3d6afec29d69ba6b3a198c5f479891a4593a4894c36d402806decd82ef29cb9a')):
 raw,h,i=held(root/'exact-files-sha256.json');assert h==pin;manifest=json.loads(raw);expected=set();rows=[]
 for row in manifest['files']:
  rel=Path(row['path']);assert not rel.is_absolute() and '..' not in rel.parts and str(rel) not in expected;expected.add(str(rel))
  b,dh,di=held(root/rel);assert len(b)==row['bytes'] and dh==row['sha256'];rows.append(dict(path=str(rel),sha256=dh,bytes=len(b),freshIdentity=di))
 actual=set()
 for parent,dirs,files in os.walk(root,followlinks=False):
  assert not any((Path(parent)/n).is_symlink() for n in dirs+files)
  actual.update(str((Path(parent)/n).relative_to(root)) for n in files)
 assert actual==expected|{'exact-files-sha256.json'}
 checks.append(dict(root=str(root),manifestSHA256=h,manifestFreshIdentity=i,files=rows))
pins=json.loads(held(W/'source-pins.json')[0]);after=json.loads(held(A/'source-consistency-after.json')[0]);assert len(pins['files'])==len(after['files'])==119
assert held(W/'source-pins.json')[0]==held(A/'source-pins.json')[0]
follow={r['source']:r for r in after['files']};assert len(follow)==119
for p in pins['files']:
 b,h,i=held(W/p['copy']);assert h==p['sha256'] and len(b)==p['bytes']
 assert p['heldStable'] and p['before']==p['after']==p['pathAfter']
 f=follow[p['source']];assert f['stableRead'] and f['sameDigestAsPin'] and f['sameIdentityAsPin']
 assert f['sha256']==h and f['before']==f['after']==f['pathAfter']==p['before']
out=dict(utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),status='ROOT_FULL_SOURCE_AID_CONTENT_MEMBERSHIP_AND119_CAPTURE_RECORDS_VERIFIED',namespaces=checks,pinnedSourceCopiesVerified=119,limits='Exact-files SHA manifests are content seals, not directory identity seals. Original mutable source was not reread by ROOT; historical agent capture/after-inspection records checked against retained copies. No current source qualification, implementation, profiling, executed optimization controls or gate verdict.')
with (Q/'task04-native-c6-capture-performance-source-aid-root-inspection.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(dict(status=out['status'],pinnedSourceCopiesVerified=119,namespaceFileCounts=[len(x['files']) for x in checks])))
