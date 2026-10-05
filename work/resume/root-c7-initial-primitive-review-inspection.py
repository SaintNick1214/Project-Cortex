from pathlib import Path
import os,stat,json,hashlib,datetime
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';K=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {k:str(getattr(s,'st_'+k)) for k in K}
def held(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1;b=b''
  while True:
   c=os.read(fd,1048576)
   if not c:break
   b+=c
  assert ident(a)==ident(os.fstat(fd))==ident(os.lstat(p));return b,ident(a)
 finally:os.close(fd)
checks=[]
for root,pin,count in [(Q/'task04-c7-identity-primitive-review','eebe2567a4a68ffc3f3d54f0cfe597b5ba342ca05de86c7100fd34cfaa1d53f9',1),(R/'work/resume/task04-c7-identity-primitive-review','af31b2a4b4316fd5d8ea18903d31f001fecbfe84bc98f31ad56531f436f9ddbd',30)]:
 b,_=held(root/'selfseal.json');assert hashlib.sha256(b).hexdigest()==pin;d=json.loads(b);assert d['root']==str(root) and d['excludedOnly']=='selfseal.json' and len(d['literalRows'])==count;expected=set();total=0
 for row in d['literalRows']:
  p=Path(row['path']);assert len(p.parts)==1 and row['path'] not in expected and row['kind']=='FILE';expected.add(row['path']);b,i=held(root/p);assert i==row['identity'] and len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'];total+=len(b)
 assert set(os.listdir(root))==expected|{'selfseal.json'};checks.append({'root':str(root),'selfsealSHA256':pin,'files':count,'bytes':total,'flatLiteralMembershipVerified':True})
body,_=held(Q/'task04-c7-identity-primitive-review/report.md');h=hashlib.sha256(body).hexdigest();assert h=='be3f59208340e2fe1be7dfc9d45775dfbee601f883accf92eb23fc03d440e026' and 'NEEDS FIXES' in body.decode()
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_INITIAL_PRIMITIVE_INDEPENDENT_REVIEW_OWN_FILES_AND_MEMBERSHIP_VERIFIED','checks':checks,'reportSHA256':h,'verdict':'NEEDS_FIXES_INITIAL_VERSION_ONLY','scope':'Eleven captured source copies and initial recorded controls; no current-candidate or Task04 acceptance','limits':'Own file seals exclude self only; root directory identity is not present in supplied manifests. Current exact file identities and full literal flat membership verified, not root historical directory custody. Source-preimage integrity already independently checked in ROOT initial131 readback; no new subject execution.'}
(Q/'task04-c7-identity-primitive-review-root-inspection.json').open('x').write(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
