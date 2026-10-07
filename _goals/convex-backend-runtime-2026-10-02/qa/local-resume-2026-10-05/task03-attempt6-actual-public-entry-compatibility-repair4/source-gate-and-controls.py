"""Finite U4 source gate and author controls; no actual runner or target execution."""
import ast,hashlib,json,os,stat,subprocess,sys,time
from pathlib import Path
N=Path(__file__).resolve().parent
FIELDS=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')
def nine(s):return{k:str(getattr(s,'st_'+k))for k in FIELDS}
def sha(b):return hashlib.sha256(b).hexdigest()
def wire(v):return(json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode()
def pub(path,raw):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  v=memoryview(raw)
  while v:k=os.write(fd,v);assert k>0;v=v[k:]
  os.fsync(fd)
 finally:os.close(fd)
 return{'path':str(path),'sha256':sha(raw),'bytes':len(raw),'origin':'AUTHORED_OUTPUT_SELF_EXCLUDED'}
def body(fd,limit=16777216):
 out=[];n=0
 while True:
  b=os.read(fd,min(131072,limit+1-n))
  if not b:return b''.join(out)
  n+=len(b);assert n<=limit;out.append(b)
def capture(plan,extra=(),expected=None,owners=None):
 owned=owners if owners is not None else[];raws={};rows=[];identity=set();ledger={'files':0,'bytes':0,'maxFiles':4096,'maxBytes':67108864,'perFileBytes':16777216,'oneLedger':True,'metadataExemption':False,'futureDATAReservationBytes':sum(r['maxBytes']for r in plan['futureNamedDATA']),'futureDATAReservationFiles':len(plan['futureNamedDATA'])}
 desired={r['path']:dict(r)for r in plan['byReference']}
 desired.update({p:{'path':p,'actualPath':p}for p in plan['ownInputs']})
 desired.update({r['path']:r for r in extra})
 try:
  for path,r in sorted(desired.items()):
   actual=r.get('actualPath',path);fd=os.open(actual,os.O_RDONLY|os.O_NOFOLLOW)
   pin={'path':path,'actualPath':actual,'fd':fd,'closeAttempted':False};owned.append(pin)
   s=os.fstat(fd);pre=nine(s);now=time.time_ns()
   assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and s.st_uid==501 and s.st_gid==20
   assert 0<=s.st_size<=16777216 and now-max(s.st_mtime_ns,s.st_ctime_ns)>=60000000000
   assert nine(os.stat(actual,follow_symlinks=False))==pre
   assert(s.st_dev,s.st_ino)not in identity,'SOURCE_ALIAS';identity.add((s.st_dev,s.st_ino))
   original=(expected or{}).get(path,r).get('PRE9')
   if original is not None:assert pre==original,'ORIGINAL_NINE_CHANGED:'+path
   pin.update(PRE9=pre,capturedUnixNs=str(now),expected=r)
   ledger['files']+=1;ledger['bytes']+=s.st_size
   assert ledger['files']+ledger['futureDATAReservationFiles']<=4096
   assert ledger['bytes']+ledger['futureDATAReservationBytes']<=67108864
  # No member content is consumed until the complete declared union is held.
  for pin in owned:
   raw=body(pin['fd']);r=(expected or{}).get(pin['path'],pin['expected'])
   assert len(raw)==int(pin['PRE9']['size'])and nine(os.fstat(pin['fd']))==pin['PRE9']==nine(os.stat(pin['actualPath'],follow_symlinks=False))
   if r.get('sha256')is not None:assert(sha(raw),len(raw))==(r['sha256'],r['bytes']),'SOURCE_HASH_CHANGED'
   row={k:v for k,v in pin.items()if k not in('fd','expected')};row.update(sha256=sha(raw),bytes=len(raw),fullEOF=True)
   rows.append(row);raws[pin['path']]=raw
  return owned,rows,raws,ledger
 except BaseException:
  # Caller owns every successful open even when capture/qualification fails.
  raise
def close_all(owned):
 calls=[]
 for p in owned:
  if p['closeAttempted']:continue
  p['closeAttempted']=True;c={'path':p['path'],'fd':p['fd'],'attempt':1,'error':None}
  try:os.close(p['fd'])
  except BaseException as e:c['error']={'type':type(e).__name__,'message':str(e)}
  calls.append(c)
 return calls
def final_verify(owned,rows):
 expected={r['path']:r for r in rows};out=[]
 for p in owned:
  q={'path':p['path'],'exact':False}
  try:
   before=nine(os.fstat(p['fd']));os.lseek(p['fd'],0,0);raw=body(p['fd']);after=nine(os.fstat(p['fd']));pathnine=nine(os.stat(p['actualPath'],follow_symlinks=False));r=expected[p['path']]
   q.update(fullEOF=True,sha256=sha(raw),bytes=len(raw),before9=before,after9=after,pathAfter9=pathnine,exact=before==after==pathnine==r['PRE9']and(sha(raw),len(raw))==(r['sha256'],r['bytes']))
  except BaseException as e:q['error']={'type':type(e).__name__,'message':str(e)}
  out.append(q)
 return out
def command(rawdir,label,interpreter,source,path,payload=None):
 bootstrap="globals().update(__name__='__main__',__file__="+repr(path)+");exec(compile("+repr(source.decode())+","+repr(path)+",'exec',dont_inherit=True))"
 argv=[interpreter,'-B','-c',bootstrap];begin=time.time_ns()
 p=subprocess.run(argv,input=wire(payload)if payload is not None else None,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=45,env={'HOME':'/Users/SaintNick','PATH':'/usr/bin:/bin:/opt/homebrew/bin','LANG':'C.UTF-8'})
 assert len(p.stdout)<=262144 and len(p.stderr)<=262144
 outpin=pub(rawdir/(label+'.stdout'),p.stdout);errpin=pub(rawdir/(label+'.stderr'),p.stderr)
 receipt={'scope':'AUTHOR_SOURCE_MOCK_COMMAND_ONLY','label':label,'interpreter':interpreter,'flags':['-B'],'sourcePath':path,'sourceSha256':sha(source),'sourceBytes':len(source),'inputBytes':len(wire(payload))if payload is not None else 0,'exitCode':p.returncode,'startedUnixNs':str(begin),'endedUnixNs':str(time.time_ns()),'timeoutSeconds':45,'perPipeBytes':262144,'stdout':outpin,'stderr':errpin,'Docker':False,'private':False,'service':False,'actualRunner':False}
 rpin=pub(rawdir/(label+'.command.json'),wire(receipt))
 assert p.returncode==0,(label,p.stderr.decode()[:1000])
 result=json.loads(p.stdout);assert result['status']=='PASS'
 return result,[outpin,errpin,rpin]
def run(plan,author_gate):
 owned=[];rows=[];raws={};ledger=None;primary=None;final=[];closecalls=[];outputs=[];counts={};results={}
 try:
  owned,rows,raws,ledger=capture(plan,owners=owned)
  assert raws[str(N/'source-gate-and-controls.py')]==author_gate,'GATE_AUTHOR_BYTES_CHANGED'
  assert json.loads(raws[str(N/'source-inputs-plan.json')])==plan
  stopped=json.loads(raws[str(N/'source-writers-stopped.json')]);assert stopped['writerState']=='STOPPED'and stopped['remainingSourceWrites']==[]
  for r in stopped['sourcePins']:
   assert(sha(raws[r['path']]),len(raws[r['path']]))==(r['sha256'],r['bytes'])
  U3=N.parent/'task03-attempt6-actual-public-custody-readiness-repair3'
  rawdir=N/'source-control-raw';rawdir.mkdir(mode=0o700)
  # Complete parent source cohort stays held through every control and raw publication.
  result,pins=command(rawdir,'original97','/opt/homebrew/bin/python3',raws[str(N/'source-fault-controls4.py')],str(N/'source-fault-controls4.py'));results['original97']=result;outputs+=pins
  assert result['count']==97
  rowmap={r['path']:r for r in rows}
  for child in result['sourceInputs']:
   parent=rowmap[child['path']];assert child['PRE9']==parent['PRE9']and(child['sha256'],child['bytes'])==(parent['sha256'],parent['bytes'])and child['closeAttempted']is True
  payload={'entry':raws[str(N/'actual-entry.py')].decode(),'entryPath':str(N/'actual-entry.py'),'fixture':str(U3/'fixtures/owned-entry-3.py'),'fixturePin':rowmap[str(U3/'fixtures/owned-entry-3.py')]}
  wiring_payload={'entry':payload['entry'],'oldEntry':raws[str(U3/'actual-entry.py')].decode(),'runner':raws[str(N/'run-actual-review.py')].decode(),'oldRunner':raws[str(U3/'run-actual-review.py')].decode()}
  for label,interpreter in(('exact39','/usr/bin/python3'),('supported314','/opt/homebrew/bin/python3')):
   result,pins=command(rawdir,'entry-'+label,interpreter,raws[str(N/'entry-compatibility-controls.py')],str(N/'entry-compatibility-controls.py'),payload);results['entry-'+label]=result;outputs+=pins;assert result['count']==28 and result['entrySha256']==sha(raws[str(N/'actual-entry.py')])
   result,pins=command(rawdir,'wiring-'+label,interpreter,raws[str(N/'successor-wiring-controls.py')],str(N/'successor-wiring-controls.py'),wiring_payload);results['wiring-'+label]=result;outputs+=pins;assert result['count']==16
  counts={k:{'count':r['count'],'PASS':sum(c['status']=='PASS'for c in r['controls']),'FAIL':sum(c['status']!='PASS'for c in r['controls'])}for k,r in results.items()}
 except BaseException as e:primary={'type':type(e).__name__,'message':str(e)}
 finally:
  if owned:final=final_verify(owned,rows)
  closecalls=close_all(owned)
 receipt={'scope':'U4_AUTHOR_SOURCE_AND_CONTROLS_QUALIFICATION_ONLY','sourceEligibility':False,'independentReview':False,'runtimeAuthority':False,'sourceRows':rows,'sourceLedger':ledger,'sourceAllFDsBeforeBody':len(rows)==len(owned)and len(rows)>0,'primaryFailure':primary,'allFinalChecks':final,'allCloseCalls':closecalls,'closeErrors':[c for c in closecalls if c['error']],'closeRetries':0,'authorControlCounts':counts,'rawOutputs':outputs,'sourceWriters':'STOPPED','rawOutputWriters':'STOPPED','remainingWrites':[],'allOldFailedPinsUnchanged':True,'Docker':False,'private':False,'service':False,'actualRunner':False,'nativePrivate':False,'fullTask03':False,'fullGoal':False}
 qpin=pub(N/'source-run1-receipt.json',wire(receipt))
 stop=pub(N/'source-controls-writer-stop.json',wire({'scope':'U4_SOURCE_CONTROL_OUTPUT_STOP','writerState':'STOPPED','remainingWrites':[],'authorStoppedUnixNs':str(time.time_ns()),'outputs':outputs+[qpin],'sourceOnly':True,'sourceEligibility':False}))
 print(json.dumps({'receipt':qpin,'stop':stop,'counts':counts,'ledger':ledger,'primaryFailure':primary,'finalExact':sum(r.get('exact')is True for r in final),'finalCount':len(final),'closeAttempts':len(closecalls),'closeErrors':[c for c in closecalls if c['error']],'rawOutputs':outputs},sort_keys=True),flush=True)
 return 0 if primary is None and final and all(r['exact']for r in final)and not receipt['closeErrors']else 1
