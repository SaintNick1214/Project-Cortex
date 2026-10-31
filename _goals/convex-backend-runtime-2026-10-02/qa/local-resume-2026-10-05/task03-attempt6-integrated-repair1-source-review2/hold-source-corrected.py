import os,json,hashlib,pathlib,time,resource,stat,sys
R=pathlib.Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
J=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-integrated-repair1-source-review2'
F=J.parent/'task03-attempt6-integrated-repair1'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
EXTRAS={'prospective-source-manifest-final.json':('d9e5929e79d682ae2f4e3dfaad4e2fce01e81f09746a8e3f38b094ebaaf330fc',3600048),'prospective-source-plan-final.json':('bc481ae5cf9716f640962b265987b840812f062c926e4accd502f58833f00641',1475378),'source-writers-stopped-final.json':('1049a6569fa6183d9b53d5ba1fc080f171c29cc1ae6333fa23902f8ac9acd507',914),'source-closure-handoff-final.json':('e1c1d0f6a7218f4e19fd6d5e2025763aad57626dad0c0546ac0e939af2beee72',954),'preparation-report-final.md':('06acec174e7f3c76d53182f8cdf6af0cfe4b4abc63bb00f8b073fb08d8ff3151',14461),'operative-repair-map-final.json':('c7016bcee619642929bcdf28402501ddd1860473a59f7066d808524f887a1795',9147)}
def nine(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def strict(b):
 def pairs(ps):
  d={}
  for k,v in ps:
   assert k not in d;d[k]=v
  return d
 return json.loads(b,object_pairs_hook=pairs,parse_constant=lambda x:(_ for _ in()).throw(AssertionError('nonfinite')))
def emit(name,value):
 b=(json.dumps(value,indent=2,sort_keys=True)+'\n').encode();fd=os.open(J/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'wb')as o:o.write(b);o.flush();os.fsync(o.fileno())
 return {'path':name,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)}
def read(fd):
 os.lseek(fd,0,0);parts=[]
 while b:=os.read(fd,262144):parts.append(b)
 return b''.join(parts)
held=[]
try:
 mf=F/'prospective-source-manifest-final.json';mst=nine(os.lstat(mf));mfd=os.open(mf,os.O_RDONLY|os.O_NOFOLLOW);mopen=nine(os.fstat(mfd));emit('first-prospective-source-manifest-metadata.json',{'path':str(mf.relative_to(R)),'PRE':mst,'OPEN':mopen,'scope':'FIRST_PERSISTED_BEFORE_MANIFEST_CONTENT_CORRECTED_ENUMERATOR','priorOwnSetupFailurePreserved':True});mb=read(mfd)
 assert mst==mopen==nine(os.fstat(mfd))==nine(os.lstat(mf));assert len(mb)==3600048 and hashlib.sha256(mb).hexdigest()==EXTRAS[mf.name][0]
 assert time.time_ns()-max(int(mst['mtime_ns']),int(mst['ctime_ns']))>=60000000000
 m=strict(mb);entries=m['files'];assert len(entries)==2352;entries=list(entries);by={x['path']:x for x in entries};assert len(by)==2352
 # Root handoff extras are independent inputs; never use reviewer-generated output as an adopted PRE.
 for name,(h,n)in EXTRAS.items():
  p=F/name
  # Match declared paths rather than guessing filename aliases.
  if not p.exists():
   matches=[R/e['path']for e in entries if pathlib.PurePosixPath(e['path']).name==name];assert len(matches)==1,(name,matches);p=matches[0]
  rel=str(p.relative_to(R))
  if rel not in by:entries.append({'path':rel,'sha256':h,'bytes':n,'PRE':None});by[rel]=entries[-1]
  else:assert by[rel]['sha256']==h and by[rel]['bytes']==n
 soft,hard=resource.getrlimit(resource.RLIMIT_NOFILE)
 need=len(entries)+64
 if soft<need:resource.setrlimit(resource.RLIMIT_NOFILE,(min(need,hard),hard))
 for e in entries:
  rp=pathlib.PurePosixPath(e['path']);assert not rp.is_absolute()and '..'not in rp.parts
  p=R/rp;assert p.resolve(strict=True)==p and J not in p.parents
  assert p.name not in ('jwt-private.pem','target.json','deploy.env','.env','.env.local','.env.test') and '.git'not in p.parts
  pre=nine(os.lstat(p));fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);op=nine(os.fstat(fd))
  held.append({'path':str(rp),'PRE':pre,'OPEN':op,'expected':e,'fd':fd})
 cap=emit('first-prospective-input-capture.json',{'scope':'FIRST_BEFORE_SOURCE_QUALIFICATION_ALL_PUBLIC_METADATA','sourceManifestSha256':hashlib.sha256(mb).hexdigest(),'sourceManifestPRE':mst,'sourceManifestOPEN':mopen,'members':len(held),'sourceMembers':2352,'files':[{k:v for k,v in x.items()if k not in ('fd','expected')}for x in held],'privateReads':0,'runtimeEffects':0})
 def verify(stage):
  rows=[]
  for x in held:
   e=x['expected'];b=read(x['fd']);post=nine(os.fstat(x['fd']));pp=nine(os.lstat(R/x['path']));h=hashlib.sha256(b).hexdigest();pre=x['PRE'];orig=e.get('PRE')
   ok=stat.S_ISREG(int(pre['mode']))and pre['nlink']=='1'and pre==x['OPEN']==post==pp and len(b)==e['bytes']and h==e['sha256']and (orig is None or orig==pre)
   rows.append({'path':x['path'],'PRE':pre,'OPEN':x['OPEN'],'POST':post,'pathPOST':pp,'originalPRE':orig,'originalNineRequired':orig is not None,'fullEOF':True,'sha256':h,'bytes':len(b),'status':'PASS'if ok else'FAIL_UNKNOWN'})
  assert mst==nine(os.fstat(mfd))==nine(os.lstat(mf));assert read(mfd)==mb
  return {'scope':'INDEPENDENT_HELD_FULL_EOF_ALL_NINE_CURRENT_AND_ORIGINAL_PROSPECTIVE_INPUTS','stage':stage,'members':len(rows),'sourceMembers':2352,'status':'PASS'if all(x['status']=='PASS'for x in rows)else'FAIL','files':rows,'allFDsHeld':True,'capture':cap,'sourceManifestSha256':hashlib.sha256(mb).hexdigest(),'privateReads':0,'runtimeEffects':0}
 initial=verify('INITIAL_BEFORE_REVIEWED_LOADERS');emit('initial-held-source-fence.json',initial)
 print(json.dumps({'stage':'INITIAL_BEFORE_REVIEW','status':initial['status'],'members':len(held),'failures':[x['path']for x in initial['files']if x['status']!='PASS'],'manifestKeys':list(m),'extraNames':list(EXTRAS),'capture':cap}),flush=True)
 if initial['status']!='PASS':sys.exit(1)
 until=time.monotonic()+7200
 while not (J/'finish-request.json').exists():
  assert time.monotonic()<until,'own review hold deadline';time.sleep(1)
 final=verify('FINAL_THROUGH_REPORT_VERDICT_PUBLICATION');final['publishedReview']={n:{'sha256':hashlib.sha256((J/n).read_bytes()).hexdigest(),'bytes':(J/n).stat().st_size}for n in ('report.md','verdict.json','raw-receipt-manifest.json')};receipt=emit('final-held-source-closure.json',final)
 print(json.dumps({'stage':'FINAL_CLOSURE','status':final['status'],'members':len(held),'closure':receipt,'failures':[x['path']for x in final['files']if x['status']!='PASS']}),flush=True)
 if final['status']!='PASS':sys.exit(1)
finally:
 for x in held:os.close(x['fd'])
 if 'mfd'in globals():os.close(mfd)
