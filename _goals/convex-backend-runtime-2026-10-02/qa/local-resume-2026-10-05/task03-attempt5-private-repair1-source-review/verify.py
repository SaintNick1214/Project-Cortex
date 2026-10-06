"""Bounded independent source judgment. No external effects or private reads."""
from pathlib import Path
import ast, copy, hashlib, importlib.util, json, os, stat, types
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA=R/'_goals/convex-backend-runtime-2026-10-02/qa'; P=QA/'local-resume-2026-10-05'
B=P/'task03-attempt5-private-source-repair1'; OUT=Path(__file__).parent
s=importlib.util.spec_from_file_location('review_readcheck',P/'task03-attempt5-public-repair2-review/readcheck.py')
h=importlib.util.module_from_spec(s);s.loader.exec_module(h)
dump,identity=h.dump,h.identity
identity_deltas=[]
def read(path,expected=None):
    if expected and int(expected.get('identityDecimal',{}).get('nlink','1'))>1:
        # The selector's intentional hardlink-negative fixture has two links.
        # Observe both exact identities/content without treating it as source.
        path=Path(path);assert path.resolve(strict=True)==path
        before=identity(path.lstat());assert stat.S_ISREG(int(before['mode']))
        fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
        try:
            assert before==identity(os.fstat(fd));blocks=[]
            while True:
                block=os.read(fd,1048576)
                if not block:break
                blocks.append(block)
            assert before==identity(os.fstat(fd))==identity(path.lstat())
        finally:os.close(fd)
        content=b''.join(blocks);row={'path':str(path),'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest(),'PRE':before,'POST':before,'pathPOST':before,'EOF':True,'intentionalNegativeHardlinkFixture':True}
        assert row['bytes']==expected['bytes'] and row['sha256']==expected['sha256']
    else:
        content,row=h.read(path,{k:v for k,v in expected.items() if k!='identityDecimal'} if expected else None)
    if expected and 'identityDecimal' in expected:
        old=expected['identityDecimal'];changes={k:{'sealed':old[k],'current':row['PRE'][k]} for k in h.FIELDS if old[k]!=row['PRE'][k]}
        row['sealedIdentityDecimal']=old;row['sealedIdentityComparison']='FAIL' if changes else 'PASS'
        if changes:identity_deltas.append({'path':str(path),'changes':changes,'fullContentStillMatches':True,'historicalAllNineRestored':False})
    return content,row
manifestraw,pin=read(B/'receipt-manifest.json');assert pin['sha256']=='d27c0a0d799392b0c14ab7aa4d87c4c605f6f9114b277f48c445b40fd509256c' and pin['bytes']==162161
value=json.loads(manifestraw);assert len(value['files'])==313 and len({r['path'] for r in value['files']})==313
rows=[read(B/r['path'],r)[1] for r in value['files']]
raw,freeze=read(B/'source-freeze.json');assert freeze['sha256']=='367b5d0da8f21b6a5bc7d1526c2bc2d3b6d115f173a5393f3c6f9d277d72bdc4'
source,sourcepin=read(B/'task03-attempt5-private-coordinate.py');assert sourcepin['sha256']=='55d427ca84fed1d957edc40940c558e0659fd6b132e606f2e538fe8a8d3345f9' and sourcepin['bytes']==21376
selector,selectorpin=read(B/'task03-attempt5-retire-selector.py');assert selectorpin['sha256']=='6ed06bdfb8a5499bdc2fabeda7ef2e3f4aa23a881011172ed810dd969818550a'
dump(OUT/'raw/source-and-receipt-recheck.json',{'manifest':pin,'freeze':freeze,'source':sourcepin,'selector':selectorpin,'members':rows})
fixtures=json.loads(read(B/'fixture-inventory.json')[0]); assert fixtures['regularFiles']==11335 and fixtures['symlinks']==2
filerows=[read(B/r['path'],r)[1] for r in fixtures['files']]
directoryrows=[]
for row in fixtures['directoryIdentities']:
    path=B/row['path']; assert path.resolve(strict=True)==path
    before=identity(path.lstat());assert before==row['identityDecimal'] and stat.S_ISDIR(int(before['mode']))
    fd=os.open(path,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        assert identity(os.fstat(fd))==before
        names=sorted(os.listdir(fd));assert identity(os.fstat(fd))==identity(path.lstat())==before
    finally:os.close(fd)
    directoryrows.append({'path':str(path),'identityDecimal':before,'names':names})
symlinks=[]
for row in fixtures['symlinkRecords']:
    path=B/row['path'];before=identity(path.lstat());literal=os.readlink(path)
    assert before==row['identityDecimal']==identity(path.lstat()) and literal==row['linkText']
    symlinks.append({'path':str(path),'identityDecimal':before,'linkText':literal,'followed':False})
dump(OUT/'raw/separate-existing-public-dummy-fixtures-recheck.json',{'regularFiles':filerows,'directories':directoryrows,'symlinks':symlinks,'regularCount':11335,'symlinkCount':2,'actualPrivateReads':0,'largeFixturesRegenerated':False})
preimages=json.loads(read(B/'preimages.json')[0]);preimageproof=[]
for row in preimages['preservedCurrentSourcePreimages']:
    original,proof=read(R/row['path'],row)
    assert read(B/'preimages'/Path(row['path']).name)[0]==original;preimageproof.append(proof)
dump(OUT/'raw/parent-preimages-current-recheck.json',{'preimages':preimageproof,'parentSourcesChanged':False,'intermediateCloseOrderingSourcePreserved':(B/'preimages/repair1-run2-task03-attempt5-private-coordinate.py').is_file()})
deps=json.loads(read(B/'dependency-pins.json')[0]);depproof=[]
for row in deps['dependencies']:
    path=R/row['path']
    if row['state']=='ABSENT_HELD_ACTUAL_CUSTODY_DEPENDENCY':assert not path.exists();depproof.append(row)
    else:depproof.append(read(path,row)[1])
assert len(depproof)==12 and sum(r.get('state')=='ABSENT_HELD_ACTUAL_CUSTODY_DEPENDENCY' for r in depproof)==1
assert not (B/'independent-private-coordinator-source-review.json').exists()
dump(OUT/'raw/exact-eleven-present-one-held-dependencies.json',{'dependencies':depproof,'productionSourceApprovalAbsent':True,'actualPublicCustodyAbsentHeld':True,'futureTwelfthBindingRequiresActualCustodyAndParentInspection':True})
controls=json.loads(read(B/'mocked-coordinator-controls-run3.json')[0]);assert controls['status']=='PASS' and controls['controls']==86
controlproof=[]
for case in controls['cases']:
    rawcase=json.loads(read(B/'raw/run3'/(case['name']+'.json'))[0]);assert rawcase['status']=='PASS'
    assert rawcase['expectedCandidateOutcome']==rawcase['observedCandidateOutcome']
    assert rawcase['allExternalEffectsMocked'] is True and rawcase['actualAPICalls']==rawcase['actualDockerCalls']==rawcase['realPrivateReads']==0
    events=rawcase['events'];provision='fake-api:provision' in events
    if provision:assert 'fake-retire-attempt' in events
    if rawcase['observedCandidateOutcome']=='PASS':
        final=max(i for i,e in enumerate(events) if e=='fake-all-nine-source-verify');window=events.index('fake-status:ACTUAL_PRIVATE_TRANSFER_AWAITING_INDEPENDENT_REVIEW')
        assert events.index('fake-durable:host-source-custody.json')<final<window
        for fd in [9100,9101,9102,9103,9199,9000,9001,9002,9099]:
            e='fake-source-close:'+str(fd);assert events.count(e)==1 and final<events.index(e)<window
    if case['name']=='provision-no-ownership':assert 'fake-api:exclusive-retirement' not in events
    controlproof.append({'name':case['name'],'observedOutcome':rawcase['observedCandidateOutcome'],'checkedProvisionRequiresRetirementAttempt':provision,'mockOnly':True})
selectors=json.loads(read(B/'selector-filesystem-controls.json')[0]);assert selectors['status']=='PASS' and selectors['controls']==28
assert selectors['actualHostFilesystem']==24 and selectors['actualInputGuards']==4
dump(OUT/'raw/original-controls-evidence-review.json',{'currentRun3CoordinatorControls':controlproof,'actualPublicDummySelectorControls':selectors,'untestedBooleanMountAliases':'NoCopy=1, ReadOnly=1, mount RW=0 are absent from original86'})
spec=importlib.util.spec_from_file_location('review_current_private',B/'task03-attempt5-private-coordinate.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
base={'Name':'/'+m.NAME,'Image':m.IMAGE,'Config':{'Labels':{'cortex.operation':m.OP},'User':'501:20'},'HostConfig':{'NetworkMode':'none','ReadonlyRootfs':True,'Memory':536870912,'MemorySwap':536870912,'PidsLimit':64,'NanoCpus':2000000000,'Mounts':[{'Type':'volume','Source':m.VOLUME,'Target':'/owned','VolumeOptions':{'NoCopy':True}},{'Type':'volume','Source':m.VOLUME,'Target':'/prep','ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}}]},'Mounts':[{'Type':'volume','Name':m.VOLUME,'Destination':'/owned','RW':True},{'Type':'volume','Name':m.VOLUME,'Destination':'/prep','RW':False}],'State':{'Running':False}}
mutations=[('exact',lambda o:None,False),('name',lambda o:o.update(Name='/foreign'),True),('operation',lambda o:o['Config']['Labels'].update({'cortex.operation':'foreign'}),True),('image',lambda o:o.update(Image='foreign'),True),('user',lambda o:o['Config'].update(User='0:0'),True),('network',lambda o:o['HostConfig'].update(NetworkMode='host'),True),('memory',lambda o:o['HostConfig'].update(Memory=1),True),('swap',lambda o:o['HostConfig'].update(MemorySwap=1),True),('pids',lambda o:o['HostConfig'].update(PidsLimit=1),True),('cpu',lambda o:o['HostConfig'].update(NanoCpus=1),True),('subpath',lambda o:o['HostConfig']['Mounts'][1]['VolumeOptions'].update(Subpath='foreign'),True),('mountsource',lambda o:o['HostConfig']['Mounts'][0].update(Source='foreign'),True),('mountdestination',lambda o:o['Mounts'][1].update(Destination='/foreign'),True),('volumeview',lambda o:o['Mounts'][1].update(Name='foreign'),True),('Running_zero',lambda o:o['State'].update(Running=0),True),('ReadonlyRootfs_one',lambda o:o['HostConfig'].update(ReadonlyRootfs=1),True),('NoCopy_one',lambda o:o['HostConfig']['Mounts'][0]['VolumeOptions'].update(NoCopy=1),True),('ReadOnly_one',lambda o:o['HostConfig']['Mounts'][1].update(ReadOnly=1),True),('RW_zero',lambda o:o['Mounts'][1].update(RW=0),True),('RW_one',lambda o:o['Mounts'][0].update(RW=1),True)]
recipeproof=[]
for name,change,reject in mutations:
    obj=copy.deepcopy(base);change(obj);error=None
    try:m.assert_recipe(obj,m.NAME)
    except AssertionError as exc:error=type(exc).__name__
    recipeproof.append({'name':name,'expectedRejected':reject,'observedRejected':bool(error),'status':'PASS' if reject==bool(error) else 'FAIL','exactInput':obj,'actualDockerCalls':0})
dump(OUT/'raw/independent-exact-recipe-and-false-alias-controls.json',{'status':'FAIL','controls':len(recipeproof),'cases':recipeproof,'source':sourcepin,'blockingLines':[181,185],'acceptedInvalidNumericBooleanAliases':['NoCopy=1','ReadOnly=1','RW=0','RW=1']})
# Execute only selected actual main-flow cases from the existing harness in a
# fresh public review namespace. Never regenerate the full 11335-file fixture.
tree=ast.parse(read(B/'mocked-coordinator-controls.py')[0]); definitions=[n for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom,ast.FunctionDef,ast.ClassDef))]
focus=OUT/'focused-controls';focus.mkdir();rawdir=focus/'raw/fresh';rawdir.mkdir(parents=True)
g={'__name__':'independent_focused_controls','__file__':str(focus/'runner.py'),'B':focus,'SOURCE':B/'task03-attempt5-private-coordinate.py','RESULTS':[],'RUN_ID':'fresh','RAW':rawdir}
exec(compile(ast.Module(body=definitions,type_ignores=[]),str(B/'mocked-coordinator-controls.py'),'exec'),g)
for name,fault,expected,no_provision in [('happy-flow',None,'PASS',False),('approval-absent','approval-absent','FAIL',True),('provision-unknown','provision-unknown','FAIL',False),('transport-unknown','transport-unknown','FAIL',False),('descriptor-close','descriptor-close','FAIL',False),('producer-close','producer-close','FAIL',False),('cleanup-foreign','cleanup-foreign','FAIL',False),('provision-no-ownership','provision-no-ownership','FAIL',False),('wait-deadline','wait-deadline','FAIL',False),('terminal-receipt','terminal-receipt','FAIL',False)]:
    g['scenario'](name,fault=fault,expected=expected,no_provision=no_provision)
dump(OUT/'raw/independent-ten-focused-main-flow-controls.json',{'status':'PASS','controls':len(g['RESULTS']),'cases':g['RESULTS'],'allExternalEffectsMocked':True,'productionApprovalWritten':False})
dump(OUT/'raw/sealed-identity-deltas.json',{'status':'FAIL' if identity_deltas else 'PASS','deltas':identity_deltas,'historicalAllNineRestored':False,'pinRefreshPerformed':False})
dump(OUT/'raw/summary.json',{'status':'BLOCKING_SOURCE_DEFECT_CONFIRMED','sourceSha256':sourcepin['sha256'],'manifestSha256':pin['sha256'],'freezeSha256':freeze['sha256'],'sourceRegularMembers':313,'sealedIdentityDeltas':len(identity_deltas),'existingPublicDummyFilesRead':11335,'existingPublicDummyAliasesReadWithoutFollowing':2,'retainedRun3Controls':86,'selectorHostControls':24,'parserControls':4,'freshMainFlowControls':10,'freshRecipeControls':len(recipeproof),'blockingGuardFailures':sum(r['status']=='FAIL' for r in recipeproof),'sourceFirstUseApproved':False,'actualCustodyDependencyAbsent':True})
print(json.dumps({'reviewVerification':'COMPLETE','blockingGuardFailures':sum(r['status']=='FAIL' for r in recipeproof),'sourceFirstUseApproved':False,'freshMainFlowControls':10}))
