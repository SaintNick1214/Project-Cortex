import datetime,gzip,hashlib,json,os,stat,sys
from pathlib import Path
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c2-component-byte-backing-c2';W=R/'work/resume/task04-c2-byte-backing-ancestry-c2-fresh-review';T=Path('/tmp/cortex-c2-backing-ancestry-c2-fresh-review')
def sha(b):return hashlib.sha256(b).hexdigest()
def row(p):
 s=p.lstat();k='directory' if stat.S_ISDIR(s.st_mode) else 'regular' if stat.S_ISREG(s.st_mode) else 'symlink' if stat.S_ISLNK(s.st_mode) else 'fifo' if stat.S_ISFIFO(s.st_mode) else 'special'
 d={'path':str(p),'kind':k,'mode':stat.S_IMODE(s.st_mode),'uid':s.st_uid,'gid':s.st_gid,'dev':s.st_dev,'ino':s.st_ino,'nlink':s.st_nlink,'size':s.st_size,'mtime_ns':s.st_mtime_ns,'ctime_ns':s.st_ctime_ns}
 if k=='regular':d['sha256']=sha(p.read_bytes())
 elif k=='symlink':d['target']=os.readlink(p)
 return d
def walk(p,out,excluded):
 if str(p) in excluded:return
 d=row(p);out.append(d)
 if d['kind']=='directory':
  for c in sorted(p.iterdir()):walk(c,out,excluded)
s=Q/'seals.json';raw=s.read_bytes();assert sha(raw)=='95c3603dc9da1a2320edc248a89dd40b7831ce4e13f61fad8abd440aebb98d91';seal=json.loads(raw);actual=[]
for p in seal['ownedRoots']:walk(Path(p),actual,seal['excludedExactSelfOnly'])
expected=seal['entries']; assert len(actual)==len(expected)==1347
assert actual==expected,[(a,b) for a,b in zip(actual,expected) if a!=b][:2]
idx=json.loads((Q/'index.json').read_bytes());assert sha((Q/'materialize.py').read_bytes())=='3d3ef55f98ad31332b90c20f31789b5f7978918cacf7831a2cacf9b2811b2ac3';assert sha((Q/'index.json').read_bytes())=='cf6314cb96d9b8b74be64839ff971a0e85068dc6a67c5b8bf8433850263b6866'
(W/'seal-verification.json').write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'candidateSealSHA256':sha(raw),'entries':len(actual),'exactEntryMetadataAndBytes':True},indent=2)+'\n')
print('candidate exact whole closure PASS',len(actual))
