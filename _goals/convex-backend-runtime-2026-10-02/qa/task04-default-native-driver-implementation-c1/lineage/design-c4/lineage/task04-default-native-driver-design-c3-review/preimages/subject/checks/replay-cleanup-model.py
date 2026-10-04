"""Independent illustrative C3 counterexamples, not product/native acceptance."""
import copy,hashlib,json

def canonical(x):return json.dumps(x,sort_keys=True,separators=(',',':'))
def digest(x):return hashlib.sha256(canonical(x).encode()).hexdigest()

def initial():return {'owner':'root-fixture','target':'owned-target','scope':('tenant','space','owner'),'binding':'fixed-dispatch-binding','revision':1,'sourceEpoch':1,'grantEpoch':1,'grantActive':True,'stopped':False,'revoked':False,'cancelled':False,'tombstone':False,'stage':None,'deleteReceipt':None,'known':None,'reserved':29031,'active':'C09','closed':False}

def stage(s,scenario,seq,raw,text,operator='root-fixture'):
 # Return new copy plus result and DB write count; public result never includes text.
 t=copy.deepcopy(s)
 if operator!=s['owner']:return t,{'kind':'denied','reason':'wrong-owner'},0
 identity={'version':1,'scenario':scenario,'dispatch':'fixed-'+scenario,'binding':s['binding'],'seq':seq,'raw':raw,'content':digest({'text':text}),'trigger':'revoke' if scenario=='C09' else 'cancel'}
 if s['stage']:
  if s['stage']['identity']!=identity:return t,{'kind':'collision'},0
  return t,{'kind':'replay','identityHash':digest(identity),'stageHash':identity['content']},0
 if s['closed'] or s['stopped'] or s['revoked'] or s['cancelled'] or not s['grantActive']:return t,{'kind':'denied','reason':'closed'},0
 if not text or seq<0 or seq>511:return t,{'kind':'denied','reason':'ineligible'},0
 t['stage']={'identity':identity,'private':text};t['closed']=True
 if scenario=='C09':t['revoked']=True;t['grantActive']=False;t['grantEpoch']+=1;writes=3
 else:t['cancelled']=True;writes=2
 return t,{'kind':'triggered','identityHash':digest(identity),'stageHash':identity['content']},writes

def delete(s,key,expected,operator='root-fixture',scope=('tenant','space','owner')):
 t=copy.deepcopy(s)
 if operator!=s['owner']:return t,{'kind':'denied','reason':'wrong-owner'},0
 if scope!=s['scope']:return t,{'kind':'denied','reason':'wrong-scope'},0
 identity={'key':key,'expected':expected,'owner':operator,'scope':scope,'target':s['target']}
 if s['deleteReceipt']:
  if s['deleteReceipt']['identity']==identity:return t,{'kind':'replay','receiptHash':s['deleteReceipt']['hash']},0
  return t,{'kind':'collision'},0
 if expected!=(s['revision'],s['sourceEpoch'],s['grantEpoch']):return t,{'kind':'denied','reason':'stale'},0
 if s['tombstone']:return t,{'kind':'already-tombstoned','receiptHash':digest(identity)},0
 t['tombstone']=True;t['revision']+=1;t['sourceEpoch']+=1;t['closed']=True
 t['deleteReceipt']={'identity':identity,'hash':digest(identity)}
 assert (t['known'],t['reserved'],t['active'])==(s['known'],s['reserved'],s['active'])
 return t,{'kind':'tombstoned','receiptHash':t['deleteReceipt']['hash']},4 # source/chunk/account/lifecycle model, no vector

def inspect(s,operator='root-fixture'):
 if operator!=s['owner']:return {'kind':'denied','reason':'wrong-owner'}
 if not s['stage']:return {'kind':'absent'}
 i=s['stage']['identity'];return {'kind':'recorded','trigger':i['trigger'],'identityHash':digest(i),'stageHash':i['content']}

def run():
 groups=[]
 for scenario in ['C09','C10']:
  original=initial();original['active']=scenario
  committed,result,writes=stage(original,scenario,7,'rawA','same text');assert writes==(3 if scenario=='C09' else 2) and result['kind']=='triggered'
  replay,recovery,writes=stage(committed,scenario,7,'rawA','same text');assert replay==committed and writes==0 and recovery['kind']=='replay' and 'private' not in recovery and 'text' not in recovery;groups.append(scenario+' exact committed response-loss replay after self-closure')
  for seq,raw in [(8,'rawA'),(7,'rawB')]:
   unchanged,collision,writes=stage(committed,scenario,seq,raw,'same text');assert unchanged==committed and writes==0 and collision['kind']=='collision'
  groups.append(scenario+' same text changed sequence/raw digest collision0writes')
  summary=inspect(committed);assert summary['kind']=='recorded' and 'text' not in canonical(summary) and 'same text' not in canonical(summary);groups.append(scenario+' closed recovery no private response')
  removed=copy.deepcopy(committed);removed['stage']=None;unchanged,denial,writes=stage(removed,scenario,8,'new','late text');assert unchanged==removed and denial['kind']=='denied' and writes==0;groups.append(scenario+' new late part denied after closure')
  expected=(committed['revision'],committed['sourceEpoch'],committed['grantEpoch']);deleted,res,writes=delete(committed,'owned-cleanup',expected);assert res['kind']=='tombstoned' and writes==4 and deleted['tombstone'] and (deleted['reserved'],deleted['active'],deleted['known'])==(29031,scenario,None);groups.append(scenario+' root cleanup after self-closure preserves unknown liability')
  again,res,writes=delete(deleted,'owned-cleanup',expected);assert again==deleted and res['kind']=='replay' and writes==0;groups.append(scenario+' repeat exact tombstone intent0writes despite own stale epochs')
  foreign,res,writes=delete(deleted,'owned-cleanup',expected,operator='foreign');assert foreign==deleted and res['kind']=='denied' and writes==0;groups.append(scenario+' wrong owner closed cleanup denied before replay')
 unknown=initial();unknown['stopped']=True;unknown['closed']=True
 deleted,res,writes=delete(unknown,'unknown-stop',(1,1,1));assert res['kind']=='tombstoned' and writes==4 and deleted['reserved']==29031 and deleted['active']=='C09';groups.append('delete after unknown STOP no active inference grant exception needed')
 wrong,res,writes=delete(unknown,'wrong-scope',(1,1,1),scope=('foreign','space','owner'));assert wrong==unknown and res['kind']=='denied' and writes==0;groups.append('wrong scope closed deletion denied0writes')
 stale,res,writes=delete(unknown,'stale',(2,1,1));assert stale==unknown and res['reason']=='stale' and writes==0;groups.append('new stale lifecycle intent denied0writes')
 external=initial();external['tombstone']=True;external['closed']=True;external['sourceEpoch']=2;external['revision']=2
 repeated,res,writes=delete(external,'root-observe-existing',(2,2,1));assert repeated==external and res['kind']=='already-tombstoned' and writes==0;groups.append('already tombstoned without root receipt current ownership0writes')
 changed,res,writes=delete(deleted,'unknown-stop',(2,2,1));assert changed==deleted and res['kind']=='collision' and writes==0;groups.append('same cleanup key changed expected epoch collision0writes')
 print(json.dumps({'classification':'INDEPENDENT_ILLUSTRATIVE_CONTRACT_MODEL_ONLY','groups':len(groups),'outcomes':groups,'result':'PASS','providerNativeManagedActual':'NOT_RUN'},indent=2))
if __name__=='__main__':run()
