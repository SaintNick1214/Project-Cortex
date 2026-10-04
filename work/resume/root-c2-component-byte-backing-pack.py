import os,stat,json,hashlib,tarfile,io,datetime
from pathlib import Path
R=Path.cwd();Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';W=R/'work/resume';base=Path('/tmp/cortex-root-storage-rescue/c2-component-backing');base.mkdir();refs=json.load(open(W/'task04-model-drift-native-preparation-c5/closed-launcher-c2/component-review-packet/exact-immutable-references.json'))['references'];items=[]
for r in refs:
 if r['path'].startswith('/tmp/'):items.append({'path':r['path'],'bytes':r['bytes'],'sha256':r['sha256'],'role':'candidate-'+r['role']})
p=Path('/tmp/cortex-native-c5-closed-launcher-c2-fresh-review/tmp-manifest.json');seal=json.loads(p.read_text());assert hashlib.sha256(p.read_bytes()).hexdigest()=='44d7a4aacc881c1811543c54366177c16d8d0c3240524b47cec97729444dc5cd'
for r in seal['files']:assert r['kind']=='file';items.append({'path':str(p.parent/r['path']),'bytes':r['bytes'],'sha256':r['sha256'],'role':'fresh-review-tmp'})
items.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'role':'fresh-review-authentic-tmp-seal'})
unique={}
for r in items:
 p=Path(r['path']);s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_uid==os.getuid() and s.st_nlink==1;fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 with os.fdopen(fd,'rb') as h:
  a=os.fstat(h.fileno());b=h.read();z=os.fstat(h.fileno());assert (a.st_dev,a.st_ino,a.st_mtime_ns,a.st_ctime_ns,a.st_size)==(z.st_dev,z.st_ino,z.st_mtime_ns,z.st_ctime_ns,z.st_size)
 assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'];r['observedMode']=stat.S_IMODE(s.st_mode);r['observedIdentity']={'dev':s.st_dev,'ino':s.st_ino,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns};unique.setdefault(r['sha256'],r)
archive=base/'objects.tar.gz'
with tarfile.open(archive,'w:gz') as t:
 for sha,r in sorted(unique.items()):
  b=Path(r['path']).read_bytes();assert hashlib.sha256(b).hexdigest()==sha;v=tarfile.TarInfo('objects/'+sha);v.size=len(b);v.mode=0o600;v.mtime=0;t.addfile(v,io.BytesIO(b))
with tarfile.open(archive,'r:gz') as t:
 seen=set()
 for m in t:
  assert m.isfile() and m.name.startswith('objects/');sha=m.name[8:];assert sha in unique and sha not in seen;seen.add(sha);b=t.extractfile(m).read();assert len(b)==unique[sha]['bytes'] and hashlib.sha256(b).hexdigest()==sha
 assert seen==set(unique)
parts=[];mapping={};sha=hashlib.sha256()
with archive.open('rb') as h:
 n=0
 while b:=h.read(5*1024*1024):
  sha.update(b);p=base/f'objects.part-{n:04d}';p.write_bytes(b);virtual='_goals/convex-backend-runtime-2026-10-02/qa/task04-c2-component-byte-backing/'+p.name;parts.append({'path':p.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()});mapping[virtual]=str(p);n+=1
index={'schemaVersion':1,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Exact immutable candidate/fresh-review temporary byte backing only; no source/native/paid/bridge release. Original labels are provenance, extraction writes content objects in an owned destination.','archiveSHA256':sha.hexdigest(),'archiveBytes':archive.stat().st_size,'parts':parts,'references':items,'objects':[{k:r[k] for k in ['sha256','bytes']} for _,r in sorted(unique.items())],'historicalCustody':'BROKEN','negativeTopology':'No negative fixture topology is reconstructed by this object archive.'}
out=Q/'task04-c2-component-byte-backing';out.mkdir();(out/'index.json').write_text(json.dumps(index,indent=2)+'\n');(W/'transfer35-virtual-source-mapping.json').write_text(json.dumps(mapping,indent=2)+'\n');print(json.dumps({'references':len(items),'objects':len(unique),'rawObjectBytes':sum(r['bytes'] for r in unique.values()),'encodedBytes':archive.stat().st_size,'parts':len(parts),'archiveSHA256':sha.hexdigest()}))
