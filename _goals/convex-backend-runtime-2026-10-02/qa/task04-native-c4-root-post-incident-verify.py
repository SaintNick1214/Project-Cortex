from pathlib import Path
import os,stat,json,hashlib,datetime
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
qa=Path('_goals/convex-backend-runtime-2026-10-02/qa')
profiles=[('extension','5f68caca72ff8b5792efabe135d31430451cd4b9147fc672393a750bceddf53f','dad0677c535aaa56f7a52863e90f6baec8602585b99ed26d8832467ed082e683',3853,210),('regression','c7c6c1ace7b2df60ab29181dcf007ed0805956ed10282410d7598abc1447c552','89dad16e23957a4e038e385d841e87ff73c5d891bbb31eb53ca52aedcbcf429f',2073,207),('extra','56cc58bf63375ef7913fe38ef59ecf19947dfeeb205983e0cb941b27efc19c8f','2103aa9d7337d009352962c96f5fe3be47e6c3eceda3ee52a4c61e6db74259db',2322,318)]
out=[]
def content(p):
 s=p.lstat();assert stat.S_ISREG(s.st_mode)
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  fs=os.fstat(fd);assert (s.st_dev,s.st_ino)==(fs.st_dev,fs.st_ino)
  h=hashlib.sha256();n=0
  while True:
   b=os.read(fd,1048576)
   if not b:break
   h.update(b);n+=len(b)
  return n,h.hexdigest()
 finally:os.close(fd)
def literal_set(root,exclude):
 actual=set()
 for parent,dirs,files in os.walk(root,followlinks=False):
  for d in list(dirs):
   p=Path(parent)/d
   if p.is_symlink():actual.add(str(p.relative_to(root)));dirs.remove(d)
  for f in files:
   p=Path(parent)/f
   if p!=exclude:actual.add(str(p.relative_to(root)))
 return actual
def verify(root,name,digest,count,whole=True,operative=False,ordered=True):
 m=root/name;before=content(m);assert before[1]==digest
 v=json.loads(m.read_bytes());rows=v['files'];assert len(rows)==count
 paths=[r['path'] for r in rows];assert len(set(paths))==count
 if ordered:assert paths==sorted(paths)
 if whole:assert literal_set(root,m)==set(paths)
 total=0;links=0
 for r in rows:
  rel=Path(r['path']);assert not rel.is_absolute() and '..' not in rel.parts
  p=root/rel
  if r.get('kind')=='literal-symlink':
   assert p.is_symlink();b=os.readlink(p).encode();assert os.readlink(p)==r['target'] and hashlib.sha256(b).hexdigest()==r['sha256'];links+=1
  else:
   if operative:assert p.lstat().st_nlink==1
   n,h=content(p);assert n==r['bytes'] and h==r['sha256'],r['path'];total+=n
 assert content(m)==before
 out.append({'root':str(root),'manifest':name,'sha256':digest,'rows':count,'bytesVerified':total,'literalLinks':links,'wholeSelfOnlyClosure':whole,'operativeLinkGuard':operative})
for name,q,r,nq,nr in profiles:
 root=qa/('task04-model-drift-native-'+name+'-preparation-c4')
 verify(root,'qa-manifest.json',q,nq)
 verify(root,'runtime-freeze.json',r,nr,False,True)
verify(Path('work/resume/task04-model-drift-native-preparation-c4'),'work-manifest.json','0e3575cdb2978556896a4fa41e78a370d417d2b3352367717ad0a274b81e1901',133251,ordered=False)
receipt={'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'POST_INCIDENT_EXACT_CLOSURES_VERIFIED_HISTORY_RETAINED_NO_PREPARATION_ACCEPTANCE','checks':out,'reportReads':'All three full reports read separately; no source/native/pin/actual/timing acceptance.','limits':'Read-only byte/literal closure checks; no all-shared-tree inode/access-time preservation claim. Original sealed manifests are retained exact backing, not duplicated before images.'}
(qa/'task04-native-c4-root-post-incident-closure-verification.json').open('x').write(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
