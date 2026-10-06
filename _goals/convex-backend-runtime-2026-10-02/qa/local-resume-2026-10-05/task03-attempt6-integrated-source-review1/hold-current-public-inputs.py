import os,json,hashlib,pathlib,time,resource,stat,sys
R=pathlib.Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
J=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-integrated-source-review1'
P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-integrated-preparation'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def nine(st):return {k:str(getattr(st,'st_'+k)) for k in FIELDS}
def strict(raw):
 def obj(pairs):
  out={}
  for k,v in pairs:
   if k in out:raise AssertionError('duplicate JSON field')
   out[k]=v
  return out
 return json.loads(raw,object_pairs_hook=obj,parse_constant=lambda x:(_ for _ in ()).throw(AssertionError('nonfinite JSON')))
def output(name,value):
 raw=(json.dumps(value,indent=2,sort_keys=True)+'\n').encode();fd=os.open(J/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 try:os.write(fd,raw);os.fsync(fd)
 finally:os.close(fd)
 return {'path':name,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
def raw(fd):
 os.lseek(fd,0,0);h=hashlib.sha256();n=0
 while True:
  b=os.read(fd,262144)
  if not b:break
  n+=len(b);h.update(b)
 return n,h.hexdigest()
def readfd(fd):
 os.lseek(fd,0,0);a=[]
 while True:
  b=os.read(fd,262144)
  if not b:break
  a.append(b)
 return b''.join(a)
soft,hard=resource.getrlimit(resource.RLIMIT_NOFILE)
if soft<4096:resource.setrlimit(resource.RLIMIT_NOFILE,(min(4096,hard),hard))
held=[];errors=[]
try:
 mf=P/'operative-source-manifest.json';mfd=os.open(mf,os.O_RDONLY|os.O_NOFOLLOW);mst=nine(os.fstat(mfd));mb=readfd(mfd);m=strict(mb)
 assert hashlib.sha256(mb).hexdigest()=='d1012a242bcf52899d63199798ae9c97b821ca04acc00a29db164e889cfff7f1'
 entries=list(m['files']); extras=[('operative-source-manifest.json','d1012a242bcf52899d63199798ae9c97b821ca04acc00a29db164e889cfff7f1',3093855),('preparation-report.md','d853279930cd6f8eec10c551e42f321707ac824d0d31f100656520f4b7e0cd93',12690),('source-writers-stopped.json','1e922c062f6fad651243f59f8bab4a42409725ddc118454f4e629ccaa705ad68',7716),('source-closure-handoff.json','70a76cd038530f2fa80a56a0935cf35bac353eeabb2dc60acbfa2c9465cb81f4',530),('final-reporting-receipt.json','dec5f8483aa9bbe6b6f12b571dbba05129d044775398dc53c4289092a3345d64',13813)]
 by={e['path']:e for e in entries};assert len(by)==len(entries)==2226
 for name,digest,size in extras:
  rel=str((P/name).relative_to(R))
  if rel not in by:entries.append({'path':rel,'sha256':digest,'bytes':size,'originalPRERequired':False})
 for e in entries:
  rel=pathlib.PurePosixPath(e['path']);assert not rel.is_absolute() and '..' not in rel.parts
  p=R/rel;assert p.resolve(strict=True)==p and J not in p.parents
  st=os.lstat(p);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);fst=os.fstat(fd)
  held.append({'path':str(rel),'PRE':nine(st),'OPEN':nine(fst),'expected':e,'fd':fd})
 capture={'scope':'FIRST_PROSPECTIVE_ALL_CURRENT_PUBLIC_INPUTS_BEFORE_FIRST_SOURCE_QUALIFICATION','observedUnixNs':str(time.time_ns()),'sourceManifestSHA':hashlib.sha256(mb).hexdigest(),'sourceMembers':2226,'currentMembers':len(held),'files':[{k:v for k,v in x.items() if k not in ('fd','expected')} for x in held],'privateAccess':False,'externalEffects':False}
 cap=output('first-prospective-current-input-manifest.json',capture)
 def verify(stage):
  result=[]
  for x in held:
   e=x['expected'];p=R/x['path'];fd=x['fd'];n,h=raw(fd);post=nine(os.fstat(fd));pst=nine(os.lstat(p));original=e.get('PRE')
   ok=stat.S_ISREG(int(x['PRE']['mode'])) and x['PRE']['nlink']=='1' and x['PRE']==x['OPEN']==post==pst and n==e['bytes'] and h==e['sha256'] and (original is None or original==x['PRE'])
   result.append({'path':x['path'],'status':'PASS' if ok else 'FAIL_UNKNOWN','originalPRERequired':original is not None,'sha256':h,'bytes':n,'POST':post,'pathPOST':pst})
  assert mst==nine(os.fstat(mfd))==nine(os.lstat(mf))
  return {'scope':'PUBLIC_SOURCE_CURRENT_AND_ORIGINAL_PRE_NINE_FULL_EOF_ONLY','stage':stage,'status':'PASS' if all(x['status']=='PASS' for x in result) else 'FAIL','members':len(result),'files':result,'allFDsHeld':True,'privateAccess':False,'externalEffects':False}
 initial=verify('INITIAL_AFTER_ALL_PRE_CAPTURE');output('initial-current-fence.json',initial)
 print(json.dumps({'phase':'SOURCE_BASELINE_HELD','status':initial['status'],'sourceMembers':2226,'currentMembers':len(held),'capture':cap}),flush=True)
 if initial['status']!='PASS':sys.exit(1)
 until=time.monotonic()+3600
 while not (J/'finish-request.json').exists():
  if time.monotonic()>until:raise AssertionError('review FD hold deadline exceeded')
  time.sleep(1)
 final=verify('FINAL_THROUGH_REVIEW_PUBLICATION');final['capture']=cap;output('final-current-source-closure.json',final)
 print(json.dumps({'phase':'SOURCE_BASELINE_FINAL','status':final['status'],'currentMembers':len(held),'allFDsHeldThroughFinal':True}),flush=True)
 if final['status']!='PASS':sys.exit(1)
finally:
 for x in held:os.close(x['fd'])
 try:os.close(mfd)
 except NameError:pass
