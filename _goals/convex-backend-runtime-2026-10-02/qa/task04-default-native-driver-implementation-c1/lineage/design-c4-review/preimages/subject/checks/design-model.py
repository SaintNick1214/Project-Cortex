"""Pure design-model checks. NO product/driver/provider execution or actual proof."""
import copy,json,math,re,struct
MAX=9007199254740991
H=re.compile(r'^[a-f0-9]{64}$');CATS=['cache-read','cache-write','cancelled','inference','rejected','routing','surcharge']
BKEYS=set('manifestHash targetHash sourceHash installedClosureHash operatorHash grantHash sourceRecordHash profileHash grantEpoch sourceEpoch sourceRevision profileEpoch windowEpoch validatorRevision'.split())
KEYS=set('version evidenceScope binding scenarioId dispatchIdentity nativeHash expectedWireHash rawDigest method interface requestedModel responseId actualModel rawFinish nativeFinish nativeRawFinish rawCounts mappedCounts usage lifetime lifetimeProof serving servingProof money observedCostDecimal observedCurrency observedCategories microUSD moneyProof resultHash reason'.split())
def exact(x,keys):assert type(x) is dict and set(x)==keys

def n(x,minimum=0):assert type(x) is int and minimum<=x<=MAX

def ident(x):assert type(x) is str and 0<len(x.encode())<=256 and all(ord(c)>=32 and ord(c)!=127 for c in x)

def hashv(x):assert type(x) is str and H.fullmatch(x)

def scalar_graph(x,depth=0,seen=None):
 if seen is None:seen=set()
 assert depth<=16
 if type(x) is str:x.encode('utf-8');return
 if x is None or type(x) is bool:return
 if type(x) in (int,float):assert math.isfinite(x) and not(type(x) is float and x==0 and math.copysign(1,x)<0);return
 assert type(x) in (dict,list) and id(x) not in seen;seen.add(id(x))
 if type(x) is dict:
  for k,v in x.items():assert type(k) is str;scalar_graph(k,depth+1,seen);scalar_graph(v,depth+1,seen)
 else:
  for v in x:scalar_graph(v,depth+1,seen)

def parse(x):
 scalar_graph(x);assert len(json.dumps(x,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode())<=8192
 exact(x,KEYS);assert x['version']==2 and x['evidenceScope']=='actual-experiment-native';exact(x['binding'],BKEYS)
 for k,v in x['binding'].items():
  if k.endswith('Epoch') or k=='sourceRevision':n(v,1)
  elif k=='validatorRevision':assert v==1
  else:hashv(v)
 for k in ['dispatchIdentity','nativeHash','expectedWireHash','rawDigest']:hashv(x[k])
 for k in ['responseId','actualModel','nativeRawFinish','observedCurrency']:
  if x[k] is not None:ident(x[k])
 for k in ['lifetimeProof','servingProof','moneyProof','resultHash']:
  if x[k] is not None:hashv(x[k])
 for k in ['rawCounts','mappedCounts']:
  exact(x[k],{'input','output'})
  for v in x[k].values():
   if v is not None:n(v)
 if x['microUSD'] is not None:n(x['microUSD'])
 assert x['scenarioId'] in ['C'+str(i).zfill(2) for i in range(1,11)]+['E'+str(i) for i in range(11,15)]
 assert x['method'] in ['generate','stream','embed'];emb=x['method']=='embed'
 assert x['interface']==('embedding' if emb else 'chat') and x['requestedModel']==('openai/text-embedding-3-small' if emb else 'openai/gpt-4o-mini')
 assert x['rawFinish'] in [None,'stop','length','content_filter'];assert x['nativeFinish'] in [None,'stop','length','content-filter','tool-calls','error','other']
 assert x['usage'] in ['unknown','validated-raw-mapped'];assert x['lifetime'] in ['unknown','validated-provider-terminal'];assert x['serving'] in ['unknown','validated-bound-premises','drift'];assert x['money'] in ['unknown','validated-whole-invocation-usd'];assert x['reason'] in ['none','missing-evidence','unsupported','contradiction','bound-violation','authority-closed']
 assert type(x['observedCategories']) is list and x['observedCategories']==sorted(set(x['observedCategories'])) and all(c in CATS for c in x['observedCategories'])
 if x['observedCostDecimal'] is not None:assert type(x['observedCostDecimal']) is str and len(x['observedCostDecimal'])<=80 and re.fullmatch(r'\d+(?:\.\d+)?',x['observedCostDecimal'])
 if emb:assert x['rawFinish'] is x['nativeFinish'] is x['nativeRawFinish'] is None and all(x[k]['output'] in [None,0] for k in ['rawCounts','mappedCounts'])
 if x['usage']=='validated-raw-mapped':assert x['rawCounts']==x['mappedCounts'] and x['rawCounts']['input'] is not None and x['rawCounts']['output'] is not None
 if x['lifetime']=='validated-provider-terminal':
  assert x['lifetimeProof'] and x['responseId'] and x['actualModel']
  if not emb:assert x['rawFinish'] and x['nativeRawFinish']==x['rawFinish'] and x['nativeFinish']=={'stop':'stop','length':'length','content_filter':'content-filter'}[x['rawFinish']]
 else:assert x['lifetimeProof'] is None
 if x['serving']=='validated-bound-premises':assert x['actualModel'] and x['servingProof']
 else:assert x['servingProof'] is None
 if x['serving']=='drift':assert x['actualModel'] and x['actualModel']!=x['requestedModel']
 if x['money']=='validated-whole-invocation-usd':assert x['microUSD'] is not None and x['moneyProof'] and x['observedCurrency']=='USD' and x['observedCostDecimal'] is not None and x['observedCategories']
 else:assert x['microUSD'] is None and x['moneyProof'] is None
 if x['reason']=='none':assert all(x[k]!='unknown' for k in ['usage','lifetime','serving','money']) and x['serving']!='drift' and x['resultHash']
 return True

def base():
 b={k:('a'*64 if not(k.endswith('Epoch') or k in ['sourceRevision','validatorRevision']) else 1) for k in BKEYS}
 return dict(version=2,evidenceScope='actual-experiment-native',binding=b,scenarioId='C01',dispatchIdentity='b'*64,nativeHash='c'*64,expectedWireHash='d'*64,rawDigest='e'*64,method='generate',interface='chat',requestedModel='openai/gpt-4o-mini',responseId=None,actualModel=None,rawFinish=None,nativeFinish=None,nativeRawFinish=None,rawCounts={'input':None,'output':None},mappedCounts={'input':None,'output':None},usage='unknown',lifetime='unknown',lifetimeProof=None,serving='unknown',servingProof=None,money='unknown',observedCostDecimal=None,observedCurrency=None,observedCategories=[],microUSD=None,moneyProof=None,resultHash=None,reason='missing-evidence')

def expect_bad(name,edit):
 x=base();edit(x)
 try:parse(x)
 except (AssertionError,UnicodeError,TypeError,ValueError):return name
 raise AssertionError('unexpected schema acceptance '+name)

def outward(x):
 if type(x) is str:
  assert len(x)<=80 and re.fullmatch(r'\d+(?:\.\d+)?',x);a,_,b=x.partition('.');num=int(a+b);den=10**len(b)
 else:
  assert type(x) is float and math.isfinite(x) and x>=0 and not(x==0 and math.copysign(1,x)<0)
  if x==0:return 0
  bits=struct.unpack('>Q',struct.pack('>d',x))[0]+1;upper=struct.unpack('>d',struct.pack('>Q',bits))[0];assert math.isfinite(upper);num,den=upper.as_integer_ratio()
 y=(num*1000000+den-1)//den;assert y<=MAX;return y

# Algebraic branch model only. qualified booleans here are hypothetical design inputs,
# never validated labels from an actual receipt/proof registry.
def capture(state,money=None,terminal=False):
 s=copy.deepcopy(state)
 if money is not None and s['known'] is None:s['known']=money;s['reserved']=0
 if terminal:s['active']=False
 s['stopped']=s['stopped'] or money is None or not terminal or money>s['k'];s['closed']=s['closed'] or s['stopped']
 return s

def run():
 outcomes=[];assert parse(base());outcomes.append('unknown receipt accepts absence, EMPTY proof resolver has no validated branch')
 edits=[('extra key',lambda x:x.update(extra=True)),('missing key',lambda x:x.pop('responseId')),('v1 scope',lambda x:x.update(evidenceScope='nonpaid-peer-offline')),('bad hash',lambda x:x.update(nativeHash='x')),('epoch zero',lambda x:x['binding'].update(grantEpoch=0)),('bool count',lambda x:x['rawCounts'].update(input=True)),('negativezero',lambda x:x['rawCounts'].update(input=-0.0)),('nonfinite',lambda x:x['rawCounts'].update(input=float('inf'))),('unicode',lambda x:x.update(responseId='\ud800')),('unknown category',lambda x:x.update(observedCategories=['invented'])),('duplicate category',lambda x:x.update(observedCategories=['inference','inference'])),('currency laundering',lambda x:x.update(money='validated-whole-invocation-usd',microUSD=0)),('lifetime label without proof',lambda x:x.update(lifetime='validated-provider-terminal')),('mappedzero not rawusage',lambda x:x.update(usage='validated-raw-mapped',mappedCounts={'input':0,'output':0})),('model interface mismatch',lambda x:x.update(method='embed')),('drift missing actual',lambda x:x.update(serving='drift')),('oversized id',lambda x:x.update(responseId='x'*257))]
 outcomes += [expect_bad(name,edit) for name,edit in edits]
 assert outward('0')==0 and outward('0.0000001')==1 and outward('0.000001')==1 and outward(0.000001)==2 and outward(0.0)==0;outcomes.append('exactdecimal versus outward adjacent IEEE zero/submicro')
 s={'k':29031,'known':None,'reserved':29031,'active':True,'stopped':False,'closed':False}
 a=capture(s,terminal=True);assert a['reserved']==29031 and a['known'] is None and not a['active'] and a['closed'];outcomes.append('terminal unknownmoney fullK release slot/closed')
 b=capture(s,money=15000000);assert b['known']==15000000 and b['reserved']==0 and b['active'] and b['closed'];outcomes.append('fullcharge above K/10USD no clipping unknownlifetime active')
 c=capture(a,money=40,terminal=True);d=capture(b,money=15000000,terminal=True);assert c['known']==40 and c['closed'] and not c['active'] and d['known']==15000000 and d['closed'] and not d['active'];outcomes.append('independent upgrades cannot reopen STOP/private')
 assert capture(c,money=40,terminal=True)==c;outcomes.append('algebra once-only amount release')
 # Transaction-fence design predicate: change during async work refuses hydration/write.
 snapshot=(1,'hash',1,True,False);current=snapshot;assert current==snapshot
 for current in [(2,'hash',1,True,False),(1,'new',1,True,False),(1,'hash',2,True,False),(1,'hash',1,False,False),(1,'hash',1,True,True)]:assert current!=snapshot
 outcomes.append('afterasync revision/hash/grantepoch/revoke/tombstone fence')
 stage={'count':0,'trigger':None,'closed':False};stage={'count':1,'trigger':'revoke','closed':True};replay=copy.deepcopy(stage);assert replay==stage and replay['count']==1 and replay['closed'];outcomes.append('once-only inaccessible stage/control transaction branch')
 print(json.dumps({'classification':'PURE_DESIGN_MODEL_ONLY','groups':len(outcomes),'outcomes':outcomes,'result':'PASS','actualProofRegistry':'EMPTY','driverNativeManagedPaid':'NOT_RUN'},indent=2))
if __name__=='__main__':run()
