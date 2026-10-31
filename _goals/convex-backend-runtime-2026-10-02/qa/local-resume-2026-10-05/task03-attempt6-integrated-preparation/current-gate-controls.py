from pathlib import Path
import ast,copy,json,os
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt6-2026-10-06';P=Q.parent/'local-resume-2026-10-05/task03-attempt6-integrated-preparation';a=ast.parse((Q/'integrated/official-dispatcher.py').read_text());f=next(x for x in a.body if isinstance(x,ast.FunctionDef)and x.name=='wait_crypto_gate');checks=[x for x in ast.walk(f)if isinstance(x,ast.Assert)and any(isinstance(n,ast.Name)and n.id=='current'for n in ast.walk(x))];assert len(checks)==3
code=compile(ast.Module(body=checks,type_ignores=[]),'<exact-current-status-gates>','exec');base={'phase':'ACTUAL_PRIVATE_TRANSFER_AWAITING_INDEPENDENT_REVIEW','status':'HELD','operation':'op','volume':'vol','candidateSha256':'sha','cliDispatched':False,'nativeFoundationAccepted':False};rows=[]
def run(name,value,ok):
 accepted=True
 try:exec(code,{'current':value,'OP':'op','V':'vol','FREEZE':'sha'})
 except AssertionError:accepted=False
 assert accepted is ok;rows.append({'name':name,'status':'PASS','observedAccepted':accepted,'actualEffects':0})
run('exact-current-held-positive',base,True)
for key in base:
 values=(True,0,None)if key in('cliDispatched','nativeFoundationAccepted')else('foreign',)
 for value in values:
  o=copy.deepcopy(base);o[key]=value;run(key+'-denies-'+repr(value),o,False)
# The literal current source membership assertion rejects an empty, partial, duplicate or foreign closure.
s=ast.parse((Q/'integrated/source-gates.py').read_text());f=next(x for x in s.body if isinstance(x,ast.FunctionDef)and x.name=='qualify_sources');checks=[x for x in f.body if isinstance(x,ast.Assert)and('expected_source_paths' in ast.unparse(x)or 'len(mf' in ast.unparse(x))];assert len(checks)==2
code=compile(ast.Module(body=checks,type_ignores=[]),'<exact-source-membership-gates>','exec')
for label,paths,ok in [('full',['critical'],True),('empty',[],False),('foreign',['foreign'],False),('duplicate',['critical','critical'],False)]:
 accepted=True
 try:exec(code,{'mf':{'files':[{'path':path}for path in paths]},'R':R,'expected_source_paths':lambda:[R/'critical']})
 except AssertionError:accepted=False
 assert accepted is ok;rows.append({'name':'source-membership-'+label,'status':'PASS','observedAccepted':accepted,'actualEffects':0})
result={'scope':'EXACT_CURRENT_STATUS_AND_SOURCE_MEMBERSHIP_EFFECT_SUBSTITUTED_ONLY','status':'PASS','count':len(rows),'rows':rows,'privateAccess':0,'actualNativeAccepted':False}
fd=os.open(P/'current-gate-control-results.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w')as h:json.dump(result,h,indent=2);h.write('\n')
print(json.dumps({k:result[k]for k in('scope','status','count','privateAccess','actualNativeAccepted')}))
