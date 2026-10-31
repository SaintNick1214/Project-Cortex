"""U4 publication-only successor; unchanged runtime and original130 source tuples."""
import hashlib,json,os,stat,time
from pathlib import Path
E=Path(__file__).resolve().parent;N=E.parent
OLD_MF=json.loads("{\"bytes\":115054,\"origin\":\"PUBLISHER_SELF_EXCLUDED_UNTIL_ROOT_MATURE_READBACK\",\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-actual-public-entry-compatibility-repair4/closed-source-reference-manifest.json\",\"sha256\":\"07f5f07de30c604771da013883e62d37e523aa723fbb69baf61990bc4b1d5cd3\"}")
F=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')
CONTROLS=json.loads("[{\"bytes\":5077,\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-actual-public-entry-compatibility-repair4/publication-epoch2/publication-fault-controls2.py\",\"sha256\":\"0e1b0e4b7e1b181bc7cc782fbe28be79b6997ad400bdd08759ae161f322cf791\"},{\"bytes\":4145,\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-actual-public-entry-compatibility-repair4/publication-epoch2/publication-fault-control-source2-stop.json\",\"sha256\":\"f99a6be9563b5602f2f59ca44539364543a735c269bae170af136149f2879b3b\"}]")
OLD_TWO=[str(N/'final-publication.py'),str(N/'final-publication-writers-stopped.json')]
def sha(b):return hashlib.sha256(b).hexdigest()
def wire(v):return(json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode()
def nine(s):return{k:str(getattr(s,'st_'+k))for k in F}
def body(fd):
 out=[];size=0
 while True:
  b=os.read(fd,min(131072,16777217-size))
  if not b:return b''.join(out)
  size+=len(b);assert size<=16777216;out.append(b)
def publish(path,raw):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  v=memoryview(raw)
  while v:k=os.write(fd,v);assert k>0;v=v[k:]
  os.fsync(fd)
 finally:os.close(fd)
 return{'path':str(path),'sha256':sha(raw),'bytes':len(raw),'publisherSelfExcluded':True}
def err(e,seen=None):
 seen=set()if seen is None else seen
 if id(e)in seen:return{'type':type(e).__name__,'message':str(e),'alreadyRecorded':True}
 seen.add(id(e));r={'type':type(e).__name__,'message':str(e)}
 children=getattr(e,'exceptions',())
 if children:r['originalChildren']=[err(c,seen)for c in children]
 cause=getattr(e,'__cause__',None)
 if cause is not None:r['originalCause']=err(cause,seen)
 return r
def main(author,stop):
 owned=[];raws={};rows=[];outputs=[];failures=[];final=[];calls=[];originals=[];old_two=[];ledger=None;conservation=None
 def acquire(r):
  path=r['path'];actual=r.get('actualPath',path);fd=os.open(actual,os.O_RDONLY|os.O_NOFOLLOW)
  try:
   p={'path':path,'actualPath':actual,'fd':fd,'expected':r,'closeAttempted':False};owned.append(p)
  except BaseException as registration:
   try:os.close(fd)
   except BaseException as close:
    aggregate=BaseException('publication registration/owned-close failures');aggregate.exceptions=(registration,close);raise aggregate from registration
   raise
  s=os.fstat(fd);pre=nine(s);now=time.time_ns();p.update(PRE9=pre,capturedUnixNs=str(now))
  assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and s.st_uid==501 and s.st_gid==20 and 0<=s.st_size<=16777216
  assert now-max(s.st_mtime_ns,s.st_ctime_ns)>=60000000000,'NOT_MATURE:'+path
  assert pre==nine(os.stat(actual,follow_symlinks=False))
  if r.get('PRE9')is not None:assert pre==r['PRE9'],'OLD_ORIGINAL_NINE_CHANGED:'+path
  assert all((q.get('PRE9',{}).get('dev'),q.get('PRE9',{}).get('ino'))!=(pre['dev'],pre['ino'])for q in owned[:-1]),'ALIAS'
  assert len(owned)<=4096 and sum(int(q['PRE9']['size'])for q in owned)<=67108864
 def read(p):
  os.lseek(p['fd'],0,0);b=body(p['fd']);r=p['expected']
  assert(sha(b),len(b))==(r['sha256'],r['bytes'])
  assert p['PRE9']==nine(os.fstat(p['fd']))==nine(os.stat(p['actualPath'],follow_symlinks=False))
  raws[p['path']]=b
  return b
 def verify():
  out=[]
  for i,p in enumerate(owned):
   q={'index':i,'path':p['path'],'exactNineHashEOF':False}
   try:
    before=nine(os.fstat(p['fd']));os.lseek(p['fd'],0,0);b=body(p['fd']);after=nine(os.fstat(p['fd']));pathafter=nine(os.stat(p['actualPath'],follow_symlinks=False));r=p['expected'];ok=before==after==pathafter==p['PRE9']and(sha(b),len(b))==(r['sha256'],r['bytes'])
    q.update(exactNineHashEOF=ok,fullEOF=True,sha256=sha(b),bytes=len(b))
    if not ok:q.update(before9=before,after9=after,pathAfter9=pathafter,expected=p['PRE9'])
   except BaseException as e:q['error']=err(e)
   out.append(q)
  return out
 try:
  bootstrap=[OLD_MF,{'path':str(E/'publication-final.py'),'sha256':sha(author),'bytes':len(author)},{'path':str(E/'final-source-writers-stopped.json'),'sha256':sha(stop),'bytes':len(stop)}]+CONTROLS
  for r in bootstrap:acquire(r)
  # Five declared locator/source controls held together before any bootstrap body; retained.
  for p in owned:read(p)
  prior=json.loads(raws[OLD_MF['path']]);ss=json.loads(raws[str(E/'final-source-writers-stopped.json')])
  assert ss['writerState']=='STOPPED'and ss['remainingSourceWrites']==[]
  assert prior['scope']=='U4_CLOSED_FINITE_SOURCE_CONTROL_REFERENCE_MANIFEST_ONLY'and prior['sourceEligibility']is False and len(prior['inputs'])==132
  old_two=[r for r in prior['inputs']if r['path']in OLD_TWO];originals=[r for r in prior['inputs']if r['path']not in OLD_TWO]
  assert len(old_two)==2 and len(originals)==130
  assert sum(r['bytes']for r in old_two)==17951 and sum(r['bytes']for r in originals)==2488403
  for r in originals:acquire(r)
  assert len(owned)==135
  # Complete remaining union is held before all other member content; no body of old two opens.
  for p in owned:read(p)
  for p in owned:rows.append({'path':p['path'],'actualPath':p['actualPath'],'PRE9':p['PRE9'],'capturedUnixNs':p['capturedUnixNs'],'sha256':p['expected']['sha256'],'bytes':p['expected']['bytes'],'fullEOF':True,'pinOrigin':'OLD132_UNCHANGED_ORIGINAL'if p['path']in{r['path']for r in originals}else'DISTINCT_NEW_PROSPECTIVE_DOCUMENT_OR_SOURCE'})
  original113=json.loads(raws[str(N/'source-run1-receipt.json')]);old130={r['path']:r for r in originals}
  assert len(original113['sourceRows'])==113
  for r in original113['sourceRows']:
   q=old130[r['path']];assert r['PRE9']==q['PRE9']and(r['sha256'],r['bytes'])==(q['sha256'],q['bytes'])
  for path,digest,size in((str(N/'actual-entry.py'),'5846914b6bc7a519bb507d6f6ab678f060ce95acd753989dd6ea0cdf8b236fee',2544),(str(N/'run-actual-review.py'),'3ad49025f244024ec8fd9301fe39663d0532193a294298734f8181944d69debc',31543)):
   assert(sha(raws[path]),len(raws[path]))==(digest,size)
  active=json.loads(raws[str(N/'exact-entry-and-handoff-contract.json')])['namedReviewedSources'];assert len(active)==5
  physical=sum(r['bytes']for r in rows);newbytes=OLD_MF['bytes']+len(author)+len(stop)+sum(r['bytes']for r in CONTROLS)
  ledger={'oneCumulativeLedger':True,'oldChargedAdmissions':132,'oldChargedBytes':2506354,'newChargedAdmissions':5,'newChargedBytes':newbytes,'chargedAdmissions':137,'chargedBytes':2506354+newbytes,'currentHeldFiles':135,'currentHeldBytes':physical,'inactiveOldTwoAdmissionsAndBytesStillCharged':True,'futureDATAReservationBytes':49152,'futureDATAReservationFiles':2,'maxFiles':4096,'maxBytes':67108864,'perFileBytes':16777216,'noReset':True,'metadataExemption':False}
  assert ledger['chargedAdmissions']+2<=4096 and ledger['chargedBytes']+49152<=67108864
  final=verify();assert all(q['exactNineHashEOF']for q in final)
  control_ns={'__name__':'HELD_AUTHOR_SOURCE_MOCK_CONTROLS','__file__':CONTROLS[0]['path']}
  exec(compile(raws[CONTROLS[0]['path']],CONTROLS[0]['path'],'exec',dont_inherit=True),control_ns)
  control_result=control_ns['run'](raws[str(E/'publication-final.py')].decode());assert control_result['status']=='PASS'and control_result['count']==26
  conservation={'publisherFaultControls':control_result,'scope':'U4_EXACT130_ORIGINALS_TWO_PUBLICATION_SOURCE_REPLACEMENTS_ONLY','oldSourceManifestHistoricalDocument':OLD_MF,'unchangedOriginalRows':[{'path':r['path'],'PRE9':r['PRE9'],'sha256':r['sha256'],'bytes':r['bytes'],'fullEOF':True}for r in originals],'unchangedOriginalCount':130,'original113Count':113,'original113Preserved':True,'oldTwoRejectedNonoperativePreimageRows':old_two,'oldTwoBodiesOpened':False,'oldTwoMetadataGap':'ROOT_JUDGE_REPORTED_CTIME_ONLY_UNKNOWN_NOT_REPAIRED','replacementSourcePaths':[str(E/'publication-final.py'),str(E/'final-source-writers-stopped.json')],'runtimeActiveSources':active,'runtimeBytesChanged':False,'observerCommonBytesChanged':False,'controlMatrixRerun':False,'oldIntervalRepaired':False,'oldPublisherAuthorityAdopted':False,'sourceEligibility':False,'ledger':ledger}
  cp=publish(E/'source-replacement-conservation.json',wire(conservation));outputs.append(cp)
  manifest={'scope':'U4_PUBLICATION_EPOCH2_CLOSED_FINITE_SOURCE_REFERENCE_ONLY','sourceEligibility':False,'independentReview':False,'writerState':'STOPPED','remainingSourceWrites':[],'inputs':rows,'declaredBootstrapPaths':[r['path']for r in bootstrap],'allFDsBeforeRemainingMemberBodies':True,'bootstrapThenWholeUnionSameLedger':True,'original130And113Conserved':True,'conservationPublisher':cp,'activeRuntimeSources':active,'oldTwoNonoperativeExcludedFromNewAuthority':OLD_TWO,'oldTwoPriorChargesRetained':True,'oldMFDocumentBaselineDistinct':True,'ledger':ledger,'futureNamedDATA':prior['futureNamedDATA'],'nativePrivate':False,'fullTask03':False,'fullGoal':False,'publisherOutputsSelfExcludedUntilRootMatureReadback':True}
  outputs.append(publish(E/'closed-source-reference-manifest.json',wire(manifest)))
  report='U4 publication epoch2: bounded SOURCE-only successor. Runtime entry/runner, two U3 observers, Common and original113 source baseline are unchanged. All130 retained rows preserve exact original nine/EOF/hash/bytes. Only the two failed nonoperative old publisher source/control inputs are replaced by new publication-final.py and final-source-writers-stopped.json; their old bytes remain charged. The old132 MF is read only as a separately mature digest-authenticated historical document, with a distinct current physical document baseline. The Root/Judge-reported old2 ctime gap is UNKNOWN and not repaired; old2 bodies are not opened. No old publisher PASS or runtime acceptance is fabricated.\n\nOriginal author source/MOCK controls remain185 executions/141 distinct conditions PASS from the original113 held qualification. No matrix rerun occurred here. Independent U4 judge must independently qualify original97/portable/highFD9 under the complete current source graph; source eligibility remains false. FullTask03 functional0/3, goal1/17 boundedTask01, product0/12; nativePrivate/fullTask03/fullGoal=false.\n\nThe current held input union is '+str(len(rows))+' files/'+str(physical)+' bytes; the cumulative ledger retains old132 admission charge and adds five new inputs, totaling '+str(ledger['chargedAdmissions'])+' admissions/'+str(ledger['chargedBytes'])+' bytes plus the unchanged49152-byte/two-DATA reservation. Limits remain4096/64MiB/16MiB, no exemption or reset. All inputs are STOPPED and physically mature>=60 from actualmaxmtime/ctime. The five declared bootstrap files are held before locator content; the complete remaining130 union is held before its member content and through conservation/manifest/report publication, final re-read and every owned close attempt. The26 publisher registration/close/final-verification Source/MOCK controls passed fromheldsource beforepublication. Five new output publishers selfexclude until Root later genuine maturity.\n\nOriginal actual1914/3828/both-side fullEOF/hash/all9, perfile16MiB, decoded4MiB, perpipe262144, four sequential read-only recipes,2GiBmemory/swap0/190seconds/48commands/noheap/maxpaid0 and all original identity/ownership/unknown-denial/deadline assertions remain unchanged. The actual held-byte entry and future acceptance/handoff stay the exact U4 contract, with no source activation here. No Docker/private/service/credentials/CLI/native/target/inference/network/CI/Git/product effects. All old histories stay immutable.\n'
  outputs.append(publish(E/'preparation-report.md',report.encode()))
 except BaseException as e:failures.append({'phase':'PRIMARY_OR_PUBLICATION',**err(e)})
 finally:
  try:
   if owned:
    final=verify()
    if not all(q['exactNineHashEOF']for q in final):failures.append({'phase':'FINAL_NINE_HASH_EOF','rows':[q for q in final if not q['exactNineHashEOF']]})
  except BaseException as e:failures.append({'phase':'FINAL_VERIFICATION_EXCEPTION',**err(e)})
  finally:
   for i,p in enumerate(owned):
    p['closeAttempted']=True;c={'index':i,'path':p['path'],'attempt':1,'error':None}
    try:os.close(p['fd'])
    except BaseException as e:c['error']=err(e);failures.append({'phase':'OWNED_CLOSE','index':i,'path':p['path'],'error':c['error']})
    calls.append(c)
 receipt={'scope':'U4_PUBLICATION_EPOCH2_HELD_FINAL_CLOSE_SOURCE_ONLY','sourceEligibility':False,'inputsHeld':len(owned),'allFinalChecks':final,'allCloseCalls':calls,'closeRetries':0,'stickyFailureChain':failures,'ledger':ledger,'publishersBeforeClose':outputs,'oldIntervalRepaired':False,'oldTwoBodiesOpened':False,'nativePrivate':False,'fullTask03':False,'publisherSelfExcluded':True}
 try:outputs.append(publish(E/'final-held-source-close-receipt.json',wire(receipt)))
 except BaseException as e:failures.append({'phase':'CLOSE_RECEIPT_PUBLICATION','type':type(e).__name__,'message':str(e)})
 ss={'scope':'U4_PUBLICATION_EPOCH2_ALL_WRITERS_STOPPED','writerState':'STOPPED','remainingWrites':[],'authorStoppedUnixNs':str(time.time_ns()),'publishers':outputs,'stickyFailureChain':failures,'sourceEligibility':False,'oldIntervalRepaired':False,'nativePrivate':False,'fullTask03':False,'fullGoal':False,'selfExcludedUntilRootMatureReadback':True}
 try:outputs.append(publish(E/'final-writer-stop.json',wire(ss)))
 except BaseException as e:failures.append({'phase':'STOP_PUBLICATION','type':type(e).__name__,'message':str(e)})
 print(json.dumps({'outputs':outputs,'ledger':ledger,'failures':failures,'inputsHeld':len(owned),'closes':len(calls),'allFinalExact':len(final)==135 and all(q['exactNineHashEOF']for q in final),'sourceEligibility':False},sort_keys=True),flush=True)
 return 0 if not failures else 1
