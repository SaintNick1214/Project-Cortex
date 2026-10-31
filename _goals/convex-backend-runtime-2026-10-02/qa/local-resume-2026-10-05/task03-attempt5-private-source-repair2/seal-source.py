"""Prospective B2 observation only, after all other writers have finished.

Never overwrites or refreshes a failed seal. A failed attempt is retained with
exact current deltas; any separately numbered later observation must be invoked
only after the failure cause/current stability has been assessed. No source or
operational approval is produced. Print-only final output is not a file writer.
"""
from pathlib import Path
import datetime, importlib.util, json, os, stat, sys
sys.dont_write_bytecode=True
B=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('repair2_seal_public_io',B/'receipt-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)
attempt=int(sys.argv[1]) if len(sys.argv)==2 else 1
assert attempt>=1
prefix='' if attempt==1 else 'prospective-'+str(attempt)+'-'
manifest=B/(prefix+'receipt-manifest.json');freeze=B/(prefix+'source-freeze.json')
failure=B/('seal-failure-'+str(attempt)+'.json')
assert not manifest.exists() and not freeze.exists() and not failure.exists()
# Only self/future seal artifacts are excluded. Prior failed seal files are
# regular historical members of a separately invoked prospective observation.
excluded={manifest.name,freeze.name,failure.name}
future=[
 'independent-private-coordinator-source-review.json',
 'task03-attempt5-private-coordinate-status.json',
 'Any later independent review or real first-use output: no such output exists in this sealed writer-finalized namespace; a later write invalidates exact membership.']
assert not (B/future[0]).exists() and not (B/future[1]).exists()
seen=[];directories=[];directory_deltas=[]
for root,dirs,files in os.walk(B,followlinks=False):
    root=Path(root);assert root.resolve(strict=True)==root
    dirs.sort();files.sort()
    for name in dirs:
        path=root/name;assert stat.S_ISDIR(path.lstat().st_mode) and not path.is_symlink()
    directories.append({'path':str(root.relative_to(B)),'identityDecimal':io.identity(root.lstat()),'names':sorted(os.listdir(root))})
    for name in files:
        path=root/name;assert not path.is_symlink() and stat.S_ISREG(path.lstat().st_mode)
        if str(path.relative_to(B)) not in excluded:seen.append(path)
seen.sort();rows=[];deltas=[];selfpins={}
try:
    for path in seen:
        raw,row=io.read(path);row['path']=str(path.relative_to(B));rows.append(row)
    # Stabilization/current assessment occurs before any new seal is written.
    for row in rows:
        raw,current=io.read(B/row['path'])
        assert current['sha256']==row['sha256'] and current['bytes']==row['bytes']
        if current['identityDecimal']!=row['identityDecimal']:
            deltas.append({'path':row['path'],'phase':'before-manifest','changes':{k:{'baseline':row['identityDecimal'][k],'current':current['identityDecimal'][k]} for k in io.FIELDS if row['identityDecimal'][k]!=current['identityDecimal'][k]}})
    assert not deltas,'PROSPECTIVE_CURRENT_IDENTITIES_CHANGED_BEFORE_MANIFEST'
    value={'scope':'PROSPECTIVE_CURRENT_REPAIR2_SOURCE_BYTES_ALL_NINE_FULL_EOF_NOT_APPROVAL','observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'attempt':attempt,'baselineStartsAfterCheckpoint18':'1b3c2bca8232488a037cb996875ae03706be65aa','writerFinalizedBeforeRead':True,'otherWritersStopped':True,'members':len(rows),'bytes':sum(row['bytes'] for row in rows),'files':rows,'selfAndFutureExcluded':sorted(excluded),'futureExcludedFilesAndPolicy':future,'historicalB1CustodyRepaired':False,'historicalUnknown215AndDummyDeltasRemainFailed':True,'historicalPinsRefreshed':False,'sourceApproved':False,'actualCustodyApproved':False,'actualProvisioning':False,'independentJudgment':False}
    io.dump_new(manifest,value)
    manifest_raw,manifest_pin=io.read(manifest)
    selfpins[manifest.name]=manifest_pin
    # Batch reread catches changes after a member's earlier EOF read.
    for row in rows:
        raw,current=io.read(B/row['path'])
        assert current['sha256']==row['sha256'] and current['bytes']==row['bytes']
        if current['identityDecimal']!=row['identityDecimal']:
            deltas.append({'path':row['path'],'phase':'after-manifest','changes':{k:{'baseline':row['identityDecimal'][k],'current':current['identityDecimal'][k]} for k in io.FIELDS if row['identityDecimal'][k]!=current['identityDecimal'][k]}})
    assert not deltas,'PROSPECTIVE_CURRENT_IDENTITIES_CHANGED_AFTER_MANIFEST'
    # Own root membership changes by the two exclusively created self artifacts.
    # Non-root directories, and every child membership, must stay exact.
    for row in directories:
        path=B/row['path'];current=io.identity(path.lstat());names=sorted(os.listdir(path))
        expected_names=sorted(row['names']+([manifest.name] if row['path']=='.' else []))
        if row['path']!='.' and (current!=row['identityDecimal'] or names!=expected_names):
            directory_deltas.append({'path':row['path'],'before':row,'current':current,'currentNames':names})
        if row['path']=='.':
            assert all(current[k]==row['identityDecimal'][k] for k in ('dev','ino','mode','uid','gid','nlink'))
            assert names==expected_names
    assert not directory_deltas,'PROSPECTIVE_NONROOT_DIRECTORY_DRIFT'
    source=next(row for row in rows if row['path']=='task03-attempt5-private-coordinate.py')
    selector=next(row for row in rows if row['path']=='task03-attempt5-retire-selector.py')
    value={'scope':'PROSPECTIVE_CURRENT_REPAIR2_WRITER_FINALIZED_SOURCE_FREEZE_NOT_APPROVAL','observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'attempt':attempt,'coordinatorSha256':source['sha256'],'coordinatorBytes':source['bytes'],'selectorSha256':selector['sha256'],'selectorBytes':selector['bytes'],'manifest':{'path':manifest.name,**{k:manifest_pin[k] for k in ('sha256','bytes','identityDecimal','PRE','POST','pathPOST','EOF')}},'members':len(rows),'memberBytes':sum(row['bytes'] for row in rows),'allMembersFinalAllNineFullEOFReread':'PASS','nonRootDirectoriesAndMembership':'PASS','directories':directories,'selfAndFutureExcluded':sorted(excluded),'futureExcludedFilesAndPolicy':future,'historicalAllNineB1Accepted':False,'historicalUnknown215AndDummyDeltasRepaired':False,'sourceApproved':False,'actualCustodyApproved':False,'realPublicCustodyDependency':'ABSENT_HELD','actualPrivateReads':0,'actualPrivateStats':0,'actualDockerCalls':0,'actualAPICalls':0,'Task03Accepted':False,'goalAccepted':False}
    io.dump_new(freeze,value)
    freezeraw,freezepin=io.read(freeze)
    selfpins[freeze.name]=freezepin
    for row in rows+[{'path':manifest.name,**manifest_pin},{'path':freeze.name,**freezepin}]:
        path=B/row['path'] if not Path(row['path']).is_absolute() else Path(row['path'])
        raw,current=io.read(path)
        changes={k:{'baseline':row['identityDecimal'][k],'current':current['identityDecimal'][k]} for k in io.FIELDS if row['identityDecimal'][k]!=current['identityDecimal'][k]}
        content_match=(current['sha256'],current['bytes'])==(row['sha256'],row['bytes'])
        if changes or not content_match:deltas.append({'path':str(path.relative_to(B)),'phase':'final-post-freeze','changes':changes,'contentStillMatches':content_match})
    assert not deltas,'PROSPECTIVE_FINAL_MEMBER_OR_SELF_SEAL_DRIFT'
    finalfiles=sorted(str(p.relative_to(B)) for p in B.rglob('*') if p.is_file())
    assert finalfiles==sorted([row['path'] for row in rows]+[manifest.name,freeze.name])
    print(json.dumps({'status':'PASS_CURRENT_PROSPECTIVE_ONLY','attempt':attempt,'members':len(rows),'memberBytes':sum(row['bytes'] for row in rows),'coordinatorSha256':source['sha256'],'selectorSha256':selector['sha256'],'manifest':manifest_pin,'freeze':freezepin,'filesInDirectoryIncludingExcludedSealArtifacts':len(rows)+2,'sourceApproved':False,'historicalCustodyRepaired':False,'allWritersStopped':True}))
except BaseException as error:
    # Preserve every original seal byte and pin. Observe all current members to
    # enumerate the exact failure, then stop; there is no automatic reseal loop.
    currentrows=[]
    for row in rows:
        try:
            raw,current=io.read(B/row['path']);current['path']=row['path'];currentrows.append(current)
            changes={k:{'baseline':row['identityDecimal'][k],'current':current['identityDecimal'][k]} for k in io.FIELDS if row['identityDecimal'][k]!=current['identityDecimal'][k]}
            if changes:deltas.append({'path':row['path'],'phase':'failure-assessment','changes':changes,'contentStillMatches':current['sha256']==row['sha256'] and current['bytes']==row['bytes']})
        except BaseException as observe:currentrows.append({'path':row['path'],'observationFailure':type(observe).__name__})
    for name,pin in selfpins.items():
        try:
            raw,current=io.read(B/name)
            changes={k:{'baseline':pin['identityDecimal'][k],'current':current['identityDecimal'][k]} for k in io.FIELDS if pin['identityDecimal'][k]!=current['identityDecimal'][k]}
            if changes:deltas.append({'path':name,'phase':'self-seal-failure-assessment','changes':changes,'contentStillMatches':current['sha256']==pin['sha256'] and current['bytes']==pin['bytes']})
            currentrows.append(current)
        except BaseException as observe:currentrows.append({'path':name,'observationFailure':type(observe).__name__})
    io.dump_new(failure,{'scope':'FAILED_PROSPECTIVE_SEAL_OBSERVATION_NOT_REPAIRED','attempt':attempt,'exceptionClass':type(error).__name__,'exceptionMessage':str(error),'exactIdentityDeltas':deltas,'directoryDeltas':directory_deltas,'currentMembers':currentrows,'causeEstablished':False,'cause':'UNKNOWN','originalPinsOrBytesOverwritten':False,'automaticResealAttempted':False,'sourceApproved':False})
    print(json.dumps({'status':'FAIL_PRESERVED_NO_RESEAL','attempt':attempt,'failureReceipt':failure.name,'exceptionClass':type(error).__name__,'identityDeltas':len(deltas)}))
    raise SystemExit(1)
