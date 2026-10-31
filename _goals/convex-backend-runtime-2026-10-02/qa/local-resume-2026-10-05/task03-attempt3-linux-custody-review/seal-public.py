"""Seal phase1 reviewer evidence; never write an enabling attestation."""
import datetime
import hashlib
import json
from pathlib import Path

OUT=Path(__file__).resolve().parent
REPO=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q=REPO/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt3-2026-10-05'
P=Q.parent/'local-resume-2026-10-05'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
public=json.loads((OUT/'r3-public-custody.stdout').read_bytes())
source=json.loads((OUT/'r3-source-preflight.stdout').read_bytes())
upstream=json.loads((OUT/'r2-upstream-verification.stdout').read_bytes())
assert public['status']==source['status']==upstream['status']=='PASS'
assert public['historicalSourceTupleObservation']['status']=='FAIL'
assert len(public['historicalSourceTupleObservation']['drifts'])==972
assert all(r['changedFields']==['st_dev','st_ino'] and r['cause']=='UNKNOWN' for r in public['historicalSourceTupleObservation']['drifts'])
assert upstream['historicalReviewTupleObservation']['status']=='PASS'
setup={'scope':'REVIEWER_SETUP_ONLY','failures':[{'raw':'public-custody-inspect.stderr','status':'FAIL','reason':'Absent Docker Tmpfs property before actual fixture access','correction':'Null-safe map lookup','sourcePreimage':'run-public-first-preimage.py'},{'raw':'upstream-verification.stderr','status':'FAIL','reason':'Conservative credential-shaped filename refusal for sealed public dummy fixture','correction':'Exact twelve-file public dummy allowlist only; actual credentials still prohibited','sourcePreimage':'upstream-verification-first-preimage.py'}],'directoryContinuityRefinement':{'previousRaw':'r2-public-custody.stdout','finalRaw':'r3-public-custody.stdout','sourcePreimage':'public-custody-r2-preimage.py'},'candidateOrPrivateOrVolumeWrites':0,'actualCredentialReads':0}
(OUT/'reviewer-setup-observations.json').write_text(json.dumps(setup,indent=2)+'\n')
upcommands=[]
for prefix,exitcode,script in [('',1,'upstream-verification-first-preimage.py'),('r2-',0,'upstream-verification.py')]:
 upcommands.append({'argv':['python3','-B',str(OUT/'upstream-verification.py')],'shellStdoutPath':str(OUT/(prefix+'upstream-verification.stdout')),'shellStderrPath':str(OUT/(prefix+'upstream-verification.stderr')),'observedExitCode':exitcode,'exactExecutedSource':script,'executedSourceSha256':sha(OUT/script),'stdoutSha256':sha(OUT/(prefix+'upstream-verification.stdout')),'stderrSha256':sha(OUT/(prefix+'upstream-verification.stderr')),'timeSource':'Original tools.exec_command observed execution; no reconstructed timestamps','publicDummyCredentialShapedFiles':12 if exitcode==0 else 0,'actualCredentialReads':0})
(OUT/'upstream-command-receipts.json').write_text(json.dumps({'scope':'PUBLIC_READONLY_REHASH_ONLY','commands':upcommands},indent=2)+'\n')
scores={'RequirementFulfillment':5,'CodeQuality':4,'TestQuality':4,'PatternAdherence':5,'Completeness':4}
verdict={'verdict':'PASS','independent':True,'scope':'ATTEMPT3_ACTUAL_PUBLIC_LINUX_CUSTODY_AND_CURRENT_SOURCE_BINDINGS_ONLY','publicBindingVerdict':'PASS','preprovisionReadinessVerdict':'PASS','candidateSha256':'2fb8d11a7e6c0bcaf92b2fe8d7ff228a6e554f9241c07c22079e6be8bcc870ef','receiptManifestSha256':'75ec4e5fbb3afbb9c9a779f4a6a01b28ec2a67b67cdd6b7f641ce9ff9bd913c8','publicTransferReceiptSha256':public['transferReceiptSha256'],'publicFiles':972,'publicBytes':25212514,'allCurrentDestinationIdentities':'PASS_ALL9','currentSourceDestinationFullContent':'PASS','currentSourceHeldPathContinuity':'PASS_DURING_REVIEW','continuousHistoricalSourceIdentity':'NOT_ESTABLISHED','historicalSourceTupleComparison':{'status':'FAIL','rows':972,'fields':['st_dev','st_ino'],'cause':'UNKNOWN'},'historicalGitCustodyRestored':False,'scores':scores,'average':4.4,'publicBindingReport':'public-binding-report.md','publicBindingReportSha256':sha(OUT/'public-binding-report.md'),'preprovisionReadinessReport':'preprovision-readiness-report.md','preprovisionReadinessReportSha256':sha(OUT/'preprovision-readiness-report.md'),'phase2PrivateReview':'HELD_AWAITING_EXPLICIT_PARENT_RELEASE','provisioningAuthorizedByThisVerdict':False,'enablingAttestationWritten':False,'actualCredentialReads':0,'actualServiceRequests':0,'actualDeployments':0,'actualCompilerExecutions':0,'actualNativeImports':0,'actualCliDispatches':0,'paidCalls':0,'officialCodegen':'NOT_RUN','nativeFoundationAcceptance':False,'fullOriginalTask03FunctionalAcceptance':'OPEN','downstreamGoal':'OPEN','observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(OUT/'public-gate-verdict.json').write_text(json.dumps(verdict,indent=2)+'\n')
external=[]
for path in [Q/'candidate-freeze-attempt3.json',Q/'receipt-manifest-attempt3.json',Q/'independent-preparation-review.json',Q/'scripts/guard.mjs',Q/'project-request.json',P/'task03-attempt3-management-review.json',P/'task03-attempt3-target-management.mjs',P/'task03-attempt3-linux-public-transfer.py',P/'task03-attempt3-public-coordinate.py',P/'task03-attempt3-public-command-receipts.json',P/'task03-attempt3-preparation-review/evidence-manifest.json',P/'task03-attempt3-management-review/evidence-manifest.json']:
 data=path.read_bytes();external.append({'path':str(path),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
rows=[]
for path in sorted(OUT.rglob('*')):
 if path.is_file() and path.name!='evidence-manifest.json':rows.append({'path':str(path.relative_to(OUT)),'sha256':sha(path),'bytes':path.stat().st_size})
manifest={'scope':'SEALED_PHASE1_PUBLIC_CUSTODY_AND_PREPROVISION_READINESS_ONLY','files':rows,'currentPublicInputBindings':external,'selfExcluded':True,'actualRawCustodyReceipt':'r3-public-custody.stdout','actualSourceBindingReceipt':'r3-linux-bindings.stdout','actualSourcePreflightReceipt':'r3-source-preflight.stdout','upstreamCurrentReviewBindingReceipt':'r2-upstream-verification.stdout','historicalSourceFailureRetained':True,'currentAll9SourceDestinationScope':'Prospective current source held/path continuity and full bytes; destination all9 equals actual transfer; no continuous historical source identity claim','writesOwnedByReviewer':str(OUT),'candidatePrivateOriginalVolumeWrites':0,'actualCredentialReads':0,'actualServiceRequests':0,'enablingAttestationWritten':False,'phase2PrivateReview':'HELD_AWAITING_EXPLICIT_PARENT_RELEASE','observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(OUT/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for row in rows:
 path=OUT/row['path'];assert sha(path)==row['sha256'] and path.stat().st_size==row['bytes']
print(json.dumps({'status':'SEALED_PHASE1_PASS','evidenceFiles':len(rows),'manifestSha256':sha(OUT/'evidence-manifest.json'),'verdictSha256':sha(OUT/'public-gate-verdict.json'),'publicBindingReportSha256':sha(OUT/'public-binding-report.md'),'preprovisionReadinessReportSha256':sha(OUT/'preprovision-readiness-report.md'),'phase2':'HELD_AWAITING_EXPLICIT_PARENT_RELEASE'}))
