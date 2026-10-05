import pathlib,json,copy,hashlib,datetime,subprocess
repo=pathlib.Path.cwd(); own=repo/'_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-design-correction-c2-review'; j=json.loads((own/'outcomes-independent-stronger.json').read_text()); affected={'known-drift-40','known-drift-150','token-input-known40','token-output-known40'}
def verify(v):
 assert v['native']=='NOT_RUN' and not v['failures'] and len(v['outcomes'])==26
 assert len({x['id'] for x in v['outcomes']})==26
 for x in v['outcomes']:
  assert x['rpcIncludingThreePostCleanup']==len(x['trace'])
  assert x['rpcIncludingThreePostCleanup']<=(36 if x['id'] in affected else 32)
  assert x['created']<=(17 if x['id']=='captured-parity-operator' else 16)
  assert [t['path'] for t in x['trace'][-3:]]==['qualificationOwned:snapshot','qualificationOwned:cleanup','qualificationOwned:snapshot']
  if x['id'] in affected:
   assert x['created']==16 and x['rpcIncludingThreePostCleanup']==36
   failures=[(t['path'],t.get('code')) for t in x['trace'] if t['status']=='FAIL']
   assert failures==[('runtimeModelPolicy:admit','BUDGET_EXCEEDED'),('runtimeModelPolicy:admit','BUDGET_EXCEEDED'),('runtimeModelPolicy:admitFallback','POLICY_DENIED'),('runtimeModelPolicy:admit','BUDGET_EXCEEDED')]
verify(j); controls=[]
for name,change in [('dropped-case',lambda v:v['outcomes'].pop()),('RPC-overrun',lambda v:v['outcomes'][0].update(rpcIncludingThreePostCleanup=37)),('created-overrun',lambda v:v['outcomes'][0].update(created=17)),('authority-denial-masquerade',lambda v:v['outcomes'][0]['trace'][31].update(code='FORBIDDEN')),('cleanup-omitted',lambda v:v['outcomes'][0]['trace'][-2].update(path='runtimeModelPolicy:resolve'))]:
 v=copy.deepcopy(j);change(v)
 try:verify(v)
 except AssertionError:controls.append({'name':name,'result':'CORRECTLY_REJECTED'})
 else:raise AssertionError(name)
assert 4*36+22*32==848;assert 848+2044+20+2+10+37==2961;assert 25*16+17+15+12==444;assert 4800*1024+2211840+16384==7143424
source=(own/'subject/proposed-stronger-cases.mjs.text').read_text();anchor="const newAccount=afterNew.find(row=>row.id===newBinding.runAccountId).row;";assert source.count(anchor)==1
extra="assert.equal(afterNew.length,beforeNew.length+1);const oldRun=beforeNew.find(row=>row.id===b.runAccountId).row;assert.equal(newAccount.kind,'run');assert.equal(newAccount.tenantId,seed.reference.tenantId);assert.equal(newAccount.runBudgetId,newBinding.runBudgetId);assert.equal(newAccount.accountKey,newBinding.runBudgetId);same(newAccount.reference,seed.reference);for(const key of ['windowId','windowStart','windowEnd','currency','monetaryUnit','root'])same(newAccount[key],oldRun[key]);assert.equal(newAccount.current,true);assert.equal(newAccount.cancelled,false);assert.equal(newAccount.overrun,false);"
(own/'case-inputs/augmented.mjs').write_text(source.replace(anchor,anchor+extra));argv=['node','--experimental-vm-modules',str(repo/'work/resume/task04-model-drift-native-design-correction-c2-review/runner.mjs'),'augmented','augmented.mjs','strong36'];start=datetime.datetime.now(datetime.timezone.utc).isoformat();r=subprocess.run(argv,capture_output=True,text=True);(own/'augmented.stdout').write_text(r.stdout);(own/'augmented.stderr').write_text(r.stderr);(own/'augmented-command.json').write_text(json.dumps({'argv':argv,'cwd':str(repo),'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':r.returncode},indent=2));assert r.returncode==0,r.stderr;verify(json.loads((own/'outcomes-augmented.json').read_text()));
(own/'design-checks.json').write_text(json.dumps({'status':'PASS_STANDALONE_OFFLINE_ONLY','UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'all26TracesVerified':True,'adverseControls':controls,'targetRPC':2961,'createdUpper':444,'journalBytesUpper':7143424,'augmentedNewRunWindowOwnershipAssertions':'26/26 PASS_OFFLINE'},indent=2));print('PASS 26 exact traces, 5 adverse controls, arithmetic, 26 augmented outcomes')
