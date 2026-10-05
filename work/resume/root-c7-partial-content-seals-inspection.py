import os,stat,gzip,json,hashlib,pathlib,datetime,time
R=pathlib.Path('/workspace/Project-Cortex');NAME='seal-c7-content.json.gz'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def held(p,keep=False):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);chunks=[];h=hashlib.sha256();n=0
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1 and ident(a)==ident(os.lstat(p))
  while v:=os.read(fd,1048576):
   h.update(v);n+=len(v)
   if keep:chunks.append(v)
  assert n==a.st_size and ident(a)==ident(os.fstat(fd))==ident(os.lstat(p))
  return {'path':str(p),'bytes':n,'sha256':h.hexdigest(),'identity':ident(a)},b''.join(chunks)
 finally:os.close(fd)
parser=R/'work/resume/root-c7-static-stream-json.py'
parserPin,source=held(parser,True);namespace={'__name__':'root_static_json_reader'};exec(compile(source,str(parser),'exec'),namespace)
roots=[R/'work/resume/task04-c7-partial-content-backing',pathlib.Path('/dev/shm/cortex-root-c7-partial-content-backing'),R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-partial-content-backing']
hashes=['785e7faba51d1dc93e83f0227743ceede00784f6dddb50095a46048c6d6f6bc0','9969cc5b97dbfc434e00ede2e4c5fa332188fbf5f90c1fa9efcb6c5db0b0618f','c6d686f225159058da1d439edeb5742fd80935456db1f76b48e5f68480adf515']
results=[];start=time.monotonic()
for root,sha in zip(roots,hashes):
 seal=root/NAME;sealPin,_=held(seal);assert sealPin['sha256']==sha
 expected=set();counts={'file':0,'directory':0,'symlink':0};total=[0]
 def row(key,r):
  rel=pathlib.Path(r['path']);assert not rel.is_absolute() and '..' not in rel.parts and r['path'] not in expected and rel!=pathlib.Path(NAME)
  expected.add(r['path']);p=root/rel;a=os.lstat(p);assert ident(a)==r['identity'],str(p)
  counts[r['kind']]+=1
  if r['kind']=='file':
   pin,_=held(p);assert pin['bytes']==r['bytes'] and pin['sha256']==r['sha256'];total[0]+=pin['bytes']
  elif r['kind']=='directory':assert stat.S_ISDIR(a.st_mode) and sorted(os.listdir(p))==r['members'] and ident(a)==ident(os.lstat(p))
  elif r['kind']=='symlink':
   target=os.readlink(p);assert stat.S_ISLNK(a.st_mode) and target==r['literalTarget'] and len(os.fsencode(target))==r['literalTargetBytes'] and hashlib.sha256(os.fsencode(target)).hexdigest()==r['literalTargetSHA256'] and ident(a)==ident(os.lstat(p))
  else:raise AssertionError(r['kind'])
 fd=os.open(seal,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert ident(os.fstat(fd))==sealPin['identity']
  with os.fdopen(os.dup(fd),'rb') as inp:
   with gzip.GzipFile(fileobj=inp,mode='rb') as stream:
    def chunks():
     while b:=stream.read(16384):yield b
    reader=namespace['Reader'](chunks(),valueLimit=4*1024*1024)
    meta=reader.top(arrayKeys=('rows',),item=row)
  assert ident(os.fstat(fd))==ident(os.lstat(seal))==sealPin['identity']
 finally:os.close(fd)
 assert meta['schema']=='C7_PARTIAL_CONTENT_TRANSPORT_STREAM_SEAL_V1' and meta['root']==str(root) and meta['exclusion']=='ONLY_OWN_ROOT_'+NAME
 assert meta['rootIdentity']==ident(os.lstat(root)) and meta['rootMembers']==sorted(os.listdir(root))
 assert meta['rowCount']==len(expected) and meta['kindCounts']==counts and meta['fileBytes']==total[0]
 actual=set()
 for parent,dirs,files in os.walk(root,followlinks=False):
  for name in dirs+files:
   p=pathlib.Path(parent)/name
   if p!=seal:actual.add(str(p.relative_to(root)))
 assert actual==expected
 for ref in meta['references']:
  pin,_=held(ref['path']);assert all(pin[k]==ref[k] for k in ('bytes','sha256','identity'))
 results.append({'seal':sealPin,'rows':len(expected),'kindCounts':counts,'fileBytes':total[0],'rootIdentityAndLiteralMembership':True,'readerPeakBuffer':reader.peakBuffer,'references':len(meta['references'])})
result={'scope':'ROOT_FROZEN_CURRENT_C7_LITERAL_BYTES_ONLY_NOT_RUNTIME_OR_HISTORICAL_CUSTODY','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':time.monotonic()-start,'parser':parserPin,'results':results,'original122':'HELD','whole120':'UNQUALIFIED','rootApproval':'ABSENT_NOT_CREATED'}
p=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-partial-content-seals-root-inspection.json';assert not p.exists();p.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ('parser','results')}));print(json.dumps([{'rows':r['rows'],'fileBytes':r['fileBytes']} for r in results]))
