"""Seal three finalized independent review outputs; no operational approval."""
from pathlib import Path
import datetime,json,os,stat
from readcheck import read,dump
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
NAMES=('task03-attempt5-public-repair2-review','task03-attempt5-private-repair1-source-review','task04-native-ci-actual-attempt2-review')
for name in NAMES:
    directory=P/name
    verdict=json.loads(read(directory/'verdict.json')[0])
    final=json.loads(read(directory/'final-current-recheck.json')[0])
    expected={'task03-attempt5-public-repair2-review':('REJECT',3.4),'task03-attempt5-private-repair1-source-review':('REJECT',2.8),'task04-native-ci-actual-attempt2-review':('PASS',4.2)}[name]
    assert verdict['verdict']==expected[0] and verdict['average']==expected[1]
    assert sum(verdict['scores'].values())/5==expected[1]
    assert f'{expected[1]}/5' in read(directory/'report.md')[0].decode()
    assert final['enablingAttestation'] is False
    if name==NAMES[0]:
        assert final['currentPrep1912IdentityDeltaCount']==1912 and final['currentSource23IdentityDeltaCount']==23
        assert len(final['rows'])==1935 and all(r['fullCurrentEOF'] and r['fullBytesMatchEarlierIndependentRead'] and r['allNineStableDuringCurrentRead'] for r in final['rows'])
    elif name==NAMES[1]:
        assert final['sourceEarlierIndependentIdentityDeltaCount']==212 and final['sourceOriginalSealedIdentityDeltaCount']==215
        assert final['dummyRegularEarlierIndependentIdentityDeltaCount']==4477 and final['dummyDirectoryEarlierIndependentIdentityDeltaCount']==1059 and final['dummyAliasEarlierIndependentIdentityDeltaCount']==0
        assert len(final['rows'])==11648 and len(final['directories'])==2754 and len(final['literalAliases'])==2
        assert all(r['fullCurrentEOF'] and r['fullBytesMatchEarlierIndependentRead'] and r['allNineStableDuringCurrentRead'] for r in final['rows'])
    else:
        assert final['currentHostReceiptIdentityDeltaCount']==58 and len(final['sourceCurrentHelpers'])==16
        assert final['sourceBackingFiles']==2063 and final['sourceBackingBytes']==155019678
        assert final['externalOnlyRetainedZip']['allNineEqualToEarlierIndependentRead'] and not final['externalOnlyRetainedZip']['earlierIndependentIdentityDeltas']
        assert all(r['fullCurrentEOF'] and r['fullBytesMatchEarlierIndependentRead'] and r['allNineStableDuringCurrentRead'] for r in final['currentReceipts']+final['sourceCurrentHelpers'])
    dump(directory/'finalization-status.json',{'observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'FINALIZED_INDEPENDENT_REVIEW_ONLY','verdict':verdict['verdict'],'average':verdict['average'],'reportVerdictScoreAndFinalEnumerationAgree':True,'currentFullByteAndPerReadAllNineChecksComplete':True,'allHistoricalAndCurrentContinuityFailuresPreserved':True,'supersededReviewerDraftsAreNotFinalVerdicts':True,'originalPinsRefreshed':False,'identityDeltaCausesEstablished':False,'enablingAttestationWritten':False,'actualPrivateOrCredentialReads':0,'DockerCalls':0,'APICalls':0,'GitWorkflowSourceOtherChatMutations':0,'Task03Accepted':False,'Task04Accepted':False,'goalAccepted':False})
    proof=[]
    for path in sorted(directory.rglob('*')):
        if path.name=='evidence-manifest.json':continue
        s=path.lstat()
        assert not stat.S_ISLNK(s.st_mode),('Unexpected review alias',str(path))
        if stat.S_ISREG(s.st_mode):
            raw,row=read(path);row['path']=str(path.relative_to(directory));proof.append(row)
        else:assert stat.S_ISDIR(s.st_mode)
    manifest={'scope':'FINAL_INDEPENDENT_REVIEW_EVIDENCE_ONLY_NOT_OPERATIONAL_APPROVAL','verdict':verdict['verdict'],'average':verdict['average'],'regularFiles':len(proof),'bytes':sum(row['bytes'] for row in proof),'files':proof,'selfExcluded':True,'enablingAttestation':False,'originalPinsRefreshed':False}
    dump(directory/'evidence-manifest.json',manifest)
    # Re-open the saved exact manifest and verify every own evidence member.
    raw,sealed=read(directory/'evidence-manifest.json')
    reread=json.loads(raw);assert reread==manifest
    for row in reread['files']:
        _,actual=read(directory/row['path'],{'bytes':row['bytes'],'sha256':row['sha256'],'identityDecimal':row['PRE']})
        assert actual['PRE']==actual['POST']==actual['pathPOST']==row['PRE']
    print(json.dumps({'review':name,'verdict':verdict['verdict'],'average':verdict['average'],'evidenceManifestSha256':sealed['sha256'],'evidenceManifestBytes':sealed['bytes'],'regularEvidenceFiles':len(proof),'evidenceBytes':manifest['bytes'],'allOwnManifestFilesReopenedToEOFAllNineMatch':True,'enablingAttestation':False}))
