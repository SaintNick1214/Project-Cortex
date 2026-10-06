"""Seal bounded failure observations; retain FAIL and all original unknowns."""
import datetime
import hashlib
import json
from pathlib import Path

OUT=Path(__file__).resolve().parent
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
record=json.loads((OUT/'record-audit.json').read_bytes())
probe=json.loads((OUT/'actual-metadata-probe.stdout').read_bytes())
assert record['linuxReceiver']=='FAIL_PRIVATE_TRANSPORT_FENCE' and record['operationRetiredNeverRetry'] is True
assert probe['destinationPrivateEntryCount']==0 and probe['destinationPrivateAll9EqualsPhase1EmptyBaseline'] is True and probe['publicCandidateMetadataDeltas']==[]
assert all(probe['selectedChildMetadataFences'].values())
staged=[r for r in record['hostMetadataOnly'] if '/actual-private-export-' in r['path'] and r['kind']=='credential_metadata_only_no_open']
assert len(staged)==3 and all(r['changedFields']==['st_ctime_ns'] for r in staged)
prior=[]
for folder,count,expected in [(OUT.parent,113,'86ceeddf1551ad4fe57ee916429ff2e3b0f93a95913c1854280c6d03fe1e1988'),(OUT.parent/'phase2-coordinator-preflight',382,'fa83a6b273861ae6ee5bf148f176db61a95f68fb9a8e5365a709c542f7daa30b')]:
 p=folder/'evidence-manifest.json';assert sha(p)==expected;j=json.loads(p.read_bytes());assert len(j['files'])==count
 for row in j['files']:assert sha(folder/row['path'])==row['sha256'] and (folder/row['path']).stat().st_size==row['bytes']
 prior.append({'manifest':str(p),'sha256':expected,'filesUnchanged':count})
verdict={'verdict':'FAIL','actualExecutionVerdict':'FAIL','actualPrivateCustodyAcceptance':'REJECT','auditCompletionVerdict':'PASS','independent':True,'scope':'RETIRED_ATTEMPT3_ACTUAL_FAILURE_AND_METADATA_CUSTODY_REVIEW_ONLY','operation':'d98bad88-5157-4816-b458-4160e7945361','projectId':3156409,'deploymentName':'gallant-mastiff-565','retired':True,'deletionHttpStatus':200,'verificationHttpStatus':404,'retiredAt':'2026-10-06T07:23:57.250Z','provisionManagementCalls':6,'retirementManagementCalls':5,'hostStageFiles':3,'originalReceiverExitCode':1,'originalReceiverFailureClass':'private_transport_fence','originalReceiverStdoutBytes':149,'originalReceiverStderrBytes':0,'originalReceiverPreciseFailingPredicate':'UNKNOWN','originalReceiverFailingTuple':'UNAVAILABLE_NOT_RECONSTRUCTED','originalReceiverPrivateByteReads':'UNKNOWN_NOT_INSTRUMENTED','sourceCause':'UNKNOWN','currentSelectedChildMetadataFences':'PASS_DOES_NOT_DISMISS_ORIGINAL_FAIL','stageSelectedHistoricalTupleComparison':{'status':'FAIL','files':3,'fields':['st_ctime_ns'],'cause':'UNKNOWN'},'currentPrivateDestinationEntries':0,'currentPrivateDirectoryAll9EqualsPhase1EmptyBaseline':True,'publicCandidateMetadataFilesUnchanged':972,'actualPrivateBytesOrLogicalBindingAccepted':False,'reviewerPrivateCredentialByteReads':0,'reviewerCopyOrReplay':0,'reviewerServiceRequests':0,'reviewerCliDispatches':0,'reviewerSourceOrVolumeWrites':0,'actualCliNativeOrPaidCalls':0,'enablingAttestationWritten':False,'retryRetiredOperationOrReleaseCli':False,'scoresScope':'BOUNDED_FAILURE_AUDIT_ONLY','scores':{'RequirementFulfillment':5,'CodeQuality':4,'TestQuality':4,'PatternAdherence':5,'Completeness':4},'auditAverage':4.4,'report':'report.md','reportSha256':sha(OUT/'report.md'),'priorSealedReviewsUnchanged':prior,'fullOriginalTask03FunctionalAcceptance':'OPEN','downstreamGoal':'OPEN','observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(OUT/'verdict.json').write_text(json.dumps(verdict,indent=2)+'\n')
rows=[]
for path in sorted(OUT.rglob('*')):
 if path.is_file() and path.name!='evidence-manifest.json':rows.append({'path':str(path.relative_to(OUT)),'sha256':sha(path),'bytes':path.stat().st_size})
manifest={'scope':'SEALED_ACTUAL_RECEIVER_FAILURE_METADATA_AUDIT_ONLY','files':rows,'authorizedMetadataInputBindings':record['inputPins'],'priorSealedReviewsUnchanged':prior,'originalFailureRetained':True,'originalTupleNotReconstructed':True,'sourceCause':'UNKNOWN','selfExcluded':True,'reviewerPrivateCredentialByteReads':0,'reviewerServiceRequests':0,'reviewerCliDispatches':0,'sourcePrivateOrVolumeWrites':0,'enablingAttestationWritten':False,'operationRetiredNeverRetry':True,'observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(OUT/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for row in rows:assert sha(OUT/row['path'])==row['sha256'] and (OUT/row['path']).stat().st_size==row['bytes']
print(json.dumps({'status':'SEALED_ACTUAL_FAIL_AUDIT_COMPLETE','evidenceFiles':len(rows),'manifestSha256':sha(OUT/'evidence-manifest.json'),'verdictSha256':sha(OUT/'verdict.json'),'reportSha256':sha(OUT/'report.md'),'actualExecution':'FAIL','retiredOperationNeverRetry':True,'reviewerPrivateCredentialByteReads':0}))
