from pathlib import Path
import ast, copy, importlib.util, json, types
from readcheck import read, manifest, dump

R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA=R/'_goals/convex-backend-runtime-2026-10-02/qa'
P=QA/'local-resume-2026-10-05'; Q=QA/'task03-local-native-attempt5-2026-10-06'
B=Q/'coordinate-source/repair2'; OUT=Path(__file__).parent
value,pin,rows=manifest(B,'source-receipt-manifest.json',23,'73cde47e71c30a1fa63f8d9d04ee10c8950ef15d964ddd1a8f7dbfe01751b304',11381)
dump(OUT/'raw/source-manifest-recheck.json',{'manifest':pin,'members':rows})
freeze_raw,freeze_pin=read(Q/'candidate-freeze-attempt5.json')
assert freeze_pin['sha256']=='053e131a8f408031af7ead1e2c8c73f75954ba5acd905eac9e6091a24429e570'
freeze=json.loads(freeze_raw); assert len(freeze['files'])==1905
allpaths={r['path']:r for r in freeze['files']}; assert len(allpaths)==1905
baseline=json.loads(read(Q/'managed-fixture-copy-manifest.json')[0])
generated={r['copy']:r for r in baseline['files'] if r.get('officialCodegenMutable') is True}
assert len(generated)==5
assert set(generated)=={'managed-fixture/fixture/convex/_generated/'+n for n in ['api.d.ts','api.js','dataModel.d.ts','server.d.ts','server.js']}
publicnames=list(allpaths)+['candidate-freeze-attempt5.json','independent-preparation-review.json']+list(generated)
assert len(publicnames)==len(set(publicnames))==1912
pins={**allpaths,**generated}; publicrows=[]
for name in publicnames: publicrows.append(read(Q/name,pins.get(name))[1])
dump(OUT/'raw/current-public-1912-recheck.json',{'freeze':freeze_pin,'files':publicrows,'allCurrentReadIdentities':'PASS_ALL9','fullBytesEOF':True,'preparationMembers':1905,'publicCopiedFiles':1912,'destinationNotAcquired':True})
for name in ['task03-attempt5-coordinate-common.py','task03-attempt5-linux-public-transfer.py']:
    assert read(B/name)[0]==read(B/'preimages'/name)[0]
spec=importlib.util.spec_from_file_location('independent_public_source',B/'task03-attempt5-public-coordinate.py')
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
recipe=json.loads(read(B/'public-recipe-binding.json')[0])
assert m.P==B and recipe['ownedSourceMounts']=={'candidate':str(Q),'helper':str(B)}
assert recipe['recipeNamespace']==str(B.relative_to(R)) and recipe['publicCopiedFiles']==1912
base={'Name':'/'+m.NAMES['copy'],'Image':m.IMAGE,'Config':{'User':'501:20','Labels':{'cortex.operation':m.OP}},'HostConfig':{'NetworkMode':'none','ReadonlyRootfs':True,'Memory':536870912,'MemorySwap':536870912},'State':{'Running':False,'OOMKilled':False,'ExitCode':0},'Mounts':[{'Type':'volume','Name':m.VOLUME,'Destination':'/owned','RW':True},{'Type':'bind','Source':str(Q),'Destination':'/input','RW':False},{'Type':'bind','Source':str(B),'Destination':'/helper','RW':False}]}
controls=[]
for name,change,rejected in [('literal',lambda o:None,False),('old-candidate-prefix',lambda o:o['Mounts'][1].update(Source='/host_mnt'+str(Q)),True),('old-helper-prefix',lambda o:o['Mounts'][2].update(Source='/host_mnt'+str(B)),True),('parent-alias',lambda o:o['Mounts'][2].update(Source=str(B.parent)),True),('candidate-other',lambda o:o['Mounts'][1].update(Source=str(Q.parent)),True),('writable-helper',lambda o:o['Mounts'][2].update(RW=True),True),('writable-candidate',lambda o:o['Mounts'][1].update(RW=True),True),('mount-count',lambda o:o['Mounts'].append(copy.deepcopy(o['Mounts'][2])),True),('unknown-terminal',lambda o:None,True),('close-error',lambda o:None,True)]:
    obj=copy.deepcopy(base); change(obj); calls=[]
    def run(label,argv,*args,**kwargs):
        calls.append({'label':label,'argv':argv,'effectsBlocked':True})
        row={'terminal':name!='unknown-terminal','closeErrors':['CONTROLLED'] if name=='close-error' else [],'exitCode':0,'failureClass':None}
        return row,json.dumps([obj]).encode() if 'inspect' in argv else b'CONTROLLED_PUBLIC_SOURCE',b''
    m.C=types.SimpleNamespace(run=run); m.records=[]; error=None
    try:m.execute('copy','501:20',[],['CONTROLLED_PUBLIC_SOURCE'],30)
    except AssertionError as e:error=type(e).__name__
    assert bool(error)==rejected
    if rejected:assert not any(c['label']=='copy-run' for c in calls)
    controls.append({'name':name,'expectedRejected':rejected,'observedRejected':bool(error),'calls':calls})
dump(OUT/'raw/independent-current-source-guards.json',{'status':'PASS','checks':len(controls),'cases':controls,'DockerCalls':0,'actualCustody':False})
history=[]
for name in ['task03-attempt5-public-source-review','task03-attempt5-public-repair1-review','task03-attempt5-preparation-review','task03-attempt5-management-review']:
    v=json.loads(read(P/name/'verdict.json')[0]); history.append({'review':name,'verdict':v})
assert history[0]['verdict']['verdict']=='REJECT' and history[1]['verdict']['verdict']=='PASS'
prep=json.loads(read(Q/'independent-preparation-review.json')[0]); mgmt=json.loads(read(P/'task03-attempt5-management-review.json')[0])
assert prep['candidateSha256']==mgmt['candidateSha256']==m.FREEZE
assert prep['independentSourceReview']==str((P/'task03-attempt5-preparation-review/verdict.json').relative_to(R))
assert mgmt['independentSourceReview']==str((P/'task03-attempt5-management-review/verdict.json').relative_to(R))
for wrapper,directory in [(prep,'task03-attempt5-preparation-review'),(mgmt,'task03-attempt5-management-review')]:
    assert wrapper['verdict']=='PASS' and wrapper['independent'] is True
    assert wrapper['independentSourceEvidenceManifestSha256']==read(P/directory/'evidence-manifest.json')[1]['sha256']
access1=json.loads(read(P/'task03-attempt5-public-bind-access1/failure.json')[0]); assert access1['status']=='FAIL'
access2=json.loads(read(P/'task03-attempt5-public-bind-access2/outcome.json')[0]);assert access2['result']['status']=='PASS' and access2['result']['candidateCopy'] is False
initial=json.loads(read(P/'task03-attempt5-public-bind-access2/initial-inspect.json')[0])
if isinstance(initial,list):initial=initial[0]
assert all(any(x['Source']==str(source) and x['Destination']==target and x['RW'] is False for x in initial['Mounts']) for source,target in [(Q,'/input'),(Q/'coordinate-source/repair1','/helper')])
assert read(B/'task03-attempt5-linux-public-transfer.py')[1]['sha256']==next(x['sha256'] for x in access2['result']['rows'] if x['path'].endswith('linux-public-transfer.py'))
for diagnostic in ['task03-attempt5-public-bind-access1','task03-attempt5-public-bind-access2']:
    cleanup=json.loads(read(P/diagnostic/'cleanup.json')[0]);assert cleanup['ownedContainerAbsent'] is True
dump(OUT/'raw/history-and-operational-reviews.json',{'history':history,'preparationWrapper':prep,'managementWrapper':mgmt,'access1':access1,'access2':access2,'independentSourceInspection':True,'access2HelperNamespace':'repair1 actual diagnostic; exact unchanged helper bytes/current repair2 prospective recipe'})
dump(OUT/'raw/summary.json',{'status':'PASS','manifest':pin,'freeze':freeze_pin,'regularSourceMembers':23,'preparationMembers':1905,'currentPublicCopiedFiles':1912,'independentGuards':len(controls),'actualSourceGuardEffects':'MOCKED_ONLY','enablingAttestationWritten':False,'actualPublicCandidateCustody':False})
print(json.dumps({'status':'PASS','sourceMembers':23,'publicFilesReadToEOF':1912,'freshMockedGuards':len(controls)}))
