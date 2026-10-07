"""Publish independent REJECT from held SOURCE inputs, then close every held FD."""
import ast,hashlib,json,os,time
from pathlib import Path
J=Path(__file__).resolve().parent;P=J.parent
A=P/'task04-current-producer-native-public-repair3';B=P/'task04-current-producer-native-public-consumer-repair3'
MF=B/'final-current-combined-closure.json'
ROOT=P/'root-task04-r3-c5-mature-readback2.json'
def digest(raw):return hashlib.sha256(raw).hexdigest()
def wire(value):return (json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
def publish(name,raw):
    p=J/name;fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        view=memoryview(raw)
        while view:
            n=os.write(fd,view);assert n>0;view=view[n:]
        os.fsync(fd)
    finally:os.close(fd)
    return {'path':str(p),'sha256':digest(raw),'bytes':len(raw),'byteReferenceOrigin':'AUTHOR_BYTES_OUTPUT_SELF_EXCLUDED_NOT_MATURE_PHYSICAL_INPUT'}
def main():
    rawNames=['independent-controls3.json','independent-controls5.json','independent-bootstrap-controls2.json','independent-export-controls1.json']
    controls=[];refs=[]
    for name in rawNames:
        path=str(J/name);raw=held_source(path);value=json.loads(raw);refs.append({'path':path,'sha256':digest(raw),'bytes':len(raw),'rows':len(value['rows']),'pass':value['pass'],'fail':value['fail']});controls.extend(value['rows'])
    unique={}
    for row in controls:
        if row['name']in unique:assert unique[row['name']]['status']==row['status']
        unique[row['name']]=row
    failures=[row for row in unique.values()if row['status']=='FAIL']
    assert len(failures)==12 and len(unique)==145
    assert all(r['name'].startswith(('C5.open_inputs.opened.','R3.ci_entry.close.','R3.ci_entry.cleanup-report.','R3.native_export.manifest.close'))for r in failures)
    mfraw=held_source(str(MF));mf=json.loads(mfraw);base=mf['files'];assert len(base)==1535
    rootraw=held_source(str(ROOT));root=json.loads(rootraw);assert len(root['files'])==197
    ordered=[];seen=set()
    for row in base+root['files']:
        if row['path']not in seen:ordered.append(row['path']);seen.add(row['path'])
    baseAndRootCount=len(ordered)
    extras=sorted(set(cohort_pins)-seen);ordered+=extras
    assert len(ordered)==len(set(ordered))==len(cohort_pins)
    index={p:i for i,p in enumerate(ordered)}
    original={p:{'bytes':v['bytes'],'sha256':v['sha256'],'PRE9':dict(v['PRE9']),'capturedUnixNs':v['capturedUnixNs']}for p,v in cohort_pins.items()}
    ages=[]
    for path in ordered:
        pin=cohort_pins[path];cohort_qualify(pin,original[path]);assert pin['PRE9']==original[path]['PRE9']
        ages.append(int(pin['capturedUnixNs'])-max(int(pin['PRE9']['mtime_ns']),int(pin['PRE9']['ctime_ns'])))
    assert min(ages)>=60000000000
    # Explicitly preserve upstream and Root original tuples through this verdict.
    for row in base:
        pin=cohort_pins[row['path']];assert(pin['bytes'],pin['sha256'])==(row['bytes'],row['sha256'])
        for key in ('PRE9','PRE','originalNine','identityDecimal'):
            if key in row and type(row[key])is dict and set(row[key])==set(pin['PRE9']):assert row[key]==pin['PRE9']
    for row in root['files']:
        pin=cohort_pins[row['path']];assert pin['PRE9']==row['PRE9']and(pin['bytes'],pin['sha256'])==(row['bytes'],row['sha256'])
    sources={}
    for rel in ('source/ci-run.py','source/public_export_contract.py','source/native_export.py'):
        path=str(A/rel);raw=held_source(path);sources[path]={'sha256':digest(raw),'bytes':len(raw)}
    for rel in ('programs/consumer.py','infrastructure/final-close3.py'):
        path=str(B/rel);raw=held_source(path);sources[path]={'sha256':digest(raw),'bytes':len(raw)}
    ciLines=held_source(str(A/'source/ci-run.py')).decode().splitlines()
    neLines=held_source(str(A/'source/native_export.py')).decode().splitlines()
    cLines=held_source(str(B/'programs/consumer.py')).decode().splitlines()
    def line(lines,needle):return next(i for i,s in enumerate(lines,1)if needle in s)
    findings=[
      {'id':'F1','priority':1,'file':str(A/'source/ci-run.py'),'line':line(ciLines,'for h in SOURCE_HELD:'),'title':'Final source close failure abandons later owned descriptors','proof':['R3.ci_entry.close.1','R3.ci_entry.close.2'],'fix':'Detach ownership and attempt each close once; collect sticky failures after all closes.'},
      {'id':'F2','priority':1,'file':str(A/'source/ci-run.py'),'line':line(ciLines,"save('cleanup-failure.json'"),'title':'Cleanup report write failure skips every held source close','proof':['R3.ci_entry.cleanup-report.1.primary'],'fix':'Put all source custody under an outer final cleanup independent of report publication; retain primary/report/close failures.'},
      {'id':'F3','priority':1,'file':str(A/'source/native_export.py'),'line':line(neLines,'for h in held:h.close()'),'title':'Native export close failure abandons later held descriptors','proof':['R3.native_export.manifest.close.1','R3.native_export.manifest.close.2','R3.native_export.manifest.close-and-primary.1'],'fix':'Attempt every detached owned close once and retain all primary and close failures.'},
      {'id':'F4','priority':1,'file':str(B/'programs/consumer.py'),'line':line(cLines,"if 'LEDGER'in globals():LEDGER.opened()"),'title':'Ledger update can fail before new descriptor ownership is recorded','proof':['C5.open_inputs.opened.1','C5.open_inputs.opened.2','C5.open_inputs.opened.3'],'fix':'Ensure newly opened FD has a cleanup owner before ledger accounting or any other fallible setup.'}]
    # F1 points at the actual final loop, not an earlier acquisition fence loop.
    findings[0]['line']=max(i for i,s in enumerate(ciLines,1)if 'for h in SOURCE_HELD:'in s)
    requirementRows=[
      {'kind':'requirement','text':'Register all named billable operation keys','status':'OPEN','reason':'No backend registry implementation or accepted functional run in this source proposal.'},
      {'kind':'requirement','text':'Resolve trusted deployment/tenant/agent/operation policy and pin/validate model/interface/prompt/options/tokens/tools','status':'OPEN','reason':'No accepted policy resolution and enforcement evidence.'},
      {'kind':'requirement','text':'Atomic budget/concurrency reservation, once-only known settlement, conservative uncertainty and safe fallbacks','status':'OPEN','reason':'No accepted runtime reservation/settlement or fallback evidence.'},
      {'kind':'acceptance','text':'Distinct allowed model policies, correlated audit receipts and no direct provider bypass','status':'OPEN','reason':'SOURCE fixtures do not implement or accept original model policy.'},
      {'kind':'acceptance','text':'Concurrent and child calls cannot bypass or double settle; exhaustion before token mint','status':'OPEN','reason':'No accepted application concurrency/admission evidence.'},
      {'kind':'acceptance','text':'Fallback does not repeat visible output/tools/ambiguous paid jobs or change embedding profile','status':'OPEN','reason':'No accepted application fallback evidence.'}]
    score={'Requirement Fulfillment':2,'Code Quality':2,'Test Quality':3,'Pattern Adherence':4,'Completeness':2}
    receipt={'scope':'TASK04_R3_C5_INDEPENDENT_SOURCE_ONLY','verdict':'REJECT','average':2.6,'dimensions':score,'findings':findings,
      'uniqueControls':{'count':len(unique),'pass':len(unique)-len(failures),'fail':len(failures),'rawRows':len(controls)},
      'controlReceipts':refs,'failures':failures,'originalRequirements':requirementRows,'sourcePins':sources,
      'heldSourceLedger':source_ledger(),'allRoot197OriginalNineConserved':True,'all1535UpstreamPinsConserved':True,
      'allFDsHeldBeforeReferencedMemberContents':True,'allSourceFDsHeldThroughVerdict':True,'minimumInitialAgeNs':min(ages),
      'native20Whole120SerialAndBounds':'UNCHANGED_SOURCE_ASSERTIONS_ONLY_NO_EXECUTION',
      'stable113And336':'EXACT_ORIGINAL_NINE_CONSERVED','old119':'FAILED_CTIME_HISTORY_UNCHANGED',
      'original100Preimages':'COMPLETE_EXACT_BYTES_BY_REFERENCE_PRESERVED_NOT_HISTORICAL_CUSTODY_REPAIR',
      'oldC7BackingAndTransport':'INCOMPLETE_NOT_RECOVERED','originalTask04FunctionalCompleted':0,'originalTask04FunctionalTotal':3,
      'goalQualifiedTasks':1,'goalTotalTasks':17,'productCompleted':0,'productTotal':12,
      'sourceEligibility':False,'runtimeAuthority':False,'workflow':'INACTIVE_PROPOSED_ONLY','Docker':False,'private':False,'native':False,
      'Task03':'OPEN','fullTask04':'OPEN','full17Goal':'OPEN','authorControls':'164_SCOPED_AUTHOR_ONLY_NOT_ACCEPTANCE',
      'ownSetupFailures':'bootstrap1 locator,holder1 incomplete union,controls1 locator,controls2 syntax,controls3/5 premature maturity and unheld exec,old control2/old bootstrap1 oracle failures all immutable'}
    verdictPin=publish('verdict1.json',wire(receipt))
    lines=['# Independent Task04 R3/C5 source judgment','', 'REJECT — 2.6/5. Source eligibility is denied. Original Task04 functional acceptance remains 0/3.', '',
      'The review holds the complete 1535-member upstream closure and exact Root197 union, plus every required bootstrap, instruction, independent control and raw input under one nonresetting 4096-FD/64MiB/16MiB ledger. Every input passed actual 60-second max(mtime,ctime) maturity before its first qualifying capture, full EOF/hash/all-nine identity checks, and remains held through this verdict. No Docker, native, private, target or service operation ran.', '',
      str(len(unique)-len(failures))+' unique SOURCE/MOCK controls PASS and '+str(len(failures))+' FAIL across '+str(len(unique))+' unique conditions ('+str(len(controls))+' raw rows; repeated conditions counted once). Original100 exact byte preservation,110 unchanged source members, stable113/336 original identities and all119 ctime failures are conserved. The current controls deny1e309/nonfinite JSON and primaryFailure boolean aliases; actual export/terminal functions verify48 unique PASS outcomes, typed process0, None failure, result EOF/fences, before/after terminal consistency and sticky failed exports.', '',
      '## Blocking findings','']
    for f in findings:
        lines+=['- **'+f['id']+' [P1] '+f['title']+'** — ['+Path(f['file']).name+']('+f['file']+':'+str(f['line'])+'). Actual isolated source proof: '+', '.join(f['proof'])+'. '+f['fix']]
    lines+=['','The FD tests open only owned finite fixture files and explicitly rescue only descriptors the candidate failed to attempt. Failed-close descriptors are never retried, and no foreign FD or process is touched. These tests establish reachable SOURCE behavior, not a native execution result.','',
      '## Original requirement mapping','','| Original item | Status | Evidence limit |','|---|---|---|']
    for r in requirementRows:lines+=['| '+r['text']+' | OPEN | '+r['reason']+' |']
    lines+=['','Missing C7 backing/transport, the original122, native20/whole120 acceptance and actual ROOT outcomes remain incomplete. The prior full REJECT2.8 and static-only recorder4.25 judgments remain scoped and unchanged. The proposed workflow stays inactive. Numerical cycle limits were waived; original assertions and deadlines were retained.','',
      '## Exact dimension scores','','| Dimension | Score | Basis |','|---|---:|---|',
      '| Requirement Fulfillment | 2/5 | Required source resource safety fails; all original functional requirements remain open. |',
      '| Code Quality | 2/5 | Four reachable ownership/cleanup defects require repair. |',
      '| Test Quality | 3/5 | Author controls verify many outcomes but miss the blocking reachable paths; independent fault tests expose them. |',
      '| Pattern Adherence | 4/5 | Finite references, scoped evidence, literal identities and original assertion conservation are maintained. |',
      '| Completeness | 2/5 | Source eligibility and supporting cleanup are incomplete; no functional/native acceptance. |','',
      '**Average: 2.6/5.** Repair all four failures in a distinct author namespace, preserve these failed tuples and raw controls, and obtain a new independent closed-source review.','',
      '## Preserved reviewer setup failures','',
      'The wrong first recorder locator and holder1 incomplete union closed every acquired FD and issued no verdict. Own controls1 used an incorrect copied-preimage locator; controls2 had a syntax token separator error. Early control3/control5 captures were denied before opening or reading their immature source; unheld executions were denied. Later first captures occurred only after actual max-metadata maturity. Old oracle rows requiring constructor-close ordering, an unreachable fifth lstat, and a close marker in exception text instead of the structured closeFailures field are retained separately; corrected controls use the contract’s actual all-close-once and sticky-error requirements. No candidate assertion was relaxed.','',
      'The final source manifest references the immutable upstream MF and Root197 indices, preserves original literal tuples and full hash/EOF checks, and declares every additional path explicitly. Large initial publisher snapshots and the duplicate intermediate author raw receipt are self-excluded supplemental outputs; they are not source authority. Final report/verdict/manifest/FD closure/stop publishers require a later mature physical consumer.','']
    reportPin=publish('report1.md','\n'.join(lines).encode())
    for path in ordered:cohort_qualify(cohort_pins[path],original[path]);assert cohort_pins[path]['PRE9']==original[path]['PRE9']
    canonical=[{'path':p,'bytes':original[p]['bytes'],'sha256':original[p]['sha256'],'PRE9':original[p]['PRE9'],'fullEOF':True}for p in ordered]
    graphSha=digest(wire(canonical))
    memberEvidence=[[index[p],cohort_pins[p]['fd'],cohort_pins[p]['capturedUnixNs'],True]for p in ordered]
    extraRows=[{k:v for k,v in cohort_pins[p].items()if k not in('closeAttempted',)}for p in extras]
    manifest={'schema':'TASK04_INDEPENDENT_FINITE_SOURCE_REFERENCE_MANIFEST_V1','scope':'INDEPENDENT_SOURCE_REJECT_ONLY',
      'upstream':{'path':str(MF),'sha256':digest(mfraw),'bytes':len(mfraw),'count':1535,'rowIndexScheme':'files order'},
      'rootOriginal197':{'path':str(ROOT),'sha256':digest(rootraw),'bytes':len(rootraw),'count':197,'rowIndexScheme':'files order, already-covered paths skipped'},
      'inputOrder':'UPSTREAM_ROWS_THEN_NEW_ROOT197_ROWS_THEN_SORTED_ADDITIONAL_ROWS','baseAndRootUniqueCount':baseAndRootCount,
      'additionalExactRows':extraRows,'count':len(ordered),'bytes':source_ledger()['bytes'],'aggregateCanonicalPathHashBytesNineEOFSha256':graphSha,
      'initialCaptureAndHeldFinalEvidenceByInputIndex':memberEvidence,'minimumFirstCaptureAgeNs':min(ages),
      'allFinalOriginalNineAndHashesExact':True,'allFullEOFBeforeVerdictAndAfterPublication':True,'allSourceFDsHeldThroughVerdict':True,
      'sourceLedger':source_ledger(),'reportAndVerdictAuthoredByteReferences':[reportPin,verdictPin],
      'noPinRefresh':True,'writersStoppedRequired':True,'publisherOutputsSelfExcluded':True,'runtimeAuthority':False,'sourceEligibility':False}
    manifestPin=publish('review-source-reference-manifest1.json',wire(manifest))
    # One final complete EOF/hash/nine pass immediately before explicit detached closes.
    for path in ordered:cohort_qualify(cohort_pins[path],original[path]);assert cohort_pins[path]['PRE9']==original[path]['PRE9']
    closes=[];errors=[]
    for path in ordered:
        pin=cohort_pins[path];assert not pin['closeAttempted'];pin['closeAttempted']=True
        try:
            returned=os.close(pin['fd']);closes.append([index[path],pin['fd'],returned])
        except BaseException as e:
            errors.append({'inputIndex':index[path],'fd':pin['fd'],'class':type(e).__name__,'failure':repr(e),'retryForbidden':True})
    closure={'scope':'ACTUAL_INDEPENDENT_SOURCE_CLOSE_CALLS_AFTER_VERDICT','manifestAuthoredBytes':manifestPin,
      'inputOrder':manifest['inputOrder'],'inputIndexCount':len(ordered),'closeCallsByInputIndex':closes,'closeErrors':errors,
      'attempts':len(closes)+len(errors),'allAttemptedExactlyOnce':all(p['closeAttempted']for p in cohort_pins.values()),
      'allHeldFinalBeforeClose':True,'unknownRetry':False,'actualEffects':False,'sourceEligibility':False}
    closePin=publish('review-source-FDclosure1.json',wire(closure))
    referencePin=publish('review-principal-byte-references1.json',wire({'scope':'UNADOPTED_AUTHOR_BYTES_PUBLISHER_REFERENCES','principals':[reportPin,verdictPin,manifestPin,closePin],'physicalMatureReadbackRequired':True}))
    stopPin=publish('review-publisher-writer-stop1.json',wire({'scope':'STOPPED_REVIEW_PRIMARY_PUBLISHERS_ONLY','stoppedUnixNs':time.time_ns(),
      'writers':'STOPPED','remainingWrites':['source-FDclosure.json','final-packet-writer-stop.json'],'publisherPrincipals':[reportPin,verdictPin,manifestPin,closePin,referencePin],
      'remainingHolderSummaryAndFinalStopNotYetClosed':True,'allReviewSourceFDsExplicitlyClosed':True,'outputsSelfExcludedUntilMatureConsumer':True}))
    assert not errors,'independent source close failure; preserve REJECT plus closure UNKNOWN'
    return {'verdict':'REJECT','average':2.6,'uniqueControls':receipt['uniqueControls'],'sourceLedger':source_ledger(),
      'principals':[reportPin,verdictPin,manifestPin,closePin,referencePin,stopPin],'fourFindings':findings,'sourceFDsExplicitlyClosed':len(ordered)}

