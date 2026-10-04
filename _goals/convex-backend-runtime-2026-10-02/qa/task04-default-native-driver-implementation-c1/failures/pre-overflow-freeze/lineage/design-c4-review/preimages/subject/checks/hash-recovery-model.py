"""Independent pure hash/recovery contract examples; no native/account-proof acceptance.
Symbolic row IDs, one-trigger hash projection specimen; full global account/parser
and actual provider semantics remain NOT_RUN. All outputs are illustrative."""
import copy,json,hashlib

def C(x):return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def H(x):return hashlib.sha256(C(x).encode()).hexdigest()
def rawH(s):return hashlib.sha256(s.encode()).hexdigest()
def exact(x,keys):assert type(x) is dict and set(x)==set(keys.split())
def parse(s):
 def pairs(x):
  d={}
  for k,v in x:assert k not in d;d[k]=v
  return d
 x=json.loads(s,object_pairs_hook=pairs);assert C(x)==s;return x

def specimen():
 binding={k:H(k) for k in 'manifestHash targetHash sourceHash installedClosureHash operatorHash grantHash sourceRecordHash profileHash'.split()}
 binding.update({k:1 for k in 'grantEpoch sourceEpoch sourceRevision profileEpoch windowEpoch validatorRevision'.split()})
 owned={'accountHash':H('account'),'targetHash':binding['targetHash'],'manifestHash':binding['manifestHash'],'operatorHash':binding['operatorHash'],'scope':{k:H(k) for k in ['tenantHash','spaceHash','ownerHash']},'sourceId':'symbolic-source','chunkId':'symbolic-chunk','grantId':'symbolic-grant'}
 content=H({'text':'private part'});identity={'version':1,'scenarioId':'C09','dispatchIdentity':H('dispatch'),'binding':binding,'partSequence':7,'rawPartDigest':H('raw-part'),'stageCanonicalHash':content,'trigger':'revoke'}
 item={'scenarioId':'C09','dispatchIdentity':identity['dispatchIdentity'],'trigger':'revoke','stageHash':content,'stageIdentityHash':H(identity),'stageIdentityCanonical':C(identity)}
 trigger={'domain':'cortex.experiment.trigger-set.v1','version':1,'accountHash':owned['accountHash'],'bindingHash':H(binding),'triggers':[item]}
 liab={'domain':'cortex.experiment.liability.v1','version':1,'accountHash':owned['accountHash'],'bindingHash':H(binding),'next':1,'active':'C09','reserved':29031,'known':0,'attempts':[{'scenarioId':'C09','dispatchIdentity':identity['dispatchIdentity'],'k':29031,'known':None,'state':'unknown','checkpoint':True,'slotReleased':False,'firstCaptureHash':H('initial-unknown-fact'),'refinementHashes':[]}]}
 flags={k:False for k in ['stopped','overrun','revoked','cancelled']};flags.update({k:True for k in ['sourceCurrent','profileCurrent','proofCurrent','windowCurrent']});flags['attachments']=[{'scenarioId':'C09','attachment':'closed'}]
 state={'domain':'cortex.experiment.lifecycle-state.v1','version':1,'owned':owned,'source':{'sourceId':owned['sourceId'],'sourceHash':H('source'),'revision':1,'epoch':1,'profileHash':binding['profileHash'],'tombstone':True},'chunk':{'chunkId':owned['chunkId'],'sourceId':owned['sourceId'],'sourceHash':H('source'),'sourceRevision':1,'textHash':H('chunk'),'profileHash':binding['profileHash'],'tombstone':True},'grant':{'grantId':owned['grantId'],'grantHash':binding['grantHash'],'epoch':1,'active':True},'vectors':[],'flags':flags,'triggerSetHash':H(trigger),'accountLiabilityHash':H(liab)}
 evidence={'domain':'cortex.experiment.evidence-snapshot.v1','version':1,'owned':owned,'triggerSetHash':H(trigger),'accountLiabilityHash':H(liab),'stages':[{'dispatchIdentity':item['dispatchIdentity'],'scenarioId':'C09','stageIdentityHash':item['stageIdentityHash'],'stageHash':content,'privateBytes':len(C({'text':'private part'}).encode())}],'evidence':[],'vectors':[]}
 return binding,owned,trigger,liab,state,evidence

def make(operation,owned,key,before,after,evidence,liab,trigger,outcome='applied'):
 intent={'domain':'cortex.experiment.'+operation+'-intent.v1','version':1,'owned':owned,'intentKey':key}
 if operation=='revoke':intent['expectedGrantEpoch']=before['grant']['epoch']
 elif operation=='delete':intent.update(expectedGrantEpoch=before['grant']['epoch'],expectedSourceRevision=before['source']['revision'],expectedSourceEpoch=before['source']['epoch'])
 else:intent['evidenceSnapshotHash']=H(evidence)
 receipt={'domain':'cortex.experiment.lifecycle-receipt.v1','version':1,'accountHash':owned['accountHash'],'operation':operation,'intentKey':key,'intentHash':H(intent),'outcome':outcome,'beforeHash':H(before),'afterHash':H(after),'evidenceSnapshotHash':H(evidence),'accountLiabilityHash':H(liab),'triggerSetHash':H(trigger)}
 row={'accountHash':owned['accountHash'],'operation':operation,'intentKey':key,'intentCanonical':C(intent),'intentHash':H(intent),'receiptCanonical':C(receipt),'receiptHash':H(receipt),'beforeCanonical':C(before),'afterCanonical':C(after),'evidenceCanonical':C(evidence),'liabilityCanonical':C(liab),'triggerCanonical':C(trigger)}
 return row

def check_trigger(t,binding,accountHash):
 exact(t,'domain version accountHash bindingHash triggers');assert t['domain']=='cortex.experiment.trigger-set.v1' and t['version']==1 and t['bindingHash']==H(binding) and t['accountHash']==accountHash
 seen=set()
 for x in t['triggers']:
  exact(x,'scenarioId dispatchIdentity trigger stageHash stageIdentityHash stageIdentityCanonical');i=parse(x['stageIdentityCanonical']);exact(i,'version scenarioId dispatchIdentity binding partSequence rawPartDigest stageCanonicalHash trigger')
  assert C(i['binding'])==C(binding) and i['version']==1 and 0<=i['partSequence']<=511 and x['stageIdentityHash']==H(i) and x['stageHash']==i['stageCanonicalHash']
  for k in ['scenarioId','dispatchIdentity','trigger']:assert x[k]==i[k]
  assert x['scenarioId'] not in seen and x['trigger']==('revoke' if x['scenarioId']=='C09' else 'cancel');seen.add(x['scenarioId'])
 assert len(t['triggers'])<=2

def load(row,binding,owned):
 exact(row,'accountHash operation intentKey intentCanonical intentHash receiptCanonical receiptHash beforeCanonical afterCanonical evidenceCanonical liabilityCanonical triggerCanonical')
 intent=parse(row['intentCanonical']);r=parse(row['receiptCanonical']);b=parse(row['beforeCanonical']);a=parse(row['afterCanonical']);e=parse(row['evidenceCanonical']);l=parse(row['liabilityCanonical']);t=parse(row['triggerCanonical'])
 keys='domain version owned intentKey '+{'revoke':'expectedGrantEpoch','delete':'expectedSourceRevision expectedSourceEpoch expectedGrantEpoch','purge':'evidenceSnapshotHash'}[row['operation']];exact(intent,keys)
 exact(r,'domain version accountHash operation intentKey intentHash outcome beforeHash afterHash evidenceSnapshotHash accountLiabilityHash triggerSetHash')
 assert row['accountHash']==owned['accountHash']==r['accountHash']==intent['owned']['accountHash'];assert intent['owned']==owned
 assert intent['domain']=='cortex.experiment.'+row['operation']+'-intent.v1' and intent['version']==1 and r['domain']=='cortex.experiment.lifecycle-receipt.v1' and r['version']==1
 assert row['operation']==r['operation'] and row['intentKey']==r['intentKey']==intent['intentKey'] and row['intentHash']==r['intentHash']==H(intent) and row['receiptHash']==H(r)
 for name,obj in [('beforeHash',b),('afterHash',a),('evidenceSnapshotHash',e),('accountLiabilityHash',l),('triggerSetHash',t)]:assert r[name]==H(obj)
 check_trigger(t,binding,owned['accountHash'])
 for s in [b,a,e]:assert s['owned']==owned and s['triggerSetHash']==H(t) and s['accountLiabilityHash']==H(l)
 assert l['accountHash']==owned['accountHash'] and l['bindingHash']==H(binding)
 assert b['source']['tombstone']<=a['source']['tombstone'] and b['chunk']['tombstone']<=a['chunk']['tombstone']
 if r['outcome']=='applied':
  if row['operation']=='revoke':assert b['grant']['active'] and not a['grant']['active'] and a['grant']['epoch']==b['grant']['epoch']+1
  if row['operation']=='purge':assert not b['grant']['active'] and b['source']['tombstone'] and b['chunk']['tombstone'] and a['vectors']==[]
 else:assert b==a
 return t,l

def inspect(row,binding,owned,currentT,currentL,attempt):
 t,oldL=load(row,binding,owned);check_trigger(currentT,binding,owned['accountHash']);assert C(t)==C(currentT)
 x=currentT['triggers'][0];assert attempt=={'trigger':x['trigger'],'stageHash':x['stageHash'],'identityHash':x['stageIdentityHash']}
 # Current accounting separately validated elsewhere; NO oldL==currentL predicate.
 return {'kind':'recorded','stageHash':x['stageHash'],'stageIdentityHash':x['stageIdentityHash'],'known':currentL['known'],'reserved':currentL['reserved'],'active':currentL['active']}

def postpurge_stage_replay(row,binding,owned,requestedIdentityCanonical):
 # Validate retained control record but never recreate removed private StageRow.
 retained,_=load(row,binding,owned)
 assert row['operation']=='purge'
 requested=parse(requestedIdentityCanonical)
 assert requested['binding']==binding
 if retained['triggers'][0]['stageIdentityCanonical']==requestedIdentityCanonical:
  return {'kind':'denied','reason':'closed'}
 return {'kind':'collision','reason':'part-identity'}

def bad(name,fn,groups):
 try:fn()
 except (AssertionError,KeyError,ValueError):groups.append(name);return
 raise AssertionError('unrejected corruption '+name)

def run():
 binding,o,t,l,s,e=specimen();groups=[]
 emptyT=copy.deepcopy(t);emptyT['triggers']=[];rootBefore=copy.deepcopy(s);rootBefore['triggerSetHash']=H(emptyT);rootBefore['flags']['stopped']=True;rootE=copy.deepcopy(e);rootE['triggerSetHash']=H(emptyT);rootE['stages']=[]
 rootAfter=copy.deepcopy(rootBefore);rootAfter['grant']['active']=False;rootAfter['grant']['epoch']+=1;rootAfter['flags']['revoked']=True
 revoke=make('revoke',o,H('revoke-key'),rootBefore,rootAfter,rootE,l,emptyT);load(revoke,binding,o);groups.append('independent ROOT revoke-after-STOP canonical projections/typed row validate')
 # Independent purge specimen already self-revoked by its retained C09 trigger.
 after=copy.deepcopy(s);after['grant']['active']=False;after['grant']['epoch']+=1;after['flags']['revoked']=True
 purge=make('purge',o,H('purge-key'),after,after,e,l,t);load(purge,binding,o);groups.append('purge retains exact canonical immutable trigger preimage')
 for field in ['accountHash','operation','intentKey','intentHash','receiptHash']:
  corrupt=copy.deepcopy(purge);corrupt[field]='revoke' if field=='operation' else H('corrupt-'+field);bad('redundant '+field+' mismatch denies0writes/nosummary',lambda:load(corrupt,binding,o),groups)
 corrupt=copy.deepcopy(purge);corrupt['triggerCanonical']=' '+corrupt['triggerCanonical'];bad('noncanonical whitespace rejects',lambda:load(corrupt,binding,o),groups)
 corrupt=copy.deepcopy(purge);obj=parse(corrupt['beforeCanonical']);obj['grant']['epoch']+=1;corrupt['beforeCanonical']=C(obj);bad('changed canonical historical before hash rejects',lambda:load(corrupt,binding,o),groups)
 corrupt=copy.deepcopy(purge);obj=parse(corrupt['triggerCanonical']);identity=parse(obj['triggers'][0]['stageIdentityCanonical']);identity['partSequence']+=1;obj['triggers'][0]['stageIdentityCanonical']=C(identity);corrupt['triggerCanonical']=C(obj);bad('nested canonical/identityHash redundancy rejects',lambda:load(corrupt,binding,o),groups)
 altered=copy.deepcopy(binding);altered['sourceHash']=H('changed-immutable-binding');bad('changed immutable dispatch binding denies',lambda:load(purge,altered,o),groups)
 item=t['triggers'][0];attempt={'trigger':item['trigger'],'stageHash':item['stageHash'],'identityHash':item['stageIdentityHash']}
 summary=inspect(purge,binding,o,t,l,attempt);assert 'private' not in C(summary) and 'text' not in C(summary);groups.append('postpurge hash-only trigger recovery')
 changed=copy.deepcopy(attempt);changed['identityHash']=H('H-shaped-wrong-trigger');bad('postpurge changed attempt trigger denies nosummary',lambda:inspect(purge,binding,o,t,l,changed),groups)
 changedT=copy.deepcopy(t);changedT['triggers'][0]['stageHash']=H('wrong-stage');bad('postpurge malformed retained trigger projection rejects',lambda:inspect(purge,binding,o,changedT,l,attempt),groups)
 changedT=copy.deepcopy(t);identity=parse(changedT['triggers'][0]['stageIdentityCanonical']);identity['partSequence']+=1;changedT['triggers'][0]['stageIdentityCanonical']=C(identity);changedT['triggers'][0]['stageIdentityHash']=H(identity);changedAttempt=copy.deepcopy(attempt);changedAttempt['identityHash']=H(identity);bad('self-consistent changed current trigger still differs from immutable purge T',lambda:inspect(purge,binding,o,changedT,l,changedAttempt),groups)
 late=copy.deepcopy(l);late.update(active=None,reserved=0,known=15000000);late['attempts'][0].update(state='terminal',known=15000000,slotReleased=True,refinementHashes=[H('hypothetical-supported-late-terminal-money')]);assert H(late)!=H(l)
 summary=inspect(purge,binding,o,t,late,attempt);assert summary['known']==15000000 and summary['reserved']==0 and summary['active'] is None;groups.append('legitimate hypothetical late fullcharge/terminal refinement independent of immutable trigger')
 for op,outcome in [('delete','already-tombstoned'),('revoke','already-revoked')]:
  noWrite=make(op,o,H('no-write-'+op),after,after,e,l,t,outcome);load(noWrite,binding,o);same=make(op,o,H('no-write-'+op),after,after,e,l,t,outcome);assert same['receiptHash']==noWrite['receiptHash'];groups.append(op+' already closed exact no-write derived receiptHash')
 assert C(parse(purge['intentCanonical']))==purge['intentCanonical'];replayResult=postpurge_stage_replay(purge,binding,o,item['stageIdentityCanonical']);assert replayResult=={'kind':'denied','reason':'closed'};groups.append('stage exact mutation replay after validated private purge remains denied closed/no recreation')
 print(json.dumps({'classification':'PURE_HASH_RECOVERY_CONTRACT_EXAMPLES_ONLY','groups':len(groups),'outcomes':groups,'result':'PASS','nativeProviderManagedPaid':'NOT_RUN'},indent=2))
if __name__=='__main__':run()
