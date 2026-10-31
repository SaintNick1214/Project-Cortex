"""Distinct final reviewer evidence seal; preserve B's rejected first own seal."""
from pathlib import Path
import datetime,json,stat,time
import importlib.util
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
A=P/'task03-attempt5-public-repair2-review';B=P/'task03-attempt5-private-repair1-source-review';C=P/'task04-native-ci-actual-attempt2-review'
spec=importlib.util.spec_from_file_location('independent_review_readcheck',A/'readcheck.py');reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
read,dump=reader.read,reader.dump
original,pin=read(B/'evidence-manifest.json');first=json.loads(original)
deltas=[]
for row in first['files']:
    _,current=read(B/row['path'],{'bytes':row['bytes'],'sha256':row['sha256']})
    changes={key:{'sealed':row['PRE'][key],'current':current['PRE'][key],'status':'UNKNOWN'} for key in row['PRE'] if row['PRE'][key]!=current['PRE'][key]}
    if changes:deltas.append({'path':row['path'],'earlierManifestIdentity':row['PRE'],'PRE':current['PRE'],'POST':current['POST'],'pathPOST':current['pathPOST'],'identityDeltas':changes,'fullBytesMatch':True,'fullEOF':True})
assert deltas
failure={'status':'FAIL_FIRST_OWN_REVIEW_EVIDENCE_SEAL_CONTINUITY','command':'python3 -B task03-attempt5-public-repair2-review/seal-reviews.py','observedExit':1,'failedManifest':'evidence-manifest.json','failedManifestSha256':pin['sha256'],'failedManifestBytes':pin['bytes'],'firstFailurePath':'finalization-status.json','firstFailureSealedCtime':'1791282242118802024','firstFailureCurrentCtime':'1791282242203688624','completeCurrentOwnEvidenceDeltaEnumeration':deltas,'firstManifestBytesPreserved':True,'fullBytesMatch':True,'candidateSourcePinsRefreshed':False,'causeEstablished':False,'candidateVerdict':'REJECT','enablingAttestation':False}
dump(B/'raw/first-own-review-evidence-seal-failure.json',failure)
with (B/'report.md').open('a') as out:out.write('\n## Final reviewer evidence\n\nThe first reviewer `evidence-manifest.json` failed its immediate all-nine reread on the newly written `finalization-status.json` ctime. Its exact bytes and failed pins remain unchanged, with the exact failure and complete current own-file delta enumeration in `raw/first-own-review-evidence-seal-failure.json`. A distinct `final-evidence-manifest.json` covers the complete finalized reviewer evidence, including the failed first manifest and failure receipt. This distinct reviewer-evidence observation provides no repair or release of candidate source identities and does not change REJECT2.8. The cause of the own-file ctime change remains UNKNOWN.\n')
if not (C/'finalization-status.json').exists():
    dump(C/'finalization-status.json',{'observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'FINALIZED_INDEPENDENT_ACTUAL_CAPABILITY_CONTENT_REVIEW_ONLY','verdict':'PASS','average':4.2,'reportVerdictScoreAndFinalEnumerationAgree':True,'currentFullByteAndPerReadAllNineChecksComplete':True,'currentHostSealContinuity':'FAIL_EXCLUDED_NOT_REPAIRED','ownerAuthority':'EXPIRED','originalRawTarReplayAvailable':False,'allHistoricalAndCurrentContinuityFailuresPreserved':True,'originalPinsRefreshed':False,'identityDeltaCausesEstablished':False,'enablingAttestationWritten':False,'actualPrivateOrCredentialReads':0,'DockerCalls':0,'APICalls':0,'GitWorkflowSourceOtherChatMutations':0,'Task03Accepted':False,'Task04Accepted':False,'goalAccepted':False})
# Final reviewer writes are complete. Stability is measured, not inferred.
time.sleep(0.5)
for directory,name in ((B,'final-evidence-manifest.json'),(C,'evidence-manifest.json')):
    proof=[]
    for path in sorted(directory.rglob('*')):
        if path.name==name:continue
        s=path.lstat();assert not stat.S_ISLNK(s.st_mode)
        if stat.S_ISREG(s.st_mode):
            _,row=read(path);row['path']=str(path.relative_to(directory));proof.append(row)
        else:assert stat.S_ISDIR(s.st_mode)
    # Require every writer-finalized own file to remain stable through reread
    # before constructing a distinct current evidence manifest.
    for row in proof:read(directory/row['path'],{'bytes':row['bytes'],'sha256':row['sha256'],'identityDecimal':row['PRE']})
    verdict=json.loads(read(directory/'verdict.json')[0])
    manifest={'scope':'FINAL_INDEPENDENT_REVIEW_EVIDENCE_ONLY_NOT_OPERATIONAL_APPROVAL','verdict':verdict['verdict'],'average':verdict['average'],'regularFiles':len(proof),'bytes':sum(row['bytes'] for row in proof),'files':proof,'selfExcluded':True,'enablingAttestation':False,'candidateSourcePinsRefreshed':False,'firstOwnEvidenceManifestStatus':'FAIL_PRESERVED_INSIDE_DISTINCT_FINAL_MANIFEST' if directory==B else 'NO_FIRST_SEAL_FAILURE','firstOwnEvidenceManifest':'evidence-manifest.json' if directory==B else None}
    dump(directory/name,manifest)
    _,finalpin=read(directory/name)
    for row in proof:read(directory/row['path'],{'bytes':row['bytes'],'sha256':row['sha256'],'identityDecimal':row['PRE']})
    print(json.dumps({'review':directory.name,'verdict':verdict['verdict'],'average':verdict['average'],'evidenceManifest':name,'evidenceManifestSha256':finalpin['sha256'],'evidenceManifestBytes':finalpin['bytes'],'regularEvidenceFiles':len(proof),'evidenceBytes':manifest['bytes'],'allOwnManifestFilesReopenedToEOFAllNineMatch':True,'enablingAttestation':False}))
