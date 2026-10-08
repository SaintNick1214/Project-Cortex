from pathlib import Path
import os, stat, json, hashlib, tarfile, datetime

BASE=Path('/workspace/Project-Cortex')
ROOT=BASE/'work/resume/task04-model-drift-native-preparation-c4'
MIRROR=Path('/tmp/cortex-evidence-transport-c4-c1/clean-checkout')/ROOT.relative_to(BASE)
QA=BASE/'_goals/convex-backend-runtime-2026-10-02/qa'
OUT=QA/'task04-c4-namespace-incident-root-recovery'
OUT.mkdir(mode=0o700,exist_ok=False)
utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda b:hashlib.sha256(b).hexdigest()
def read(p):
 for parent in p.parents:assert not parent.is_symlink(),str(parent)
 s=p.lstat(); assert stat.S_ISREG(s.st_mode) and s.st_nlink==1,str(p)
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  f=os.fstat(fd);assert (s.st_dev,s.st_ino,s.st_size)==(f.st_dev,f.st_ino,f.st_size)
  chunks=[]
  while True:
   b=os.read(fd,1048576)
   if not b:break
   chunks.append(b)
  b=b''.join(chunks); assert len(b)==s.st_size
  return b,{'path':str(p.relative_to(BASE)) if p.is_relative_to(BASE) else str(p),'bytes':len(b),'sha256':sha(b),'mode':stat.S_IMODE(s.st_mode),'dev':s.st_dev,'inode':s.st_ino,'nlink':s.st_nlink,'mtime_ns':s.st_mtime_ns,'ctime_ns':s.st_ctime_ns}
 finally:os.close(fd)
manifest=ROOT/'work-manifest.json'
mb,_=read(manifest); assert sha(mb)=='0e3575cdb2978556896a4fa41e78a370d417d2b3352367717ad0a274b81e1901'
rows=json.loads(mb)['files']; expected={r['path']:r for r in rows};assert len(expected)==133251
incident=BASE/'work/resume/task04-model-drift-native-preparation-c5/c4-namespace-incident-99783112434c4b5b9229d297c1c004a4.json'
ib,_=read(incident); added=json.loads(ib)['added'];assert len(added)==750
paths=[]; originals={}; pre=[]
for a in added:
 rel=Path(a['path']);assert not rel.is_absolute() and '..' not in rel.parts and str(rel) not in expected
 b,m=read(ROOT/rel); assert len(b)==a['bytes'] and sha(b)==a['sha256'];paths.append(str(rel));pre.append(m)
for rel in ['extension/inventory-entry.ts','extension/inventory-bundle.mjs']:
 b,m=read(ROOT/rel); old,om=read(MIRROR/rel);r=expected[rel]
 assert len(old)==r['bytes'] and sha(old)==r['sha256'];assert sha(b)!=r['sha256']
 assert m['mode']==om['mode']==0o600
 originals[rel]=old;paths.append(rel);pre.append(m)
assert len(set(paths))==752
before={'utc':utc(),'argv':['python3','work/resume/task04-c4-incident-root-recovery.py'],'incidentMapSha256':sha(ib),'manifestSha256':sha(mb),'sourceBefore':pre,'originalRecoveryCopies':[read(MIRROR/r)[1] for r in originals],'scope':'ROOT recovery only; original inode/timestamp preincident unavailable, no continuity claim'}
(OUT/'source-before.json').write_text(json.dumps(before,indent=2)+'\n')
archive=OUT/'incident-bytes.tar.gz'
with tarfile.open(archive,'w:gz',compresslevel=6) as t:
 for rel in paths:t.add(ROOT/rel,arcname=rel,recursive=False)
with tarfile.open(archive,'r:gz') as t:
 members=t.getmembers();assert len(members)==752 and {m.name for m in members}==set(paths)
 by={m['path'].removeprefix(str(ROOT.relative_to(BASE))+'/'):m for m in pre}
 for m in members:
  assert m.isfile() and m.mode==by[m.name]['mode'];f=t.extractfile(m);b=f.read();assert len(b)==by[m.name]['bytes'] and sha(b)==by[m.name]['sha256']
# No mutations before all saved archive members and all current source identities verify.
for m in pre:
 b,now=read(BASE/m['path']);assert now==m
actions=[]
for rel,old in originals.items():
 p=ROOT/rel; fd=os.open(p,os.O_WRONLY|os.O_NOFOLLOW)
 try:
  f=os.fstat(fd);m=next(x for x in pre if x['path']==str(p.relative_to(BASE)));assert (f.st_dev,f.st_ino,f.st_nlink)==(m['dev'],m['inode'],1)
  off=0
  while off<len(old):
   n=os.write(fd,old[off:]);assert n>0;off+=n
  os.ftruncate(fd,len(old));os.fsync(fd)
 finally:os.close(fd)
 b,m=read(p);assert b==old;actions.append({'operation':'restore-original-bytes-retaining-current-inode','utc':utc(),'after':m})
for a in added:
 p=ROOT/a['path'];b,m=read(p);assert len(b)==a['bytes'] and sha(b)==a['sha256'];os.unlink(p)
 actions.append({'operation':'remove-only-archived-manifest-absent-incident-addition','utc':utc(),'before':m})
# Remove only now-empty incident-created ancestors absent from original directory paths.
original_dirs=set()
for rel in expected:
 for parent in Path(rel).parents:
  if str(parent)!='.':original_dirs.add(str(parent))
dirs=set()
for a in added:
 for parent in Path(a['path']).parents:
  if str(parent)!='.' and str(parent) not in original_dirs:dirs.add(str(parent))
for rel in sorted(dirs,key=lambda s:len(Path(s).parts),reverse=True):
 p=ROOT/rel
 if p.exists():
  assert p.is_dir() and not p.is_symlink();os.rmdir(p)
assert read(manifest)[0]==mb
after={'utc':utc(),'status':'ORIGINAL_BYTES_RECOVERED_FULL_CLOSURE_AUDIT_PENDING','archive':read(archive)[1],'actions':actions,'incidentHistoryRetained':True,'limits':'Restores exact original bytes/modes and filelike set; does not recover preincident inode/mtime/ctime or erase incident.'}
(OUT/'recovery-receipt.json').write_text(json.dumps(after,indent=2)+'\n')
print(json.dumps({'status':after['status'],'archiveSha256':after['archive']['sha256'],'restored':2,'archivedRemoved':750,'qa':str(OUT.relative_to(BASE))}))
