"""SOURCE_AID_ONLY plain own file-content manifests; no frozen-source mutations."""
from pathlib import Path
import os,json,hashlib,datetime,stat
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-c7-exact-identity-source-aid';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-exact-identity-source-aid'
fields=['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']
def row(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  ident=lambda s:{k:str(getattr(s,'st_'+k))for k in fields}
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode);pre=ident(a);h=hashlib.sha256();n=0
  while True:
   b=os.read(fd,1048576)
   if not b:break
   h.update(b);n+=len(b)
  post=ident(os.fstat(fd));last=ident(os.lstat(p));assert pre==post==last
  return dict(path=str(p),bytes=n,sha256=h.hexdigest(),identity=pre,POST=post,pathPOST=last)
 finally:os.close(fd)
def put(p,d):p.write_text(json.dumps(d,indent=2,sort_keys=True)+'\n')
source=json.loads((W/'source-PRE.json').read_text());post=[]
for a in source['rows']:
 b=row(Path(a['source']));c=row(Path(a['copy']));same=b['sha256']==a['sha256']==c['sha256'] and b['bytes']==a['bytes']==c['bytes'] and b['identity']==a['PRE']
 post.append(dict(source=b,copy=c,sourceAndCopyBytesAndOriginalExactIdentityEqual=same));assert same
put(W/'source-POST.json',dict(label='SOURCE_AID_ONLY',utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),count=len(post),bytes=sum(a['source']['bytes']for a in post),allEqual=True,rows=post))
report=row(Q/'report.md');put(W/'report-reference.json',dict(label='SOURCE_AID_ONLY',report=report))
def seal(root,refs):
 files=[]
 for dp,dn,fn in os.walk(root,followlinks=False):
  for name in dn:assert not (Path(dp)/name).is_symlink()
  for name in sorted(fn):
   p=Path(dp)/name
   if p==root/'selfseal.json':continue
   assert not p.is_symlink();r=row(p);r['relativePath']=str(p.relative_to(root));files.append(r)
 files.sort(key=lambda r:r['relativePath'])
 put(root/'selfseal.json',dict(label='SOURCE_AID_ONLY',format='PLAIN_EXACT_FILE_CONTENT_MANIFEST_NOT_DIRECTORY_HISTORICAL_SEAL',root=str(root),excludedSelfOnly=['selfseal.json'],files=len(files),bytes=sum(r['bytes']for r in files),rows=files,references=refs))
 return row(root/'selfseal.json')
wr=seal(W,[]);qr=seal(Q,[wr]);print(json.dumps(dict(report=report,W=wr,Q=qr,sourceCount=len(post)),indent=2))
