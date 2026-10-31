"""Fresh held/mature SOURCE-only fixed-schema and256KiB boundary controls; no effects."""
from pathlib import Path
import ast,hashlib,json,os,stat,time,types,sys
B=Path(__file__).parent;E=B.parent/'epoch2';FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def sha(b):return hashlib.sha256(b).hexdigest()
held=[]
def hold(p):
 assert p.is_absolute()and p.resolve()==p
 s=p.lstat();assert time.time_ns()-max(s.st_mtime_ns,s.st_ctime_ns)>=60000000000
 assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and s.st_uid==501 and s.st_gid==20 and s.st_size<=16777216
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);r={'path':str(p),'fd':fd,'PRE':ident(s)};assert ident(os.fstat(fd))==r['PRE'];held.append(r);return r
def read(r):
 p=Path(r['path']);assert ident(p.lstat())==ident(os.fstat(r['fd']))==r['PRE'];b=bytearray();o=0
 while q:=os.pread(r['fd'],65536,o):b.extend(q);o+=len(q);assert len(b)<=int(r['PRE']['size'])
 assert len(b)==int(r['PRE']['size'])and ident(p.lstat())==ident(os.fstat(r['fd']))==r['PRE']
 h=sha(b)
 if 'sha256'in r:assert h==r['sha256']and len(b)==r['bytes']
 r.update(OPEN=ident(os.fstat(r['fd'])),POST=ident(os.fstat(r['fd'])),pathPOST=ident(p.lstat()),sha256=h,bytes=len(b),fullEOF=True);return bytes(b)
def pub(name,value):
 b=(json.dumps(value,indent=2)+'\n').encode()
 with (B/name).open('xb')as f:f.write(b);f.flush();os.fsync(f.fileno())
 return {'path':str(B/name),'sha256':sha(b),'bytes':len(b)}
def main():
 assert sys.dont_write_bytecode
 controls=[]
 def test(n,f,deny=False):
  rejected=False
  try:f()
  except (AssertionError,ValueError,TypeError,KeyError):rejected=True
  assert rejected==deny,n;controls.append({'name':n,'status':'DENIED'if deny else'PASS'})
 try:
  pr=hold(B/'bounded-source-inputs.json');sr=hold(B/'source-writers-stopped.json');plan=json.loads(read(pr));stop=json.loads(read(sr));assert stop['sourceWriters']=='STOPPED'and stop['remainingSourceWrites']==[]
  rows=[(e,hold(Path(e['path'])))for e in plan['members']]
  assert len(held)<=4096 and sum(int(r['PRE']['size'])for r in held)+2097152<=67108864
  bodies={}
  for e,r in rows:
   assert max(int(r['PRE']['mtime_ns']),int(r['PRE']['ctime_ns']))<=int(stop['stoppedUnixNs'])
   raw=read(r);assert sha(raw)==e['sha256']and len(raw)==e['bytes'];bodies[r['path']]=raw
  m=types.ModuleType('bounded_crypto_reader_source_only');m.__file__=str(B/'audit-reader.py');exec(compile(bodies[m.__file__],m.__file__,'exec',dont_inherit=True),m.__dict__)
  tree=ast.parse(bodies[m.__file__]);old=ast.parse(bodies[str(E/'audit-reader.py')])
  def fn(t,n):return next(x for x in t.body if isinstance(x,ast.FunctionDef)and x.name==n)
  for n in ('validate_native','validate_crypto_observation','private_audit','native_audit','retirement_audit','qualify_source','prepare_specs'):
   assert ast.dump(fn(tree,n),include_attributes=False)==ast.dump(fn(old,n),include_attributes=False)
  v={k:'PASS'for k in m.PASS_FIELDS};v.update(verdict='PASS',independent=True,scope='ACTUAL_PRIVATE_CUSTODY_CRYPTO_ENV_TARGET_ONLY',operation=m.OP,volume=m.V,immutableImage=m.IMAGE,candidateSha256=m.FREEZE,sourceManifestSha256='a'*64,privateSourceApprovalSha256='b'*64,actualObserverSha256='c'*64,actualPrivateCustodyCryptoEnvTargetAccepted=True,maximumPaidCalls=0,productionSharedOrLocalTarget=False,firstTransferStatusSha256='d'*64,originalDeadlineUtc='2050-01-01T00:40:00+00:00',latestRootReleaseUtc='2050-01-01T00:05:50+00:00',independentObservationHeldSeconds=20,actualNativeOutcomeAccepted=False,fullTask03=False,goalAccepted=False,historicalCustodyRepaired=False,evaluatedAtUtc='2050-01-01T00:03:00+00:00',currentTransportBindingSha256=m.CURRENT_BINDING_SHA,currentTransportBindingSixFieldsCanonical='PASS',currentTransportBindingOriginalNineFullEOFHashSize='PASS',currentTransportBindingSeparatePublicInput=True,currentBindingPublicDecisionSha256='e'*64)
  raw=m.encode_crypto_decision(v);assert set(v)==m.CRYPTO_DECISION_FIELDS and len(raw)<8192
  test('all_original11_plus_binding_and_original_windows_fixed38_fields',lambda:m.decode_crypto_decision(raw))
  maximum=b' '*(262144-len(raw))+raw;assert len(maximum)==262144
  test('maximum256KiB_encoded_input_full_schema',lambda:m.decode_crypto_decision(maximum))
  test('maximum_plus_one_denied_before_decode',lambda:m.decode_crypto_decision(b' '+maximum),True)
  test('raw_evidence_nested_payload_denied',lambda:m.encode_crypto_decision({**v,'rsa2048':{'raw':'forbidden'}}),True)
  test('additional_evidence_field_denied',lambda:m.encode_crypto_decision({**v,'rawEvidence':'x'}),True)
  test('oversized_publisher_string_denied',lambda:m.encode_crypto_decision({**v,'evaluatedAtUtc':'x'*262145}),True)
  test('original_max_paid_bool_denied',lambda:m.encode_crypto_decision({**v,'maximumPaidCalls':False}),True)
  for k in m.PASS_FIELDS:test('original_assertion_'+k+'_must_pass',lambda k=k:m.encode_crypto_decision({**v,k:'UNKNOWN'}),True)
  for k,x in [('currentTransportBindingSha256','0'*64),('currentTransportBindingSixFieldsCanonical','FAIL'),('currentTransportBindingOriginalNineFullEOFHashSize','FAIL'),('currentTransportBindingSeparatePublicInput',False),('currentBindingPublicDecisionSha256','g'*64),('independentObservationHeldSeconds',19),('historicalCustodyRepaired',True)]:test(k+'_denied',lambda k=k,x=x:m.encode_crypto_decision({**v,k:x}),True)
  for k in ('rsa2048','currentBindingPublicDecisionSha256'):
   missing={n:x for n,x in v.items()if n!=k};test('required_field_missing_'+k,lambda missing=missing:m.encode_crypto_decision(missing),True)
  test('cleanup_foreign_key_denied_before_source_or_private_access',lambda:m.cleanup_prepared({},['foreign']),True)
  test('cleanup_third_attempt_denied_before_source_or_private_access',lambda:m.cleanup_prepared({'cleanupAttempt':3},['crypto']),True)
  test('cleanup_duplicate_key_denied_before_source_or_private_access',lambda:m.cleanup_prepared({'cleanupAttempt':1},['crypto','crypto']),True)
  launcher=types.ModuleType('bounded_launcher_source_only');launcher.__file__=str(B/'audit-launcher.py');exec(compile(bodies[str(B/'audit-launcher.py')],launcher.__file__,'exec',dont_inherit=True),launcher.__dict__)
  ph=sha(bodies[str(B/'audit-plan.json')]);loaded,lease=launcher.load_reader(ph)
  assert callable(loaded.cleanup_prepared)and loaded.A==B and loaded.CRYPTO_DECISION_MAX_BYTES==262144 and lease.closecheck()is True
  lease.close();assert lease.closed
  test('held_first_use_launcher_wrong_plan_denied',lambda:launcher.load_reader('0'*64),True)
  assert 'encode_crypto_decision(value)'in ast.get_source_segment(bodies[m.__file__].decode(),fn(tree,'durable'))
  for r in held:read(r)
  receipt=pub('decision-bound-source-control-results.json',{'scope':'FRESH_256KiB_FIXED38_FIELD_SOURCE_MOCK_CONTROLS_ONLY','status':'PASS','count':len(controls),'controls':controls,'shallowCanonicalPayloadBytes':len(raw),'maxInputBytes':262144,'maxPlusOneDenied':True,'allOriginal11AndCurrentBindingFieldsPreserved':True,'allOriginalActualCustodyFunctionsASTExact':True,'allOriginalActualCustodyCapsUnchanged':True,'privateReads':0,'DockerCalls':0,'networkCalls':0,'actualAcceptance':False})
  keys=('path','PRE','OPEN','POST','pathPOST','sha256','bytes','fullEOF')
  mf=pub('bounded-source-manifest.json',{'scope':'DISTINCT_BOUND_SOURCE_PREPARATION_ONLY_NOT_INDEPENDENT_REVIEW','status':'PASS_SOURCE_MOCK_ONLY','files':[{k:r[k]for k in keys}for r in held],'sourceCount':len(held),'sourceBytes':sum(r['bytes']for r in held),'sourceWriters':'STOPPED','sourceStopSha256':sr['sha256'],'outputsSelfExcluded':True,'referenceEpoch2ClosedImmutable':True,'fullTask03':False,'goalAccepted':False,'actualPrivateAccepted':False,'actualNativeAccepted':False})
  print(json.dumps({'status':'PASS_SOURCE_MOCK_ONLY','controls':len(controls),'receipt':receipt,'manifest':mf}));return 0
 except BaseException as e:pub('bounded-source-failure.json',{'scope':'IMMUTABLE_BOUND_SOURCE_FAILURE','failureClass':type(e).__name__,'status':'FAIL','actualAcceptance':False});raise
 finally:
  for r in held:os.close(r['fd'])
if __name__=='__main__':raise SystemExit(main())
