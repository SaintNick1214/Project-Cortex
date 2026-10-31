"""Final read-only rechecks and three disjoint review evidence seals."""
from pathlib import Path
import datetime, hashlib, json, os, stat, zipfile
from readcheck import read,identity,dump
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';P=QA/'local-resume-2026-10-05'
A=P/'task03-attempt5-public-repair2-review';B=P/'task03-attempt5-private-repair1-source-review';C=P/'task04-native-ci-actual-attempt2-review'

def delta(earlier,current):
    return {key:{'earlier':earlier[key],'current':current[key],'status':'UNKNOWN'} for key in earlier if earlier[key]!=current[key]}

def stream_recheck(path,prior,allow_fixture_hardlink=False):
    path=Path(path);assert path.resolve(strict=True)==path
    before=identity(path.lstat());expected=prior.get('PRE',prior.get('identityDecimal'))
    assert stat.S_ISREG(int(before['mode']))
    assert before['nlink']=='1' or allow_fixture_hardlink
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        assert identity(os.fstat(fd))==before
        size=0;h=hashlib.sha256()
        while True:
            block=os.read(fd,1048576)
            if not block:break
            size+=len(block);h.update(block)
        assert before==identity(os.fstat(fd))==identity(path.lstat())
    finally:os.close(fd)
    assert size==prior['bytes'] and h.hexdigest()==prior['sha256']
    return {'path':str(path),'bytes':size,'sha256':h.hexdigest(),'earlierIndependentIdentity':expected,'PRE':before,'POST':before,'pathPOST':before,'allNineStableDuringCurrentRead':True,'allNineEqualToEarlierIndependentRead':before==expected,'earlierIndependentIdentityDeltas':delta(expected,before),'originalSealedIdentityDeltas':delta(prior['sealedIdentityDecimal'],before) if 'sealedIdentityDecimal' in prior else None,'fullCurrentEOF':True,'fullBytesMatchEarlierIndependentRead':True,'intentionalFixtureHardlink':allow_fixture_hardlink,'originalPinsRefreshed':False,'causeEstablished':False}

now=datetime.datetime.now(datetime.timezone.utc).isoformat()
current=json.loads(read(A/'raw/current-public-1912-recheck.json')[0]);src=json.loads(read(A/'raw/source-manifest-recheck.json')[0])
arows=[stream_recheck(row['path'],row) for row in current['files']+src['members']]
afinal={'status':'FAIL_CURRENT_SOURCE_CONTINUITY_REJECT','observedAtUtc':now,'scope':'FINAL_CURRENT_PUBLIC_SOURCE_AND_ALL1912_CONTENT_ONLY','regularReadRows':len(arows),'allNineStableDuringCurrentReadAndFullBytesEOF':True,'allNineEarlierIndependentContinuityAccepted':False,'currentPrep1912IdentityDeltaCount':sum(bool(r['earlierIndependentIdentityDeltas']) for r in arows[:1912]),'currentSource23IdentityDeltaCount':sum(bool(r['earlierIndependentIdentityDeltas']) for r in arows[1912:]),'rows':arows,'actualCustody':False,'enablingAttestation':False}
dump(A/'final-current-recheck.json',afinal)
sources=json.loads(read(B/'raw/source-and-receipt-recheck.json')[0]);fixtures=json.loads(read(B/'raw/separate-existing-public-dummy-fixtures-recheck.json')[0]);bfrozen=json.loads(read(B/'raw/sealed-identity-deltas.json')[0])
brows=[stream_recheck(row['path'],row) for row in sources['members']]
brows += [stream_recheck(row['path'],row,row.get('intentionalNegativeHardlinkFixture',False)) for row in fixtures['regularFiles']]
dirrows=[]
for row in fixtures['directories']:
    path=Path(row['path']);before=identity(path.lstat())
    fd=os.open(path,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        assert identity(os.fstat(fd))==before and sorted(os.listdir(fd))==row['names']
        assert identity(os.fstat(fd))==identity(path.lstat())==before
    finally:os.close(fd)
    dirrows.append({'path':str(path),'allNineStableDuringCurrentReadAndMembershipEqual':True,'earlierIndependentIdentity':row['identityDecimal'],'PRE':before,'POST':before,'pathPOST':before,'earlierIndependentIdentityDeltas':delta(row['identityDecimal'],before)})
aliasrows=[]
for row in fixtures['symlinks']:
    path=Path(row['path']);before=identity(path.lstat())
    assert stat.S_ISLNK(int(before['mode'])) and os.readlink(path)==row['linkText'] and identity(path.lstat())==before
    aliasrows.append({'path':str(path),'linkText':row['linkText'],'PRE':before,'pathPOST':before,'earlierIndependentIdentityDeltas':delta(row['identityDecimal'],before),'literalAliasNotFollowed':True})
dump(B/'final-current-recheck.json',{'status':'FAIL_SOURCE_RELEASE_CURRENT_CONTENT_OBSERVATIONS_PRESERVED','observedAtUtc':now,'currentRegularReadRows':len(brows),'allCurrentHeldReadIdentitiesStableAndFullContentEOF':True,'sourceMembers':313,'separateDummyRegularFiles':11335,'sourceEarlierIndependentIdentityDeltaCount':sum(bool(r['earlierIndependentIdentityDeltas']) for r in brows[:313]),'sourceOriginalSealedIdentityDeltaCount':sum(bool(r['originalSealedIdentityDeltas']) for r in brows[:313]),'dummyRegularEarlierIndependentIdentityDeltaCount':sum(bool(r['earlierIndependentIdentityDeltas']) for r in brows[313:]),'dummyDirectoryEarlierIndependentIdentityDeltaCount':sum(bool(r['earlierIndependentIdentityDeltas']) for r in dirrows),'dummyAliasEarlierIndependentIdentityDeltaCount':sum(bool(r['earlierIndependentIdentityDeltas']) for r in aliasrows),'directories':dirrows,'literalAliases':aliasrows,'rows':brows,'initialOriginalSealedIdentityDeltas':bfrozen,'unknownHistoricalCtimeAccepted':False,'strictBooleanGuardVerdict':'REJECT_UNCHANGED','enablingAttestation':False})
receipts=json.loads(read(C/'raw/current-receipt-58-recheck.json')[0]);crows=[stream_recheck(row['path'],row) for row in receipts['members']]
archive=json.loads(read(C/'raw/independent-complete-zip-source-backing-proof.json')[0]);zipproof=stream_recheck(archive['archive']['path'],archive['archive'])
sourceproof=[]
with zipfile.ZipFile(archive['archive']['path']) as z:
    for row in archive['allSourceBackings']:
        h=hashlib.sha256();n=0
        with z.open('export/'+row['rawExactBacking']) as stream:
            while True:
                block=stream.read(1048576)
                if not block:break
                n+=len(block);h.update(block)
        assert n==row['bytes'] and h.hexdigest()==row['sha256']
        sourceproof.append({'path':row['path'],'bytes':n,'sha256':h.hexdigest(),'EOFandCRC':True})
assert identity(Path(archive['archive']['path']).lstat())==zipproof['PRE']
helpers=json.loads(read(C/'raw/native-files-aliases-directories-maps-and-exact-sources.json')[0])['declaredSources']
helperrows=[]
for row in helpers:
    local=R/'work/resume/task04-c8-physical-preparation-r3/native-ci-a5-repair3'/row['path']
    helperrows.append(stream_recheck(local,{'bytes':row['bytes'],'sha256':row['sha256'],'PRE':row['currentReadAllNine']}))
dump(C/'final-current-recheck.json',{'status':'PASS_ACTUAL_CAPABILITY_CONTENT_ONLY_HOST_CONTINUITY_FAIL_EXCLUDED','observedAtUtc':now,'currentReceipts':crows,'receiptRows':58,'currentHostReceiptContinuityAccepted':False,'currentHostReceiptIdentityDeltaCount':sum(bool(r['earlierIndependentIdentityDeltas']) for r in crows),'externalOnlyRetainedZip':zipproof,'completeSourceBackings':sourceproof,'sourceBackingFiles':2063,'sourceBackingBytes':sum(r['bytes'] for r in sourceproof),'sourceCurrentHelpers':helperrows,'sourceHelperCount':16,'nativeIdentityReacquisition':False,'ownerAuthority':'EXPIRED','originalRawTarReplayAvailable':False,'Task04Accepted':False,'enablingAttestation':False})
commands={
 A:{'commands':[{'command':'python3 -B task03-attempt5-public-repair2-review/verify.py','observedExit':1,'classification':'REVIEWER_WRONG_MANIFEST_NAME_PRESERVED'},{'command':'python3 -B task03-attempt5-public-repair2-review/verify.py','observedExit':0,'stdout':'{"status": "PASS", "sourceMembers": 23, "publicFilesReadToEOF": 1912, "freshMockedGuards": 10}','stderr':''}]},
 B:{'commands':[{'command':'python3 -B task03-attempt5-private-repair1-source-review/verify.py','observedExit':1,'classification':'ACTUAL_SEALED_CTIME_FAILURE_PRESERVED'},{'command':'python3 -B task03-attempt5-private-repair1-source-review/verify.py','observedExit':1,'classification':'REVIEWER_INTENTIONAL_HARDLINK_NEGATIVE_SETUP_PRESERVED'},{'command':'python3 -B task03-attempt5-private-repair1-source-review/verify.py','observedExit':0,'stdout':'{"reviewVerification": "COMPLETE", "blockingGuardFailures": 4, "sourceFirstUseApproved": false, "freshMainFlowControls": 10}','stderr':'','interpretation':'Reviewer command completed; candidate guard failures and sealed UNKNOWN deltas remain REJECT.'}]},
 C:{'commands':[{'command':'python3 -B task04-native-ci-actual-attempt2-review/verify.py','observedExit':1,'classification':'REVIEWER_NOMINAL_CACHED_PATH_SETUP_PRESERVED'},{'command':'python3 -B task04-native-ci-actual-attempt2-review/verify.py','observedExit':0,'stdout':'{"status": "PASS_BOUNDED_ACTUAL", "sourceBackingsIndependentlyStreamed": 2063, "sourceBytes": 155019678, "ownerAuthority": "EXPIRED", "Task04Accepted": false}','stderr':''}]}
}
for directory,rows in commands.items():
    rows['commands'].append({'command':'python3 -B task03-attempt5-public-repair2-review/finalize-all.py strict first pass','observedExit':1,'classification':'CURRENT_CTIME_CONTINUITY_FAILURE_PRESERVED_NO_PIN_REFRESH'})
    rows['scope']='OBSERVED_TOOL_COMMAND_OUTCOMES_TRANSCRIBED_WITH_RAW_CASE_EVIDENCE_SEPARATELY';rows['DockerCalls']=rows['credentialReads']=rows['APICalls']=0
    dump(directory/'command-receipts.json',rows)
    print(json.dumps({'review':directory.name,'verdict':json.loads(read(directory/'verdict.json')[0])['verdict'],'currentRecheckWritten':True}))
