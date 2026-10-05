import os,json,hashlib,stat,datetime
from pathlib import Path
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-c7-identity-disposition-aid';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-identity-disposition-aid'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def seal(root):
 rows=[]
 def walk(directory):
  for name in sorted(os.listdir(directory)):
   p=directory/name
   if p==root/'selfseal.json':continue
   s=os.lstat(p);row={'path':str(p.relative_to(root)),'identity':identity(s)}
   if stat.S_ISDIR(s.st_mode):row['kind']='directory';rows.append(row);walk(p)
   elif stat.S_ISLNK(s.st_mode):
    row.update(kind='symlink',literalTarget=os.readlink(p));assert identity(os.lstat(p))==row['identity'];rows.append(row)
   elif stat.S_ISREG(s.st_mode):
    fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);os.dup2(fd,9)
    try:
     before=identity(os.fstat(9));h=hashlib.sha256();size=0
     while True:
      block=os.read(9,65536)
      if not block:break
      h.update(block);size+=len(block)
     after=identity(os.fstat(9));last=identity(os.lstat(p));assert row['identity']==before==after==last
     row.update(kind='file',heldFD=9,bytes=size,sha256=h.hexdigest(),pre=before,post=after,currentPathPost=last);rows.append(row)
    finally:os.close(9);os.close(fd)
   else:raise ValueError('unexpected literal object')
 walk(root)
 (root/'selfseal.json').write_text(json.dumps({'label':'PARTIAL_SOURCE_AID_ONLY_SELF_PRESERVATION','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'excludes':['selfseal.json'],'membership':[r['path'] for r in rows],'rows':rows},indent=2)+'\n')
 return len(rows)
print(json.dumps({'workRows':seal(W),'qaRows':seal(Q)}))
