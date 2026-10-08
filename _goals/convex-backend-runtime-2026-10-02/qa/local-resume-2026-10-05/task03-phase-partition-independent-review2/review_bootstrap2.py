import os,sys,time,json,hashlib,stat,types,traceback
from pathlib import Path
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
D=P/'task03-phase-partition-independent-review2';A=P/'task03-f2-phase-contract-repair5';ORIGINAL=P/'task03-f2-phase-partition-repair4'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
rows=[];data={};mods={};headers={};pins=None;events=[]
def nine(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def capture(path):
 p=Path(path);s=os.lstat(p);assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and p.resolve()==p
 age=time.time()-max(s.st_mtime,s.st_ctime);assert age>=240,(str(p),'current_maturity',age)
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);r={'path':str(p),'fd':fd,'initial':nine(s),'age_seconds':age,'reads':0,'closes':0}
 rows.append(r);assert r['initial']==nine(os.fstat(fd))==nine(os.lstat(p));return r
def read(r):
 assert r['reads']==0;parts=[]
 while True:
  b=os.read(r['fd'],65536)
  if not b:break
  parts.append(b)
 raw=b''.join(parts);assert len(raw)==int(r['initial']['size'])<=16777216
 r['bytes']=len(raw);r['sha256']=hashlib.sha256(raw).hexdigest();r['reads']=1
 assert r['initial']==nine(os.fstat(r['fd']))==nine(os.lstat(r['path']));return raw
def final_and_close():
 for r in rows:
  parts=[];offset=0
  while True:
   b=os.pread(r['fd'],65536,offset)
   if not b:break
   offset+=len(b);parts.append(b)
  raw=b''.join(parts);assert len(raw)==r['bytes'] and hashlib.sha256(raw).hexdigest()==r['sha256']
  r['final_fullEOF_hash_size']=True;r['final']=nine(os.fstat(r['fd']));assert r['initial']==r['final']==nine(os.lstat(r['path']))
 errors=[]
 for r in rows:
  try:os.close(r['fd']);error=None
  except BaseException as e:error=type(e).__name__;errors.append(error)
  r['closes']=1;r['close_error']=error
 assert not errors,errors
try:
 own=[capture(Path(__file__)),capture(D/'writer-stop-runner2.json')]
 for r in own:read(r)
 print(json.dumps({'state':'OWN_ACTOR_CAPTURED','minimumOwnAge':min(r['age_seconds']for r in own),'successorBodiesRead':False}),flush=True)
 for line in sys.stdin:
  q=json.loads(line);op=q['op']
  if op=='headers':
   assert not headers
   hs=[capture(A/q['pinsName']),capture(A/q['stopName'])]
   for r,sz,sha in zip(hs,[q['pinsBytes'],q['stopBytes']],[q['pinsSha256'],q['stopSha256']]):
    raw=read(r);assert (r['bytes'],r['sha256'])==(sz,sha);headers[Path(r['path']).name]=raw
   pins=json.loads(headers[q['pinsName']]);stop=json.loads(headers[q['stopName']])
   print(json.dumps({'pins':pins,'stop':stop},sort_keys=True),flush=True)
   events.append({'event':'STOP_AND_PIN_HEADERS_FD_FIRST_STAGED_DISCOVERY'})
  elif op=='members':
   assert pins is not None
   members=pins['members'];paths=[R/x['path']if not Path(x['path']).is_absolute()else Path(x['path'])for x in members]
   assert len(paths)==len(set(paths))==17 and sum(x['bytes']for x in members)==170323
   review1=P/'task03-phase-partition-independent-review1'
   assert all(x.is_relative_to(A)or x.is_relative_to(ORIGINAL)or x.is_relative_to(review1)for x in paths),'undeclared_external_scope'
   actual={x for x in A.rglob('*')if x.is_file()}
   assert actual=={x for x in paths if x.is_relative_to(A)}|{A/x for x in headers},'finite_inventory_drift'
   rs=[capture(x)for x in paths];events.append({'event':'ALL_SUCCESSOR_MEMBER_FDS_BEFORE_FIRST_MEMBER_BODY','count':len(rs)})
   for r,pin in zip(rs,members):
    raw=read(r);assert (r['bytes'],r['sha256'])==(pin['bytes'],pin['sha256']);data[Path(r['path']).name]=raw
   print(json.dumps({'members':len(rs),'bytes':sum(r['bytes']for r in rs),'allPublicationPinsMatched':True}),flush=True)
  elif op=='originals':
   assert 'original_phase2' not in data
   rs=[capture(ORIGINAL/'phase_partition2.py'),capture(ORIGINAL/'partition_controls2.py')]
   for r,key,sz,sha in zip(rs,['original_phase2','original_controls2'],[22854,18650],['1e4d003a0b0c18a194ea8be7439283d6c9690e84319916c5fa962e546a5608c6','02a38a688e507b44ef049d57c94a038303bbb70546b7492dd2268a43568ea5dc']):
    raw=read(r);assert (r['bytes'],r['sha256'])==(sz,sha);data[key]=raw
   events.append({'event':'EXACT_TWO_ORIGINAL_SOURCE_INPUT_FDS_BEFORE_BODIES'});print('ORIGINAL_SOURCE_PINS_MATCHED',flush=True)
  elif op=='show':
   lines=data[q['name']].decode().splitlines();lo=q.get('start',1);hi=q.get('end',len(lines));print('\n'.join(f'{i+1}: {lines[i]}'for i in range(lo-1,min(hi,len(lines)))),flush=True)
  elif op=='json':
   val=json.loads(data[q['name']])
   for key in q.get('keys',[]):val=val[key]
   print(json.dumps(val,indent=2,sort_keys=True),flush=True)
  elif op=='load':
   m=types.ModuleType('review2_successor');m.__file__=str(A/q['name']);sys.modules[m.__name__]=m
   exec(compile(data[q['name']],m.__file__,'exec'),m.__dict__);mods['phase_candidate']=m;print('SUCCESSOR_LOADED_FROM_CAPTURED_BYTES',flush=True)
  elif op=='cases':
   rs=[capture(D/q['caseName']),capture(D/q['stopName'])]
   raw=read(rs[0]);st=json.loads(read(rs[1]));assert st['state']=='STOPPED' and st['remainingCodeWrites']==[]
   assert (len(raw),hashlib.sha256(raw).hexdigest())==(st['codeBytes'],st['codeSha256'])
   ns={'mods':mods,'data':data,'D':D,'A':A,'ORIGINAL':ORIGINAL,'json':json,'Path':Path}
   exec(compile(raw,str(D/q['caseName']),'exec'),ns)
  elif op=='finish':
   final_and_close();receipt={'state':'STOPPED','scope':'INDEPENDENT_SOURCE_MOCK_REVIEW_CUSTODY_NOT_SOURCE_ELIGIBILITY','events':events,'rows':[{k:v for k,v in x.items()if k!='fd'}for x in rows],'closeErrors':0,'stagedDiscoveryNotAllFDsBeforeFirstHeader':True,'actualClocksStarted':False,'effects':0}
   (D/'acquisition-raw1.json').write_text(json.dumps(receipt,indent=2,sort_keys=True)+'\n');print(json.dumps({'closedRows':len(rows),'closeErrors':0}),flush=True);break
  else:raise ValueError(op)
except BaseException as e:
 traceback.print_exc();errors=[]
 for r in rows:
  if not r['closes']:
   try:os.close(r['fd']);error=None
   except BaseException as c:error=type(c).__name__;errors.append(error)
   r['closes']=1;r['close_error']=error
 (D/'acquisition-failure1.json').write_text(json.dumps({'state':'DENIED','exception':type(e).__name__,'message':str(e),'closeErrors':errors,'rows':[{k:v for k,v in x.items()if k!='fd'}for x in rows]},indent=2,sort_keys=True)+'\n')
 sys.exit(1)
