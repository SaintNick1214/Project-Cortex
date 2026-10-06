"""Seal the source-only coordinator review without changing phase1 or enabling effects."""
import datetime
import hashlib
import json
from pathlib import Path

OUT=Path(__file__).resolve().parent
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
result=json.loads((OUT/'code-volume-controls.stdout').read_bytes())
bindings=json.loads((OUT/'current-input-bindings.json').read_bytes())
copy=json.loads((OUT/'code-volume-copy.stdout').read_bytes())
assert result['status']==bindings['status']==copy['status']=='PASS'
assert result['diagnosticControlCount']==23 and result['flowControlCount']==7
assert result['sourceCurrentIdentityDecimal']==copy['destinationIdentityDecimal']
verdict={'verdict':'PASS','independent':True,'scope':'TASK03_ATTEMPT3_PRIVATE_COORDINATOR_FIRST_USE_SOURCE_ONLY','sourceSha256':'03ab5f3689a3ca0c634991d4fcb32e84c3b3b8d89defe4e534804604cff977dc','sourceBytes':12333,'scores':{'RequirementFulfillment':5,'CodeQuality':4,'TestQuality':4,'PatternAdherence':5,'Completeness':4},'average':4.4,'report':'report.md','reportSha256':sha(OUT/'report.md'),'diagnosticAndRecipeControls':23,'mockedLifecycleControls':7,'currentPublicInputs':7,'originalPhase1ArtifactsUnchanged':113,'failedFirstHarnessPreserved':True,'failedR2HeldSourceIdentityPreserved':{'status':'FAIL','cause':'UNKNOWN','tupleValues':'UNAVAILABLE_NOT_RECONSTRUCTED'},'prospectiveDistinctOwnedCodeBaseline':'PASS','historicalSourceIdentityRestored':False,'actualPrivateReads':0,'actualServiceRequests':0,'actualProvisioning':0,'actualPrivateTransport':0,'actualRetirements':0,'actualCliDispatches':0,'actualNativeOrPaidCalls':0,'enablingAttestationWritten':False,'actualPrivateCustodyAccepted':False,'actualCoordinatorExecution':'HELD_AWAITING_EXPLICIT_PARENT_RELEASE','fullOriginalTask03FunctionalAcceptance':'OPEN','downstreamGoal':'OPEN','observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(OUT/'verdict.json').write_text(json.dumps(verdict,indent=2)+'\n')
rows=[]
for p in sorted(OUT.rglob('*')):
 if p.is_file() and p.name!='evidence-manifest.json':rows.append({'path':str(p.relative_to(OUT)),'sha256':sha(p),'bytes':p.stat().st_size})
manifest={'scope':'SEALED_COORDINATOR_FIRST_USE_SOURCE_ONLY_PUBLIC_DUMMY_REVIEW','files':rows,'currentExternalSourceBindings':bindings['files'],'prospectiveOwnedCodeVolume':'cortex-task03-attempt3-coordinator-code-review-d98bad88','failedR2Observation':'FAIL_UNKNOWN_CAUSE_TUPLES_UNAVAILABLE_NOT_RECONSTRUCTED','selfExcluded':True,'phase1Untouched':True,'actualPrivateReads':0,'actualServiceRequests':0,'actualCliDispatches':0,'enablingAttestationWritten':False,'observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(OUT/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for row in rows:assert sha(OUT/row['path'])==row['sha256'] and (OUT/row['path']).stat().st_size==row['bytes']
print(json.dumps({'status':'SEALED_SOURCE_ONLY_PASS','evidenceFiles':len(rows),'manifestSha256':sha(OUT/'evidence-manifest.json'),'verdictSha256':sha(OUT/'verdict.json'),'reportSha256':sha(OUT/'report.md'),'actualPrivateReads':0,'actualServiceRequests':0}))
