"""Original finite Common host matrix, high descriptors, no target/network effects."""
import hashlib,json,os,resource,select,socket,sys,time,types
from pathlib import Path
J=Path(REVIEW_DIR);common=J/'common-host-fixture1.py';b=DATA[str(common)]
assert hashlib.sha256(b).hexdigest()=='3b7d195b905465275b081b32f0a934af4c232f7dafb76281c044d50e8b03dc8f'
C=types.ModuleType('independent_common_host');C.__file__=str(common);C.__name__='independent_common_host';exec(compile(b,str(common),'exec'),C.__dict__)
matrix=json.loads(DATA[str(J/'highfd-host-matrix.json')]);out=J/'independent-host1';out.mkdir()
soft,hard=resource.getrlimit(resource.RLIMIT_NOFILE)
if soft<8192:resource.setrlimit(resource.RLIMIT_NOFILE,(min(8192,hard),hard))
assert resource.getrlimit(resource.RLIMIT_NOFILE)[0]>=4096
padding=[];rows=[];checks=[];errors=[];closed=[];maxfd=0
env={'HOME':'/Users/SaintNick','PATH':'/usr/bin:/bin','LANG':'C.UTF-8','CORTEX_COORDINATOR_CWD':str(J)}
try:
 while maxfd<2400:
  assert len(OWNERS)+len(padding)+32<=4096
  fd=os.open('/dev/null',os.O_RDONLY);padding.append(fd);maxfd=max(maxfd,fd)
 assert maxfd>=2400 and len(OWNERS)+len(padding)+32<=4096
 # Direct negative original select plus four actual selector readiness outcomes.
 a,z=socket.socketpair()
 try:
  assert a.fileno()>1023
  try:select.select([a],[],[],0)
  except ValueError:checks.append({'name':'original-select-highfd-denied','status':'PASS','fd':a.fileno()})
  else:raise AssertionError('original select unexpectedly accepted')
  assert C.control_readable(a,0) is False;checks.append({'name':'selector-empty','status':'PASS'})
  start=time.monotonic();assert C.control_readable(a,.025) is False;assert time.monotonic()-start<1;checks.append({'name':'selector-timeout','status':'PASS'})
  z.send(b'x');assert C.control_readable(a,.1) is True;assert a.recv(1)==b'x';checks.append({'name':'selector-ready','status':'PASS'})
  z.close();assert C.control_readable(a,.1) is True and a.recv(1)==b'';checks.append({'name':'selector-EOF','status':'PASS'})
 finally:a.close();z.close()
 for case in matrix['cases']:
  argv=case.get('argv',[sys.executable,'-B','-c',case.get('code','')]);stdin=b'I'*case['stdinBytes'] if 'stdinBytes'in case else None
  row,stdout,stderr=C.run('j3-'+case['name'],argv,out,case['timeout'],env,input_bytes=stdin,required=False)
  assert row['failureClass']==case['failure'],(case['name'],row)
  if 'exit'in case:assert row['exitCode']==case['exit']
  assert row['terminal'] is case['terminal'] and row['closeErrors']==[]
  assert row['ownedGroup']['absenceObserved'] is True and row['ownedGroup']['unknownOwnershipNeverSignaled'] is True
  for stream,data in [('stdout',stdout),('stderr',stderr)]:
   if stream in case:assert data==case[stream].encode()
   if stream+'Retained'in case:assert len(data)==case[stream+'Retained']
   if stream+'Observed'in case:assert row['streamByteCounts'][stream]==case[stream+'Observed']
  if 'elapsedLessThan'in case:assert row['elapsedSeconds']<case['elapsedLessThan']
  if case.get('reconciliationRequired'):assert row['ownedGroup']['reconciliation'] is not None
  if case.get('knownOwnedReconciliationSignalsRequired'):assert row['ownedGroup']['reconciliation']['signals']
  rows.append(row);checks.append({'name':'host:'+case['name'],'status':'PASS','actualLocalCommand':True})
 for name,timeout,stdin in [('timeout0',0,None),('timeout191',191,None),('stdin0',1,b''),('stdin327693',1,b'X'*327693)]:
  try:C.run('j3-'+name,[sys.executable,'-B','-c','raise AssertionError("must not spawn")'],out,timeout,env,input_bytes=stdin,required=False)
  except ValueError:checks.append({'name':name,'status':'PASS','preSpawnDenied':True})
  else:raise AssertionError(name)
finally:
 for fd in padding:
  closed.append(fd)
  try:os.close(fd)
  except BaseException as e:errors.append({'fd':fd,'class':type(e).__name__,'reason':str(e)})
assert padding==closed and not errors
RESULT={'scope':'INDEPENDENT_U3_EXACT_COMMON_LOCAL_HOST_ONLY','sourceEligibility':False,'PASS':len(checks),'FAIL':0,'controls':checks,'actualHostCommands':len(rows),'originalNineComplete':len(rows)==9,'rows':rows,'sourceOwnersHeld':len(OWNERS),'paddingOwned':len(padding),'paddingCloseAttempts':len(closed),'maxHeldFD':maxfd,'peakDescriptorBoundIncludingReserved32':len(OWNERS)+len(padding)+32,'paddingAllClosedExactlyOnce':True,'sourceLedgerNotReset':True,'actualEffects':{'Docker':0,'network':0,'credentials':0,'private':0,'service':0},'fullTask03':False,'fullGoal':False}
