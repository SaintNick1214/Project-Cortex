"""Close this failed source review; preserve first capture and hold original inputs through final publications."""
import os,pathlib,json,hashlib,resource,stat,time
R=pathlib.Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';J=QA/'local-resume-2026-10-05/task03-attempt6-integrated-source-review1';P=QA/'local-resume-2026-10-05/task03-attempt6-integrated-preparation'
F=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def nine(st):return{k:str(getattr(st,'st_'+k))for k in F}
def write(name,body):
 raw=body.encode()if isinstance(body,str)else(json.dumps(body,indent=2,sort_keys=True)+'\n').encode();fd=os.open(J/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 try:
  data=memoryview(raw)
  while data:n=os.write(fd,data);assert n>0;data=data[n:]
  os.fsync(fd)
 finally:os.close(fd)
 return{'path':name,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
def read(fd):
 os.lseek(fd,0,0);parts=[]
 while b:=os.read(fd,262144):parts.append(b)
 return b''.join(parts)
capraw=(J/'first-prospective-current-input-manifest.json').read_bytes();cap=json.loads(capraw);originalraw=(P/'operative-source-manifest.json').read_bytes();original=json.loads(originalraw);old={x['path']:x for x in original['files']};extra={str((P/n).relative_to(R)):(h,b)for n,h,b in [('operative-source-manifest.json','d1012a242bcf52899d63199798ae9c97b821ca04acc00a29db164e889cfff7f1',3093855),('preparation-report.md','d853279930cd6f8eec10c551e42f321707ac824d0d31f100656520f4b7e0cd93',12690),('source-writers-stopped.json','1e922c062f6fad651243f59f8bab4a42409725ddc118454f4e629ccaa705ad68',7716),('source-closure-handoff.json','70a76cd038530f2fa80a56a0935cf35bac353eeabb2dc60acbfa2c9465cb81f4',530),('final-reporting-receipt.json','dec5f8483aa9bbe6b6f12b571dbba05129d044775398dc53c4289092a3345d64',13813)]}
soft,hard=resource.getrlimit(resource.RLIMIT_NOFILE)
if soft<4096:resource.setrlimit(resource.RLIMIT_NOFILE,(min(4096,hard),hard))
held=[]
try:
 for row in cap['files']:
  p=R/row['path'];fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);held.append((p,fd,row))
 def check(stage):
  out=[]
  for p,fd,row in held:
   raw=read(fd);now=nine(os.fstat(fd));post=nine(os.lstat(p));expected=old.get(row['path']);eh=expected['sha256']if expected else extra[row['path']][0];eb=expected['bytes']if expected else extra[row['path']][1];current=(row['PRE']==row['OPEN']==now==post and len(raw)==eb and hashlib.sha256(raw).hexdigest()==eh);orig=expected is None or now==expected['PRE']
   out.append({'path':row['path'],'currentReviewerFirstProspectiveNineFullEOFHashSize':'PASS'if current else'FAIL_UNKNOWN','originalOperativePRE':'PASS'if orig else'FAIL_UNKNOWN','sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'POST':now,'pathPOST':post})
  return{'scope':'UNCHANGED_REVIEWER_FIRST_CAPTURE_AND_ORIGINAL_D101_SOURCE_CUSTODY_ONLY','stage':stage,'status':'REJECTED_ORIGINAL_SOURCE_CUSTODY_FAILED','currentMembers':len(out),'currentReviewerCapturePassed':sum(x['currentReviewerFirstProspectiveNineFullEOFHashSize']=='PASS'for x in out),'originalPREFailures':[x['path']for x in out if x['originalOperativePRE']!='PASS'],'currentReviewerCaptureFailures':[x['path']for x in out if x['currentReviewerFirstProspectiveNineFullEOFHashSize']!='PASS'],'files':out,'allInputFDsHeld':True,'firstCaptureSha256':hashlib.sha256(capraw).hexdigest(),'sourceManifestSha256':hashlib.sha256(originalraw).hexdigest(),'failedPinsRefreshed':False,'historicalCustodyRepaired':False,'privateAccess':False,'runtimeEffects':0}
 before=check('BEFORE_FINAL_REPORT_PUBLICATION');write('pre-publication-current-fence.json',before)
 report='''# Judgment: Task03 attempt6 complete pre-provision source recipe

## Verdict: REJECT — 2.4/5, source eligibility only

The corrected source manifest `d1012a242bcf52899d63199798ae9c97b821ca04acc00a29db164e889cfff7f1` is not eligible for runtime release. Its original custody gate failed on one public input, and three logic boundaries admit unsafe outcomes. No candidate/product/source was edited. No private path was read or statted. No Docker, management/service/network, installation, official CLI, native qualification or Git mutation occurred.

## Evidence review

The reviewer independently loaded actual AGENTS/runtime/profile, pessimistic-judge/judge-task, original Task03, accepted c2 sequence and authoritative decision gates. Full Task03 functionality and the full goal remain OPEN. Q5 SOURCE1 REJECT2.4, SOURCE3 source-only PASS4.2 with expired runtime admission, actual bounded crypto and physical-retirement histories remain distinct. No historical or static result is promoted to current functional acceptance.

The first reviewer prospective manifest was captured for all 2231 current files before first complete source qualification: original 2226 public source members plus five final reporting/handoff files. Full-EOF/hash/size/PRE/OPEN/POST/pathPOST checking discovered exactly one original-PRE difference. Its first failed receipt and original d101 manifest remain unchanged. The original descriptor holder ended FAILED and closed descriptors; the later final reader reopens against the same first capture and holds all inputs through final report publication. It does not claim uninterrupted descriptor custody over the intervening manual review.

80 fresh finite AST/source/byte controls completed, including seven unsafe acceptance witnesses. One additional exact source-gate assertion control proves the changed original PRE is denied. One separate own finite fixture reproduces the remaining transitive cached-bytecode gap under Python -B. These 82 review controls are effects-blocked or own-fixture-only and are not runtime/product PASS. Full raw assertion code, outcomes, public read receipts and the finite cached-import fixture are preserved.

## Critical findings

1. **Original complete custody fails; the changed pin cannot be refreshed.** `coordinate-source/source-receipt-manifest.json` remains 5844 bytes with SHA `aaafff1877bf3af6b60b8938e732e1e0f24909139c49951f9a0bb7e7e3964042`, but its original ctime `1791311819617809297` differs from reviewer first capture `1791311872680308345`. Every other field and its byte content match; cause is UNKNOWN. All other 2230 initial entries passed. `integrated/source-gates.py:59` correctly rejects this original PRE before qualified effects. Raw: `initial-current-fence.json`, `first-prospective-current-input-manifest.json`, `source-original-pre-denial-control.json`. Preserve the old failure and use a distinctly named prospective source/consumer repair if preparing a later attempt; this verdict does not authorize replacing the failed tuple.
2. **The private receiver/selector recipe omits the executable and actual source boundary.** `integrated/private-coordinate.py:172–195` validates represented names/caps/volume mapping but does not validate Config.Cmd, Config.Entrypoint, actual Mounts.Source/Driver, Platform or Privileged. Exact original AST accepts changed unreviewed commands/entrypoints and a foreign actual volume Source/Driver, independently as six witnesses. The receiver's initial check at313 precedes provision at315 and protected framed start at325; the selector uses the same incomplete checker at243. Fresh source eligibility requires complete exact command/entrypoint, platform, security and actual mount mappings before those effects. The stricter official dispatcher recipe cannot qualify this separate path retroactively. Raw: `source-controls.json` private-unsafe-* rows.
3. **The final native review signal can be accepted after the original 2400-second deadline.** `integrated/private-coordinate.py:356–363` checks time only before reading the finish record. Exact loop AST enters at2399, performs a substituted read that completes at2401, and sets completed=True. Check the original deadline after read, validation and immediately before completion. Do not extend the deadline. The official dispatcher independently denies late native terminal polls; its correct outer phase does not fix this separate final-acceptance loop. Raw: `source-controls.json`, finish-unsafe-read-completed-after-2400.
4. **A reachable transitive loader still selects unreviewed .pyc.** `integrated/private-coordinate.py:263–264` compiles reviewed A bytes, but `attempt5/source-acquisition.py:17–19` uses spec.loader.exec_module(T). Python -B disables cache writes and permits cache reads. An own finite fixture first verifies unchanged original A/T bytes and cache absence, then creates a timestamp-valid dependency .pyc before actual first use; compiling the unchanged A source executes its unreviewed cached T code. Earlier cache-absence checks at105–106 do not bind this later import to reviewed T bytes. Bind the transitive first use to verified held dependency bytes, preserving original A/T programs and assertions if required. Raw: `cached-dependent-import-control.py`, `cached-dependent-import-control.json`, and its own finite fixture. No protected key or target was involved.

## Requirements review

| Bounded source requirement | Result | Evidence |
|---|---|---|
| Original candidate assertions and ancestry conserved | PASS public byte scope |1905 original members;1901 byte-exact hashes, exactly four declared deltas, exactly two named ancestry additions to1907 |
| Original deployment/native/cleanup programs conserved | PASS public byte scope |13 selected original programs byte-compared, including deploy/driver/qualify/cleanup/process-owner/native-engine, child toolchain, authority/lifecycle/policy/reactive and transport/acquisition |
| Exact registration/discovery counts | PASS source scope |275 product,200 public,75 internal,12 fixture helpers,287 published; original frozen assertions unchanged |
| Initial complete current/source-PRE closure | FAIL UNKNOWN |One ctime-only original-PRE difference; no failed pin refresh |
| Initial/dependent Python executable source binding | FAIL |Corrected integrated loaders compile held source bytes; transitive original T loader still reads cached code |
| Exact private receiver/selector recipe before effects | FAIL |Six unsafe metadata witnesses |
| Exact independent crypto OP/V/image/freeze/source/required-PASS binding | PASS source boundary |Fresh positive and22 semantic/required-PASS denials; no actual crypto reexecution |
| Conservative official admission and late native terminal denial | PASS tested source boundary |On-time phase control plus late Running/terminal/insufficient-log-window and future-reserve denials |
| Original final2400-second acceptance deadline | FAIL |Late finish read accepted |
| Known ownership and failure-sticky retirement | Source inspected; actual HELD |Official cleanup retains failures/known IDs; coordinator unconditional owned management retirement and selector remain unexecuted |
| Actual public/private/CLI/native/cleanup/physical outcomes | UNEXECUTED |No runtime source approval or effect was released |
| Full Task03/foundation/full-goal acceptance | OPEN |Unavailable capabilities and source controls do not count as original functional completion |

The source retains official CLI120s/Common190s, native1200s/driver1260s, private review2400s, RPC10000/12s, owned16 subjects/320 rows/two64-byte files/two cleanup attempts/five empty policy tables/zero paid calls. It proposes2050 seconds of official reserve without extending the original window. Source inspection preserves these constants; future actual admission and all outcomes still need separate independent qualification.

## Dimension scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement fulfillment |2/5|Current custody and three source acceptance boundaries fail |
| Code quality |2/5|Unbound executable/transitive source and late completion |
| Test quality |4/5|82 independent outcome controls; all effects and unavailable coverage explicit |
| Pattern adherence |2/5|Exact source/owned-recipe/original deadline rules not fully enforced |
| Completeness |2/5|Complete source recipe is reviewable but not eligible for provisioning |

**Average:2.4/5.** Fix the bounded defects, preserve all original failed receipts and source preimages, then obtain a fresh independent review of a distinct stopped-writer source closure. No enabling attestation was authored. All actual service, foundation, functional, downstream and final-audit gates remain OPEN.
'''
 rh=write('report.md',report)
 verdict={'scope':'TASK03_ATTEMPT6_INTEGRATED_SOURCE_ONLY','verdict':'REJECT','independent':True,'score':2.4,'sourceManifestSha256':'d1012a242bcf52899d63199798ae9c97b821ca04acc00a29db164e889cfff7f1','candidateSha256':'115e417419ab7b55e9fdbad97e51513f9f24a8e523c7b344168a63c92d8e968c','operation':'c9fbaa34-8ca8-4153-b8bd-1cfe60a8241f','volume':'cortex-task03-attempt6-fixture-20261006-c9fbaa34','originalSourceCustody':'FAIL_UNKNOWN_UNCHANGED_BYTES_ONE_CTIME','sourceEligibilityReleased':False,'enablingAttestationAuthored':False,'dimensionScores':{'requirementFulfillment':2,'codeQuality':2,'testQuality':4,'patternAdherence':2,'completeness':2},'reviewControls':82,'unsafeAcceptanceWitnesses':8,'findings':[{'id':'original-pre-custody','severity':'critical','file':'coordinate-source/source-receipt-manifest.json','cause':'UNKNOWN','failedPinRefreshed':False},{'id':'private-exact-recipe','severity':'critical','file':'integrated/private-coordinate.py','line':172,'witnesses':6},{'id':'late-final-review-read','severity':'critical','file':'integrated/private-coordinate.py','line':356,'witnesses':1},{'id':'transitive-cached-bytecode','severity':'critical','file':'attempt5/source-acquisition.py','line':17,'callerFile':'integrated/private-coordinate.py','callerLine':263,'witnesses':1}],'report':rh,'privateAccess':False,'DockerCalls':0,'serviceCalls':0,'officialCliExecuted':False,'nativeQualificationExecuted':False,'foundationAccepted':False,'fullTask03Accepted':False,'goalAccepted':False,'historicalCustodyRepaired':False}
 vh=write('verdict.json',verdict)
 rawfiles=['hold-current-public-inputs.py','first-prospective-current-input-manifest.json','initial-current-fence.json','source-controls.py','source-controls.json','review-public-read-receipts.json','source-original-pre-denial-control.json','cached-dependent-import-control.py','cached-dependent-import-control.json','pre-publication-current-fence.json','close-review.py']
 rawfiles+=['finite-cached-dependent-import-fixture/attempt5/source-acquisition.py','finite-cached-dependent-import-fixture/transport-prep/private-transport.py']
 cache=list((J/'finite-cached-dependent-import-fixture/transport-prep/__pycache__').iterdir());assert len(cache)==1;rawfiles.append(str(cache[0].relative_to(J)))
 rawrows=[]
 for name in rawfiles:
  p=J/name;fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
  try:
   pin=nine(os.fstat(fd));raw=read(fd);assert pin==nine(os.fstat(fd))==nine(os.lstat(p));rawrows.append({'path':name,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'currentWithinReadNine':pin,'fullEOF':True})
  finally:os.close(fd)
 mh=write('raw-receipt-manifest.json',{'scope':'FINITE_OWN_REVIEW_RAW_OUTPUTS_ONLY_LOGICALLY_SELF_EXCLUDED_FROM_HISTORICAL_PINS','files':rawrows,'members':len(rawrows),'privateFiles':0,'runtimeEffects':0})
 final=check('FINAL_THROUGH_REPORT_VERDICT_RAW_MANIFEST_PUBLICATION');final['report']=rh;final['verdict']=vh;final['rawManifest']=mh;final['originalFailureIsAcceptanceBlocking']=True;fh=write('final-current-source-closure.json',final)
 writer=write('writers-stopped.json',{'scope':'INDEPENDENT_SOURCE_REVIEW_STOPPED_WRITERS_ONLY','stoppedAtUtc':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'sourceWritersNeverOwned':True,'writersStopped':True,'remainingWrites':[],'report':rh,'verdict':vh,'rawManifest':mh,'finalCurrentClosure':fh,'runtimeEffects':0,'privateAccess':False,'enablingAttestationAuthored':False})
 refs=[rh,vh,mh,fh,writer];readback=[]
 for e in refs:
  p=J/e['path'];fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
  try:
   pin=nine(os.fstat(fd));raw=read(fd);assert pin==nine(os.fstat(fd))==nine(os.lstat(p))and len(raw)==e['bytes']and hashlib.sha256(raw).hexdigest()==e['sha256'];readback.append(e)
  finally:os.close(fd)
 print(json.dumps({'verdict':'REJECT','score':2.4,'originalPREFailures':final['originalPREFailures'],'currentReviewerCaptureFailures':final['currentReviewerCaptureFailures'],'inputsFDHeldThroughFinal':True,'currentMembers':2231,'closed':readback,'remainingWrites':[],'runtimeEffects':0}),flush=True)
finally:
 for p,fd,row in held:os.close(fd)
