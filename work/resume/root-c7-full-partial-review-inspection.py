import pathlib,os,stat,json,gzip,hashlib,datetime
R=pathlib.Path('/workspace/Project-Cortex');F=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns');NAME='seal-own-review.json.gz'
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in F}}
def held(p,keep=False):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);h=hashlib.sha256();parts=[]
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1
  while v:=os.read(fd,262144):
   h.update(v)
   if keep:parts.append(v)
  assert ident(a)==ident(os.fstat(fd))==ident(os.lstat(p))
  return {'path':str(p),'bytes':a.st_size,'sha256':h.hexdigest(),'identity':ident(a)},b''.join(parts)
 finally:os.close(fd)
results=[]
for root in (R/'work/resume/task04-c7-full-partial-review',R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-full-partial-review'):
 seal,raw=held(root/NAME,True);j=json.loads(gzip.decompress(raw));assert j['schema']=='INDEPENDENT_TASK04_FULL_PARTIAL_REVIEW_LITERAL_SEAL_V1' and j['root']==str(root) and j['onlyExcluded']==NAME
 assert ident(os.lstat(root))==j['rootIdentity'] and sorted(os.listdir(root))==j['rootMembers'];expected=set();total=0
 for row in j['rows']:
  rel=pathlib.Path(row['path']);assert not rel.is_absolute() and '..' not in rel.parts and row['path'] not in expected;expected.add(row['path']);p=root/rel
  assert ident(os.lstat(p))==row['identity']
  if row['kind']=='file':
   observed,_=held(p);assert observed['bytes']==row['bytes'] and observed['sha256']==row['sha256'];total+=observed['bytes']
  elif row['kind']=='directory':assert sorted(os.listdir(p))==row['members']
  else:raise AssertionError(row['kind'])
 actual=set()
 for parent,dirs,files in os.walk(root,followlinks=False):
  for n in dirs+files:
   p=pathlib.Path(parent)/n
   if p!=root/NAME:actual.add(str(p.relative_to(root)))
 assert actual==expected and j['rowCount']==len(expected)
 for ref in j['references']:
  observed,_=held(ref['path']);assert all(observed[k]==ref[k] for k in ('bytes','sha256','identity'))
 results.append({'seal':seal,'rows':len(expected),'fileBytes':total,'rootAndLiteralMembership':True})
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-full-partial-review';statusPin,statusRaw=held(Q/'status.json',True);status=json.loads(statusRaw);reportPin,_=held(Q/'report.md');assert status['verdict']=='REJECT'
result={'scope':'ROOT_FULL_REVIEW_ARTIFACT_BYTES_CURRENT_IDENTITIES_ONLY','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':results,'report':reportPin,'status':statusPin,'verdict':'REJECT','average':2.8,'runtime':'UNQUALIFIED','whole120':'HELD','rootApproval':'ABSENT_NOT_CREATED'}
p=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-full-partial-review-root-inspection.json';assert not p.exists();p.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'verdict':'REJECT','average':2.8,'rows':[r['rows'] for r in results],'fileBytes':[r['fileBytes'] for r in results],'reportSHA256':reportPin['sha256']}))
