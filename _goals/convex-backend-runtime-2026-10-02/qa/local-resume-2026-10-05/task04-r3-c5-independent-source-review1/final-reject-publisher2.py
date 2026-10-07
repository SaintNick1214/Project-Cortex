"""Final independent REJECT publication; original holder2 remains FAILED/UNKNOWN."""
import hashlib,json,os,time,ast
from pathlib import Path
J=Path(__file__).resolve().parent;P=J.parent
A=P/'task04-current-producer-native-public-repair3';B=P/'task04-current-producer-native-public-consumer-repair3'
def wire(v):return (json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode()
def sha(raw):return hashlib.sha256(raw).hexdigest()
def main(raws,pins,ledger):
    dpath=str(J/'holder2-final-UNKNOWN-closure1.json');draw=raws[dpath];assert sha(draw)=='724f4e5336d468fa76f8dd00c1fd72c1d49b5426010cc35f993d8bda35f23232'and len(draw)==265821
    diagnostic=json.loads(draw);assert diagnostic['status']=='FAILED_UNKNOWN'and diagnostic['attempts']==1593 and not diagnostic['closeErrors']
    gaps=diagnostic['originalExpectationMismatches'];assert len(gaps)==6
    assert all(r['changedFields']==['ctime_ns']and r['fullEOF']is True and(r['bytes'],r['sha256'])==(r['expectedBytes'],r['expectedSha256'])for r in gaps)
    assert all(r['path'].startswith(str(J)+'/')for r in gaps)
    rootraw=raws[str(P/'root-task04-r3-c5-mature-readback2.json')];assert sha(rootraw)=='f4015c8892013f97dd68321495686dde66ebd75012d8c333c93fa0d63a2b8d10'and len(rootraw)==138703
    root=json.loads(rootraw);by={r['path']:r for r in root['files']};assert len(by)==197
    subjects=[str(A/'source/ci-run.py'),str(A/'source/native_export.py'),str(A/'source/public_export_contract.py'),str(B/'programs/consumer.py')]
    for path in subjects:
        r=by[path];assert pins[path]['PRE9']==r['PRE9']and(len(raws[path]),sha(raws[path]))==(r['bytes'],r['sha256'])
    ci=raws[subjects[0]].decode().splitlines();ne=raws[subjects[1]].decode().splitlines();c=raws[subjects[3]].decode().splitlines()
    find=lambda lines,needle:next(i for i,s in enumerate(lines,1)if needle in s)
    findings=[
      {'id':'F1','priority':1,'file':subjects[0],'line':max(i for i,s in enumerate(ci,1)if 'for h in SOURCE_HELD:'in s),'title':'Final source close failure abandons later owned FDs','proof':'R3.ci_entry.close.1/.2 (with and without primary)','recommendation':'Detach ownership, attempt every close once, and collect sticky failures after all attempts.'},
      {'id':'F2','priority':1,'file':subjects[0],'line':find(ci,"save('cleanup-failure.json'"),'title':'Cleanup report write failure skips every held source close','proof':'R3.ci_entry.cleanup-report.1.primary','recommendation':'Protect all source closes with an outer lifetime independent of report publication and retain primary/report/close errors.'},
      {'id':'F3','priority':1,'file':subjects[1],'line':find(ne,'for h in held:h.close()'),'title':'Native export close failure abandons later owned FDs','proof':'R3.native_export.manifest.close.1/.2 and close-and-primary.1/.2','recommendation':'Attempt every owned detached close once; collect primary and close failures without retry.'},
      {'id':'F4','priority':1,'file':subjects[3],'line':find(c,"if 'LEDGER'in globals():LEDGER.opened()"),'title':'Ledger update may fail before new FD ownership is recorded','proof':'C5.open_inputs.opened.1/.2/.3 (MemoryError)','recommendation':'Give every newly opened FD a cleanup owner before ledger accounting or any fallible setup.'}]
    reqs=[
      ('requirement','Register operation keys for every named billable operation','No accepted backend operation registry implementation.'),
      ('requirement','Trusted deployment/tenant/agent/operation policy; pin and validate model/interface/prompt/options/tokens/tools','No accepted application policy enforcement evidence.'),
      ('requirement','Atomic budget/concurrency reservation, once settlement, conservative uncertainty and safe fallback','No accepted application admission/settlement evidence.'),
      ('acceptance','Distinct allowed model policies, correlated audit and no hidden direct provider bypass','No accepted application policy/audit evidence.'),
      ('acceptance','Concurrent/child calls cannot bypass reservation or settle twice; quota exhaustion before token mint','No accepted application concurrency/quota evidence.'),
      ('acceptance','Fallback never duplicates visible output/tools/ambiguous paid jobs or changes embedding profile','No accepted application fallback evidence.')]
    refs=[
      {'path':str(J/'independent-controls3.json'),'sha256':'75ad0488fbf6d1c5177c80e5bde103d9062e5e2f52ea6cb44ce51d760b74d904','bytes':40936,'observedPass':91,'observedFail':8,'custody':'ORIGINAL_FINAL_CTIME_FAILED_UNQUALIFIED_HISTORY'},
      {'path':str(J/'independent-controls5.json'),'sha256':'8dffe32e690fbd6dd29cb3e8ee078c39e21f053b987244779c573e38d2637364','bytes':13594,'observedPass':18,'observedFail':4,'custody':'ORIGINAL_FINAL_EXACT_SCOPED_SOURCE_OBSERVATION'},
      {'path':str(J/'independent-bootstrap-controls2.json'),'sha256':'ea7716c056fff680d43bb2f76584ad08891b6292efef02277d706e48d78bfa69','bytes':8713,'observedPass':11,'observedFail':0,'custody':'ORIGINAL_FINAL_EXACT_SCOPED_SOURCE_OBSERVATION'},
      {'path':str(J/'independent-export-controls1.json'),'sha256':'e5c7280925d71c95499652c3eff8e907814cab8ea3b11e99c4568edf7f946155','bytes':12191,'observedPass':20,'observedFail':0,'custody':'RAW_FINAL_EXACT_BUT_CONTROL6_SOURCE_FINAL_CTIME_FAILED_UNQUALIFIED_WHOLE_INTERVAL'}]
    verdict={'scope':'TASK04_R3_C5_INDEPENDENT_REJECT_WITH_PRESERVED_OWN_CUSTODY_UNKNOWN','verdict':'REJECT','average':2.6,
      'dimensions':{'Requirement Fulfillment':2,'Code Quality':2,'Test Quality':3,'Pattern Adherence':4,'Completeness':2},
      'fourConfirmedStaticCandidateFaults':findings,'observedUniqueSourceMockConditions':{'count':145,'pass':133,'fail':12,'rawRows':152,'completeQualifiedAcceptanceCount':0},
      'rawControlReferences':refs,'originalRequirements':[{'kind':k,'text':text,'status':'OPEN','reason':why}for k,text,why in reqs],
      'oldHolder2SourceCustody':'FAILED_UNKNOWN_NOT_REPAIRED','oldHolder2SourceLedger':diagnostic['sourceLedger'],
      'old1593ActualCloseAttempts':1593,'oldCloseErrors':[],'oldSixOwnCtimeGaps':gaps,'all1535UpstreamAndRoot197OldOriginalNineHashEOFFinal':'EXACT_BEFORE_OLD_EXPLICIT_CLOSE',
      'confirmedStaticSourcesNewSubsetOriginalRoot197Pins':'EXACT_NEW_HELD_SUBSET_ONLY',
      'thisPublicationInputs':'FINITE_MATURE_REFERENCE_SUBSET_ONLY_NOT_NEW_WHOLE_SOURCE_ACCEPTANCE',
      'cumulativeSourceLedger':ledger,'subjectSources':[{**pins[p],'sha256':sha(raws[p]),'bytes':len(raws[p])}for p in subjects],
      'sourceEligibility':False,'runtimeAuthority':False,'oldC7BackingTransport':'INCOMPLETE_NOT_RECOVERED','workflow':'INACTIVE_PROPOSED_ONLY',
      'stable113And336':'ORIGINAL_LITERAL_MAPS_CONSERVED','old119':'FAILED_CTIME_HISTORY_UNCHANGED','original100':'EXACT_BYTE_PRESERVATION_OBSERVED_NOT_HISTORICAL_CUSTODY_REPAIR',
      'author164Controls':'SCOPED_AUTHOR_EVIDENCE_ONLY','native20Whole120Original122ROOT':'HELD_UNEXECUTED_NOT_ACCEPTED',
      'Task04Functional':{'complete':0,'total':3},'goalQualified':{'complete':1,'total':17,'scope':'TASK01_BOUNDED_ONLY'},'product':{'complete':0,'total':12},
      'Docker':False,'private':False,'native':False,'target':False,'serviceRequests':0,'paidInference':0}
    lines=['# Independent Task04 R3/C5 source judgment','', '**REJECT — 2.6/5.** Four confirmed candidate cleanup defects block source eligibility. Original Task04 functional acceptance remains0/3.','',
      'This packet separates immutable candidate-source findings and observed SOURCE/MOCK controls from the reviewer’s failed custody interval. The first verdict publisher stopped before any report/verdict write. The original holder then retained all1593 expected tuples, read complete bytes, and attempted every1593 owned close exactly once with zero close errors and zero retries. Six reviewer-owned inputs changed only ctime; their bytes/hashes stayed exact. That whole interval remains FAILED/UNKNOWN and is not retrospectively qualified. All1535 upstream and Root197 original candidate/reference tuples, hashes and EOF checks were exact at its final diagnostic before closure.','',
      'Observed controls:133PASS/12FAIL across145 unique conditions (152 raw rows; seven repeated conditions counted once). These are scoped source/history observations, not145 qualified acceptance conditions. The four raw receipts below preserve their exact scope; controls3 and the control6 source have failed original final custody. Bootstrap11 and export/terminal20 positive observations do not grant eligibility.','',
      '## Confirmed blocking findings','']
    for f in findings:
      lines.append('- **'+f['id']+' [P1] '+f['title']+'** — ['+Path(f['file']).name+']('+f['file']+':'+str(f['line'])+'). Static path is reachable in the current unchanged source; isolated observed proof: '+f['proof']+'. '+f['recommendation'])
    lines+=['','The isolated tests use finite owned fixture descriptors and rescue only never-attempted owned FDs. Unknown failed closes are never retried. No foreign process or FD, Docker, private file, credentials, service, target, CLI runtime or inference is used.','',
      '## Original requirements and acceptance criteria','',
      '| Original item | Status | Limit |','|---|---|---|']
    for _,text,why in reqs:lines.append('| '+text+' | OPEN | '+why+' |')
    lines+=['','Original100 byte preimages and110 unchanged executable members were observed preserved by reference; stable113/336 maps and all119 historical ctime failures stay unchanged. Missing C7 backing/transport, original122, native20/whole120 and actualROOT remain incomplete. The old full REJECT2.8 and static-only recorder4.25 do not become functional acceptance. Proposed workflow remains inactive. Only numerical review-cycle limits were waived.','',
      '## Exact scores','',
      '| Dimension | Score | Evidence |','|---|---:|---|',
      '| Requirement Fulfillment | 2/5 | Required ownership/cleanup safety fails; all original functional criteria remain open. |',
      '| Code Quality | 2/5 | Four reachable candidate defects need repair. |',
      '| Test Quality | 3/5 | Many meaningful author/independent observations; blocking paths were missed and own whole custody failed. |',
      '| Pattern Adherence | 4/5 | Finite references, honest scopes, literal identities and original assertion conservation are preserved. |',
      '| Completeness | 2/5 | Source eligibility, complete cleanup and original functional/native acceptance are absent. |',
      '', '**Average:2.6/5.** Repair in a distinct author namespace and obtain a fresh independent review. This REJECT authorizes no runtime or product acceptance.','',
      '## Evidence and failed intervals','']
    for ref in refs:lines.append('- ['+Path(ref['path']).name+']('+ref['path']+') — SHA'+ref['sha256']+', '+str(ref['bytes'])+' bytes; '+ref['custody']+'.')
    lines+=['- [Original holder2 failed closure]('+dpath+') — SHA724f4e5336d468fa76f8dd00c1fd72c1d49b5426010cc35f993d8bda35f23232,265821 bytes. Contains all six literal expected/current nine pairs, unchanged full-byte hashes, complete per-index final checks and all1593 explicit close calls.',
      '', 'Preserved own setup failures include the first wrong recorder locator, holder1 incomplete union, controls1 preimage locator, controls2 syntax, controls3/5 premature maturity and unheld execution, initial oracle close-order/unreachable-lstat mistakes, and the bootstrap oracle’s missed structured closeFailures field. Corrected oracle observations are distinct files; old failed bytes and tuples remain immutable. These setup errors are not candidate defects.',
      '', 'Read-only metadata investigation found flags64 and only the com.apple.provenance attribute name on sampled files; no attribute values were read. Exact-path lsof showed only the reviewer’s read-only held FD; no writer/copy process was observed. Cause remainsUNKNOWN.',
      '', 'The final publication reads a small stopped mature reference subset with allFD-before-content, fullEOF/hash/nine checks and held subject-source pins matching literal Root197 originals. Its ledger adds every genuinely new input to the old66083601-byte ledger without resetting or exempting metadata. It does not reopen or qualify the failed whole original interval. Publisher report/verdict/manifest/stop files remain self-excluded until Root’s later mature physical readback.','']
    def pub(name,raw):
      p=J/name;fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
      try:
        view=memoryview(raw)
        while view:n=os.write(fd,view);assert n>0;view=view[n:]
        os.fsync(fd)
      finally:os.close(fd)
      return {'path':str(p),'sha256':sha(raw),'bytes':len(raw),'origin':'AUTHORED_OUTPUT_BYTES_SELF_EXCLUDED_PENDING_ROOT_MATURE_PHYSICAL_READ'}
    vpin=pub('verdict2.json',wire(verdict));rpin=pub('report2.md','\n'.join(lines).encode())
    manifest={'schema':'FINITE_TASK04_REJECT_REFERENCE_MANIFEST_V2','scope':'REJECT_ONLY_OLD_WHOLE_CUSTODY_FAILED_UNKNOWN',
      'original1593Graph':{'upstreamMF':{'path':str(B/'final-current-combined-closure.json'),'sha256':'4433be69064ecb94694fa7243040e2c466ad739396b16b128ef6ba9c56419e9d','bytes':2502349,'rows':1535},
       'Root197':{'path':str(P/'root-task04-r3-c5-mature-readback2.json'),'sha256':'f4015c8892013f97dd68321495686dde66ebd75012d8c333c93fa0d63a2b8d10','bytes':138703,'rows':197},
       'diagnostic':{'path':dpath,'sha256':sha(draw),'bytes':len(draw),'oldOriginalGraphSha256':diagnostic['completeOriginalGraphSha256'],'oldCount':1593,'oldBytes':66083601},
       'ownAdditionalRows':'diagnostic.additionalOriginalRows EXACT_EXPECTED_ORIGINAL_NINE_NOT_REFRESHED',
       'extraContextPaths':[str(P.parents[3]/rel)for rel in ('AGENTS.md','package.json','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/pessimistic-judge.md','.agents/skills/judge-task/SKILL.md')],
       'allFinalByOriginalIndex':'diagnostic.allFinalChecksByInputIndex; six FAILED_ORIGINAL_EXPECTATION_NOT_REPAIRED; allothers EXACT; sourceEligibility false'},
      'newPublicationSubset':list(pins.values()),'cumulativeSourceLedger':ledger,'observedRawControls':refs,'reportAndVerdictAuthorBytePins':[rpin,vpin],
      'allOriginalSixTask04':'OPEN','wholeSourceQualification':'FAILED_UNKNOWN','newSubsetQualification':'MATURE_CURRENT_REFERENCE_ONLY',
      'historicalPinsRefreshed':False,'runtimeAuthority':False,'sourceEligibility':False,'publisherOutputsSelfExcludedUntilLaterRootMaturity':True}
    mpin=pub('review-reference-manifest2.json',wire(manifest))
    return {'principals':[rpin,vpin,mpin],'verdict':'REJECT','average':2.6,'candidateFindings':findings,'observedConditions':verdict['observedUniqueSourceMockConditions'],
      'originalWholeCustody':'FAILED_UNKNOWN_NOT_REPAIRED','cumulativeSourceLedger':ledger}

