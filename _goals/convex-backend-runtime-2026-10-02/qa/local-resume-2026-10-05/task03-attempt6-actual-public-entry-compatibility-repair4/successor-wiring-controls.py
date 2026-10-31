"""SOURCE/MOCK reachable successor gates, exact sets and semantic conservation."""
import ast,collections,json,sys
from pathlib import Path
P=json.loads(sys.stdin.buffer.read());new=ast.parse(P['runner']);old=ast.parse(P['oldRunner'])
receipts=[]
def record(name,**kw):receipts.append({'name':name,'status':'PASS','scope':'ISOLATED_ACTUAL_SUCCESSOR_GATE_SOURCE_MOCK',**kw})
for n in ast.walk(old):
 if isinstance(n,ast.Constant)and isinstance(n.value,str):n.value=n.value.replace('TASK03_ATTEMPT6_REPAIR3_ACTUAL_PUBLIC_REVIEW_HANDOFF','TASK03_ATTEMPT6_REPAIR4_ACTUAL_PUBLIC_REVIEW_HANDOFF').replace('TASK03_ATTEMPT6_PUBLIC_REVIEW_REPAIR3_NAMED_SOURCE_ACCEPTANCE','TASK03_ATTEMPT6_PUBLIC_REVIEW_REPAIR4_NAMED_SOURCE_ACCEPTANCE')
assert[ast.dump(n,include_attributes=False)for n in ast.walk(old)if isinstance(n,ast.Assert)]==[ast.dump(n,include_attributes=False)for n in ast.walk(new)if isinstance(n,ast.Assert)]
assert{n.name:ast.dump(n,include_attributes=False)for n in old.body if isinstance(n,ast.FunctionDef)}=={n.name:ast.dump(n,include_attributes=False)for n in new.body if isinstance(n,ast.FunctionDef)}
record('runner:all-original-assertions-and-functions-conserved',assertions=sum(isinstance(n,ast.Assert)for n in ast.walk(old)))
oe=ast.parse(P['oldEntry']);ne=ast.parse(P['entry'])
assert[ast.dump(n,include_attributes=False)for n in ast.walk(oe)if isinstance(n,ast.Assert)]==[ast.dump(n,include_attributes=False)for n in ast.walk(ne)if isinstance(n,ast.Assert)]
record('entry:all-original-assertions-conserved')
names={'R','QA','O','OBSERVERS','OLD','COMMON','REVIEW_OP','OP','VOLUME','IMAGE','FREEZE'}
constants=[n for n in new.body if isinstance(n,ast.Assign)and any(isinstance(t,ast.Name)and t.id in names for t in n.targets)]
outer=next(n for n in new.body if isinstance(n,ast.Try))
gate=[];take=False
for n in outer.body:
 if isinstance(n,ast.Assert)and any(isinstance(c,ast.Constant)and c.value=='TASK03_ATTEMPT6_REPAIR4_ACTUAL_PUBLIC_REVIEW_HANDOFF'for c in ast.walk(n)):gate.append(n)
 elif isinstance(n,ast.Assert)and getattr(n,'lineno',0)in(232,233):gate.append(n)
 if isinstance(n,ast.Assign)and any(isinstance(t,ast.Name)and t.id=='required_sources'for t in n.targets):take=True
 if take:
  if isinstance(n,ast.For):break
  gate.append(n)
assert len(gate)>=7
constant_code=compile(ast.fix_missing_locations(ast.Module(body=constants,type_ignores=[])),'<held-successor-constants>','exec')
gate_code=compile(ast.fix_missing_locations(ast.Module(body=gate,type_ignores=[])),'<held-successor-reachable-gates>','exec')
base={'Path':Path};exec(constant_code,base)
required={str(base['O']/n)for n in('actual-entry.py','run-actual-review.py')}|{str(base['OBSERVERS']/n)for n in('linux-public-observer.py','linux-dependency-observer.mjs')}|{str(base['COMMON'])}
assert len(required)==5 and str(base['OBSERVERS']/'actual-entry.py')not in required
def execute(kind):
 H={'scope':'TASK03_ATTEMPT6_REPAIR4_ACTUAL_PUBLIC_REVIEW_HANDOFF','explicitActualPublicReviewAuthorized':True,'operation':base['OP'],'reviewerOperation':base['REVIEW_OP'],'volume':base['VOLUME'],'immutableImage':base['IMAGE'],'candidateSha256':base['FREEZE'],'allNewWritersStopped':True,'remainingWrites':[],'reviewSources':{p:{'sha256':'a'*64}for p in required}}
 A={'scope':'TASK03_ATTEMPT6_PUBLIC_REVIEW_REPAIR4_NAMED_SOURCE_ACCEPTANCE','independent':True,'verdict':'PASS','reviewerOperation':base['REVIEW_OP'],'sourceEpochManifestSha256':'b'*64,'sourceHashes':{p:'a'*64 for p in required}}
 if kind=='stale-U3-handoff':H['scope']='TASK03_ATTEMPT6_REPAIR3_ACTUAL_PUBLIC_REVIEW_HANDOFF'
 if kind=='stale-U3-PASS-claim':A['scope']='TASK03_ATTEMPT6_PUBLIC_REVIEW_REPAIR3_NAMED_SOURCE_ACCEPTANCE'
 if kind=='wrong-active-entry':
  row=H['reviewSources'].pop(str(base['O']/'actual-entry.py'));H['reviewSources'][str(base['OBSERVERS']/'actual-entry.py')]=row;A['sourceHashes']={p:r['sha256']for p,r in H['reviewSources'].items()}
 if kind=='extra-source-key':
  H['reviewSources']['/owned-extra']={'sha256':'a'*64};A['sourceHashes']['/owned-extra']='a'*64
 if kind=='missing-source-key':
  H['reviewSources'].pop(str(base['COMMON']));A['sourceHashes'].pop(str(base['COMMON']))
 if kind=='wrong-source-hash':A['sourceHashes'][str(base['O']/'actual-entry.py')]='c'*64
 if kind=='old-reviewer-operation':A['reviewerOperation']='7cd9aa43-6f70-49a2-a280-f43777386366'
 if kind=='non-independent-bool-alias':A['independent']=1
 if kind=='wrong-verdict':A['verdict']='REVISION'
 if kind=='source-epoch-mismatch':A['sourceEpochManifestSha256']='c'*64
 if kind=='unauthorized-actual-bool-alias':H['explicitActualPublicReviewAuthorized']=1
 if kind=='writers-not-stopped':H['allNewWritersStopped']=False
 if kind=='remaining-writes':H['remainingWrites']=['owned-future-write']
 ns={**base,'H':H,'control_docs':{'reviewSourceAcceptance':A},'MF_SHA':'b'*64}
 denied=False
 try:exec(gate_code,ns)
 except AssertionError:denied=True
 assert denied is(kind!='positive-exact-five')
 record('successor:'+kind,denied=denied,sourceEffects=0)
for kind in('positive-exact-five','stale-U3-handoff','stale-U3-PASS-claim','wrong-active-entry','extra-source-key','missing-source-key','wrong-source-hash','old-reviewer-operation','non-independent-bool-alias','wrong-verdict','source-epoch-mismatch','unauthorized-actual-bool-alias','writers-not-stopped','remaining-writes'):execute(kind)
print(json.dumps({'scope':'U4_AUTHOR_SUCCESSOR_GATE_AND_CONSERVATION_SOURCE_MOCK','status':'PASS','controls':receipts,'count':len(receipts),'pythonExecutable':sys.executable,'pythonVersion':sys.version,'actualRunnerExecuted':False,'nativePrivate':False,'fullTask03':False},separators=(',',':')))
