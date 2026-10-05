import os,stat,json,hashlib,tarfile,io,datetime,uuid
from pathlib import Path
R=Path.cwd(); Q=R/'_goals/convex-backend-runtime-2026-10-02/qa'; temp=Path('/tmp/cortex-root-storage-rescue'); name='root-completed-transfer-plans-12-32'; entries=[]; paths=[]
for n in range(12,33):
 p=R/'work/resume'/f'connector-transfer-plan-{n:02d}.json'
 if not p.exists():continue
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_uid==os.getuid() and s.st_nlink==1
 b=p.read_bytes();d=json.loads(b);assert isinstance(d,dict) and 'rows' in d
 entries.append({'path':str(p.relative_to(R)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'mode':stat.S_IMODE(s.st_mode),'dev':s.st_dev,'ino':s.st_ino,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns,'nlink':s.st_nlink}); paths.append((p,b))
assert len(entries)>=15;out=Q/(name+'.tar.gz');assert not out.exists();started=datetime.datetime.now(datetime.timezone.utc).isoformat()
with tarfile.open(out,'w:gz') as archive:
 for r,(_,b) in zip(entries,paths):
  info=tarfile.TarInfo(r['path']);info.size=len(b);info.mode=r['mode'];info.mtime=0;archive.addfile(info,io.BytesIO(b))
with tarfile.open(out,'r:gz') as archive:
 members=archive.getmembers();assert len(members)==len(entries)
 for m,r in zip(members,entries):
  assert m.isfile() and m.name==r['path'] and m.mode==r['mode'];b=archive.extractfile(m).read();assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256']
back=out.read_bytes();copy=temp/out.name;assert not copy.exists();copy.write_bytes(back);assert copy.read_bytes()==back
# Each root-owned source is identity/content revalidated immediately before unlink.
for r,(p,_) in zip(entries,paths):
 s=p.lstat();assert (s.st_dev,s.st_ino,s.st_nlink,s.st_mtime_ns,s.st_ctime_ns)==(r['dev'],r['ino'],r['nlink'],r['mtimeNs'],r['ctimeNs']);assert hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'];p.unlink();assert not p.exists()
receipt={'startedAt':started,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'ROOT-owned obsolete completed transfer plan scratch12–32 only, no agent seal/source/live Git index/HEAD. Archives must be materialized before claiming original request metadata paths exist.','archive':str(out.relative_to(R)),'archiveBytes':len(back),'archiveSHA256':hashlib.sha256(back).hexdigest(),'tmpCopy':str(copy),'entries':entries,'rawBytesRemoved':sum(r['bytes'] for r in entries),'sourcePreBytesBacking':'All actual original preimages verified in archive before deletion','originalPathsAbsent':True}
(Q/(name+'.json')).write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'archivedPlans':len(entries),'rawBytes':receipt['rawBytesRemoved'],'archiveBytes':len(back),'netLogicalBytesFreed':receipt['rawBytesRemoved']-len(back)}))
