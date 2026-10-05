from pathlib import Path
import os,stat,json,gzip,hashlib,datetime,sys
R=Path('/workspace/Project-Cortex')
H=lambda b:hashlib.sha256(b).hexdigest()
def identity(s): return {k:getattr(s,'st_'+k) for k in ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')}
def held(p,retain=False):
 p=Path(p); a=p.lstat(); assert stat.S_ISREG(a.st_mode) and a.st_nlink==1
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW); h=hashlib.sha256(); chunks=[]
 try:
  assert identity(a)==identity(os.fstat(fd))
  while True:
   b=os.read(fd,1048576)
   if not b:break
   h.update(b)
   if retain:chunks.append(b)
  assert identity(a)==identity(os.fstat(fd))==identity(p.lstat())
 finally:os.close(fd)
 return h.hexdigest(),a,b''.join(chunks) if retain else None
# ROOT must supply and inspect the exact final subject manifest; this helper cannot freeze a mutable subject.
assert len(sys.argv)==3, 'Usage: final ROOT-authored subject-manifest.json NEW-output.json'
manifest=Path(sys.argv[1]); mh,_,mb=held(manifest,True); subjects=json.loads(mb)['subjects']
assert len(subjects)==4 and {s['scope'] for s in subjects}=={'QA','work','temporary','external'}
results=[]
for s in subjects:
 root=Path(s['root']); seal=Path(s['sealPath']); assert seal.parent==root
 actual,_,encoded=held(seal,True); assert actual==s['sealSHA256']
 decoded=gzip.decompress(encoded) if seal.name.endswith('.gz') else encoded
 packet=json.loads(decoded); assert packet['root']==str(root) and packet['excludedSelfOnly']==[seal.name]
 expected={}; size=0; links=0
 for row in packet['rows']:
  rel=Path(row['path']); assert not rel.is_absolute() and '..' not in rel.parts and row['path'] not in expected
  expected[row['path']]=row; p=root/rel; observed=p.lstat(); assert identity(observed)==row['identity'],(s['scope'],row['path'],'identity')
  if row['kind']=='file':
   h,i,_=held(p); assert i.st_size==row['bytes'] and h==row['sha256']; size+=i.st_size
  elif row['kind']=='directory':
   assert stat.S_ISDIR(observed.st_mode) and sorted(os.listdir(p))==row['members']
  elif row['kind']=='symlink':
   assert stat.S_ISLNK(observed.st_mode) and os.readlink(p)==row['target']; links+=1
  else:raise AssertionError(row['kind'])
 members={'.'}
 for parent,dirs,files in os.walk(root,followlinks=False):
  for n in dirs+files:
   p=Path(parent)/n
   if p!=seal:members.add(str(p.relative_to(root)))
  dirs[:]=[n for n in dirs if not (Path(parent)/n).is_symlink()]
 assert members==set(expected)
 for ref in packet['references']:
  h,i,b=held(ref['path'],True); assert h==ref['sha256'] and i.st_size==ref['bytes'] and identity(i)==ref['identity']
  body=gzip.decompress(b) if ref['path'].endswith('.gz') else b
  assert len(body)==ref['decodedBytes'] and H(body)==ref['decodedSHA256']
 results.append({'scope':s['scope'],'root':str(root),'sealSHA256':actual,'decodedSealSHA256':H(decoded),'rows':len(expected),'regularBytesVerified':size,'literalLinksNeverFollowed':links,'referencesVerified':len(packet['references']),'fullRecordedIdentityAndMembershipVerified':True})
out={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'ROOT_FROZEN_C6_LITERAL_PACKET_ONLY_NOT_ACCEPTANCE','manifestSHA256':mh,'checks':results,'limits':'This checks supplied frozen packet bytes/identities/membership and references only; source pins, exact122 contract, product authority, current execution and independent full judgment need separate inspection.','original122':'HELD','sourceParentNativePrivatePaidTiming':'HELD'}
dest=Path(sys.argv[2]); assert not dest.exists(); dest.write_text(json.dumps(out,indent=2)+'\n'); print(json.dumps(out))
