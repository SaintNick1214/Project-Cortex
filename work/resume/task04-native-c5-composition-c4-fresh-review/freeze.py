from pathlib import Path
import os,stat,hashlib,json,datetime
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-native-c5-composition-c4-fresh-review';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-composition-c4-fresh-review';T=Path('/tmp/cortex-native-c5-independent-review-c4-fresh-20261004b');H=lambda b:hashlib.sha256(b).hexdigest()
def put(p,j):p.write_text(json.dumps(j,indent=2)+'\n')
def file(p):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and p.resolve()==p
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);h=hashlib.sha256();size=0
 try:
  a=os.fstat(fd)
  while True:
   b=os.read(fd,1048576)
   if not b:break
   h.update(b);size+=len(b)
  z=os.fstat(fd);last=p.lstat();keys=['mode','uid','dev','ino','nlink','size','mtime_ns','ctime_ns'];assert all(getattr(s,'st_'+k)==getattr(a,'st_'+k)==getattr(z,'st_'+k)==getattr(last,'st_'+k) for k in keys)
 finally:os.close(fd)
 return {'path':str(p),'bytes':size,'sha256':h.hexdigest(),'identity':{k:getattr(s,'st_'+k)for k in ['mode','uid','dev','ino','nlink','size','mtime_ns','ctime_ns']}}
def rows(root):
 out=[]
 def walk(d):
  for p in sorted(d.iterdir()):
   if p==root/'literal-self-seal.json':continue
   s=p.lstat();r={'path':str(p.relative_to(root)),**{k:getattr(s,'st_'+k)for k in ['mode','uid','dev','ino','nlink']}}
   if stat.S_ISREG(s.st_mode):x=file(p);r.update(type='file',bytes=x['bytes'],sha256=x['sha256'])
   elif stat.S_ISLNK(s.st_mode):r.update(type='symlink',target=os.readlink(p))
   elif stat.S_ISDIR(s.st_mode):r['type']='directory'
   else:raise ValueError('special')
   out.append(r)
   if r['type']=='directory':walk(p)
 walk(root);return out

def seal(root):
 rr=rows(root);p=root/'literal-self-seal.json';put(p,{'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'selfOnlyExclusion':str(p),'literalNoFollow':True,'rows':rr,'rowsSHA256':H(json.dumps(rr,separators=(',',':')).encode())});assert rows(root)==rr;return file(p)
if __name__=='__main__':
 assert json.loads((T/'final-quiescence.json').read_bytes())['noLiveOwnedProcess'];a=seal(W);b=seal(T);put(Q/'owned-seal-references.json',{'work':a,'temporary':b,'scope':'SELF_ONLY_FRESH_REVIEW_NOT_CANDIDATE_ACCEPTANCE','verdict':'REJECT','original122':'HELD','nativePrivatePaidTiming':'HELD'});c=seal(Q)
 for root in [W,T,Q]:assert rows(root)==json.loads((root/'literal-self-seal.json').read_bytes())['rows']
 print(json.dumps({'QA':c,'work':a,'tmp':b,'counts':[len(rows(x))for x in [Q,W,T]],'verdict':'REJECT','original122':'HELD'}))
