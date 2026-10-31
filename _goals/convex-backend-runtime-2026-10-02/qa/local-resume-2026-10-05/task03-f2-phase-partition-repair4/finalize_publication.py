"""Finite ordinary publisher/census; no physical self-qualification or effects.

Existing candidate/collector/G/U3/B3/Root files are read-only. All writes are
new files in this packet. This publisher and its late outputs require later
mature independent Root capture and are additional same-SOURCE costs.
"""
from pathlib import Path
import ast
import hashlib
import importlib.util
import json
import os
import sys
import time

sys.dont_write_bytecode=True
OWN=Path(__file__).absolute().parent;ROOT=OWN.parents[4]
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
NEW=('ordinary-finalization-input-ledger10.json','prospective-partition-recipe4.json',
     'final-known-census-results2.json','report1.md','finite-publication-pins1.json','final-writer-stop1.json')

def encode(value):return (json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
def nine(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def write(name,raw):
    fd=os.open(OWN/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
    with os.fdopen(fd,'wb')as out:out.write(raw);out.flush();os.fsync(out.fileno())

def main():
    # Discovery is this finite author packet only. No candidate/history/archive
    # member scan. Final inventory is committed as a literal list in the ledger.
    paths=sorted([p for p in OWN.iterdir() if p.is_file() and p.name not in NEW])
    assert paths and all(p.name not in NEW for p in paths)
    held=[];records=[];events=[];contents={};failure=None
    try:
        for path in paths:
            pin=nine(os.lstat(path));fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);held.append((path,pin,fd))
            assert pin==nine(os.fstat(fd))==nine(os.lstat(path))
        events.append({'event':'ALL_FINITE_OWN_INPUT_FDS_BEFORE_FIRST_OWN_PUBLICATION_BODY','count':len(held)})
        for path,pin,fd in held:
            raw=b''
            while True:
                chunk=os.read(fd,65536)
                if not chunk:break
                raw+=chunk
            assert len(raw)==int(pin['size']) and pin==nine(os.fstat(fd))==nine(os.lstat(path))
            records.append({'path':str(path.relative_to(ROOT)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                            'nine':pin,'fullEOF':True,'ordinaryOnly':True,'phase':'SOURCE','readCompleted_ns':time.time_ns()})
            contents[path.name]=raw
        for path,pin,fd in held:assert pin==nine(os.fstat(fd))==nine(os.lstat(path))
    finally:
        for path,_,fd in held:
            try:os.close(fd);error=None
            except BaseException as e:error=type(e).__name__
            events.append({'event':'ONCE_CLOSE','path':str(path.relative_to(ROOT)),'attempt':1,'error':error})
        write(NEW[0],encode({'scope':'ORDINARY_FINITE_PACKET_PUBLISHER_READS_NOT_SOURCE_QUALIFICATION',
             'finiteInputBasenames':[p.name for p in paths],'records':records,'events':events,
             'allUsedBodiesSourceChargeable':True,'noRefund':True,'sourceEligibility':False,'effects':0}))
    spec=importlib.util.spec_from_file_location('final_partition2',OWN/'phase_partition2.py')
    M=importlib.util.module_from_spec(spec);sys.modules[spec.name]=M;spec.loader.exec_module(M)
    recipe=json.loads(contents['prospective-partition-recipe3.json'])
    members={M.admission_id(row):row for row in recipe['members']};debt=set(recipe['actualReadDebts'])
    def add(value,reason,body=True):
        rawpin=value.get('nine',value.get('PRE9',value.get('literal9_before')))
        if rawpin is None:return
        if set(rawpin)=={'st_'+k for k in FIELDS}:rawpin={k:rawpin['st_'+k]for k in FIELDS}
        role='program' if Path(value['path']).suffix in ('.py','.mjs','.js') else 'document'
        row={'path':value['path'],'bytes':value.get('bytes',value.get('size')),'sha256':value['sha256'],
             'nine':{k:str(rawpin[k])for k in FIELDS},'roles':[role],
             'nineBasis':'CURRENT_ORDINARY_READ_NOT_HISTORICAL_REFRESH','originalNineMissing':False,
             'origins':[reason]}
        path=Path(row['path'])
        if path.is_absolute():row['path']=str(path.relative_to(ROOT))
        key=M.admission_id(row)
        if key in members:
            members[key]['roles']=sorted(set(members[key]['roles'])|{role})
            members[key]['origins']=sorted(set(members[key].get('origins',[]))|{reason})
        else:members[key]=row
        if body:debt.add(key)
        recipe['conservation']['sourceReadEvidence'].append({'admission':key,'path':row['path'],
                      'evidenceKind':reason,'debtRequired':body,'currentReliedOnBodyRead':body,'refundAllowed':False})
    for name in ('current32-ordinary-body-read-ledger7.json','lifetime-header-body-read-ledger8.json',
                 'accepted-scope-authority-acquisition9.json'):
        for value in json.loads(contents[name])['records']:add(value,'ACTUAL_FINITE_REPAIR4_'+name)
    post=json.loads(contents['poststop-held-control-results6.json'])
    assert post['failure']is None and post['closeErrors']==0 and post['controlResult']['passed']==97
    for value in post['rows']:add(value,'ACTUAL_REPAIR4_MATURE_HELD_CODE_THROUGH97_MOCK_CONTROLS')
    add(post['STOPHeader'],'ACTUAL_REPAIR4_HELD_CONTROLS_STOP_HEADER')
    for value in records:add(value,'ACTUAL_REPAIR4_FINITE_PUBLISHER_INPUT_BODY')
    recipe['members']=list(members.values());recipe['actualReadDebts']=sorted(debt)
    # Historical refs stay classified, not asserted as automatic current reads.
    for e in recipe['conservation']['sourceReadEvidence']:
        if e['evidenceKind']=='HISTORICAL_QUALIFICATION_REFERENCE_UNRESOLVED_CURRENT_LIFETIME_USE':
            e['evidenceKind']='HISTORICAL_QUALIFICATION_REFERENCE_NOT_AUTOMATIC_CURRENT_BODY_DEBT'
            e['currentReliedOnBodyRead']=False
    authority=json.loads(contents['accepted-scope-authority-acquisition9.json'])['records'][:3]
    recipe['conservation']['scopeAuthority']={'currentF2Only':True,'newProspectiveGraphConditionalNonuseAllowed':True,
         'historicalCaptureIsNotAutomaticCurrentBodyReadOrRefund':True,'oneSharedCurrentSourceLedgerNoReset':True,
         'acceptedAuthorityBodies':[{'path':r['path'],'bytes':r['bytes'],'sha256':r['sha256']}for r in authority],
         'oldF1SourcePlusUniqueControls70736907Over64':True,
         'originalActual1914NoInvented64Aggregate':True}
    recipe['conservation']['oldF1QualificationLineage']['presentLifetimeUseOfOldCapturedRows']='HISTORICAL_CAPTURE_NOT_AUTOMATIC_CURRENT_SOURCE_BODY_USE_OR_REFUND;EXACT_CURRENT_EDGE_CLOSURE_REQUIRED'
    recipe['unknownRequiredInputs']=[x for x in recipe['unknownRequiredInputs']if x.get('role')!='oldF1_actual_SOURCE_body_use_lifetime_trace']
    recipe['unknownRequiredInputs'].append({'role':'exact_current_body_use_import_control_adapter_closure',
         'state':'PENDING_INTERNAL_SOURCE_IMPLEMENTATION_AND_FRESH_INDEPENDENT_CONSERVATION_REVIEW_NOT_EXTERNAL_CAPABILITY_ABSENCE'})
    recipe['conservation']['latestImplementation']='phase_partition2.py'
    recipe['conservation']['staticCurrent32Probe']='32 exact programs /574 body-use call sites; generic/dynamic argument closures still require reviewed adapters'
    recipe['writers']='ACTIVE_PROSPECTIVE_AUTHOR_RECIPE_NOT_QUALIFIED'
    recipe['stopSha256']=None
    recipe['actualPLANBytes']=None
    M.validate_contract(recipe)
    recipe_raw=encode(recipe);write(NEW[1],recipe_raw)
    recipe_row={'path':str((OWN/NEW[1]).relative_to(ROOT)),'bytes':len(recipe_raw),
        'sha256':hashlib.sha256(recipe_raw).hexdigest(),'nine':nine(os.lstat(OWN/NEW[1]))}
    # Publisher outputs are known costs but not immediate physical authority.
    add(recipe_row,'NEW_REQUIRED_RECIPE_PUBLISHER_ADDITIONAL_SOURCE_COST',body=False)
    acq_raw=(OWN/NEW[0]).read_bytes()
    add({'path':str((OWN/NEW[0]).relative_to(ROOT)),'bytes':len(acq_raw),'sha256':hashlib.sha256(acq_raw).hexdigest(),
         'nine':nine(os.lstat(OWN/NEW[0]))},'NEW_REQUIRED_FINALIZATION_READ_LEDGER_SOURCE_COST',body=True)
    recipe['members']=list(members.values());recipe['actualReadDebts']=sorted(debt)
    census=M.assemble(recipe);census.pop('sourceRows');census.pop('custodyOnlyRows')
    census.update({'scope':'FINAL_KNOWN_CONSERVATIVE_PROSPECTIVE_SOURCE_UNION_NOT_CLOSED_SOURCE_CENSUS',
       'verdict':'BLOCKED_CURRENT_GENERIC_LOOPS_KNOWN_OVER64_AND_PENDING_INTERNAL_CLOSED_PARTITION_L_REVIEW',
       'publishedRecipeBytes':len(recipe_raw),'publishedRecipeSha256':hashlib.sha256(recipe_raw).hexdigest(),
       'actualReadDebtVersionAdmissions':len(debt),'lateRootReviewLAndPublishersUnknown':True,
       'oldCaptureAutomaticallyCurrentDebt':False,'actualCurrentReadDebtsRefunded':False,
       'currentCandidate1907OrCompiler114OmissionAdopted':False,'currentGenericLoopsStillRequireEveryMFBody':True,
       'genuinelyAbsentArchivalInputsProved':[],'remainingWorkIsInternalNotExternalCapabilityBlock':True,
       'applicationChecksRun':False,'independentReviewRequiredBeforeAdoption':True})
    input_pins=[{'path':str((OWN/name).relative_to(ROOT)),'bytes':len(raw),
                'sha256':hashlib.sha256(raw).hexdigest(),'physicalNine':'REQUIRES_LATER_MATURE_ROOT_CAPTURE'}
               for name,raw in sorted(contents.items())]
    input_pins += [{'path':str((OWN/NEW[0]).relative_to(ROOT)),'bytes':len(acq_raw),
                  'sha256':hashlib.sha256(acq_raw).hexdigest(),'physicalNine':'REQUIRES_LATER_MATURE_ROOT_CAPTURE'},
                  {'path':recipe_row['path'],'bytes':recipe_row['bytes'],'sha256':recipe_row['sha256'],
                   'physicalNine':'REQUIRES_LATER_MATURE_ROOT_CAPTURE'}]
    # Finite sizes stabilize without any self-hash or self-nine assertion.
    stopped_ns=str(time.time_ns());last=None
    for _ in range(12):
        report=render_report(census,post)
        craw=encode(census);report_raw=report.encode()
        pins={'scope':'FINITE_REPAIR4_SOURCE_ONLY_PUBLISHER_PINS_NOT_PHYSICAL_SOURCE_QUALIFICATION',
              'members':input_pins+[{'path':str((OWN/NEW[2]).relative_to(ROOT)),'bytes':len(craw),
                'sha256':hashlib.sha256(craw).hexdigest(),'physicalNine':'REQUIRES_LATER_MATURE_ROOT_CAPTURE'},
                {'path':str((OWN/NEW[3]).relative_to(ROOT)),'bytes':len(report_raw),
                'sha256':hashlib.sha256(report_raw).hexdigest(),'physicalNine':'REQUIRES_LATER_MATURE_ROOT_CAPTURE'}],
              'selfExcludedPublishers':[NEW[4],NEW[5]],'laterRootMaturityMinimumSeconds':240,
              'sourceEligibility':False,'originalPinsRefreshed':False,'effects':0}
        praw=encode(pins)
        stop={'scope':'REPAIR4_PACKET_FINAL_WRITER_STOP_ONLY_NOT_COMPLETE_SOURCE_GRAPH_OR_ADOPTION',
              'sourceWriters':'STOPPED','stoppedUnixNs':stopped_ns,'remainingWrites':[],
              'finitePinsPath':str((OWN/NEW[4]).relative_to(ROOT)),'finitePinsBytes':len(praw),
              'finitePinsSha256':hashlib.sha256(praw).hexdigest(),'finiteMembers':len(pins['members']),
              'finiteMemberBytes':sum(p['bytes']for p in pins['members']),
              'selfExcludedPublishers':[NEW[4],NEW[5]],'laterRootCurrentAgeMinimumSeconds':240,
              'allPacketFilesClosedAndNoFurtherOwnWrites':True,
              'codeCohortControlOutcome':'97 SOURCE/MOCK PASS /4 actually mature held code files /4once closes /0close errors; own runner excluded',
              'currentGenericCollectorGU3B3RootNotEdited':True,'completeSourceCensus':False,
              'sourceEligibility':False,'functionalTask03':'0/3','functionalTask04':'0/3','boundedGoal':'1/17 task01 only','productPercent':0,'effects':0}
        sraw=encode(stop)
        late=len(craw)+len(report_raw)+len(praw)+len(sraw)
        total=census['originalReservedTotalBytes']+late
        census['lateFinalPublisherBytesAdditional']=late
        census['knownFinalTotalWithOriginalReservesAndAllOwnPublishers']=total
        census['knownFinalOver64MiB']=max(0,total-67108864)
        state=(late,total,len(craw),len(report_raw),len(praw),len(sraw))
        if state==last:break
        last=state
    else:raise RuntimeError('finite_publisher_size_fixpoint_not_stable')
    # Regenerate exact final bound after stable lengths, without changing them.
    craw=encode(census);report_raw=render_report(census,post).encode()
    pins['members'][-2]['bytes']=len(craw);pins['members'][-2]['sha256']=hashlib.sha256(craw).hexdigest()
    pins['members'][-1]['bytes']=len(report_raw);pins['members'][-1]['sha256']=hashlib.sha256(report_raw).hexdigest()
    praw=encode(pins);stop['finitePinsBytes']=len(praw);stop['finitePinsSha256']=hashlib.sha256(praw).hexdigest();sraw=encode(stop)
    assert len(craw)+len(report_raw)+len(praw)+len(sraw)==census['lateFinalPublisherBytesAdditional']
    write(NEW[2],craw);write(NEW[3],report_raw);write(NEW[4],praw);write(NEW[5],sraw)
    print(json.dumps({'finiteMembers':len(pins['members']),'finiteMemberBytes':stop['finiteMemberBytes'],
         'knownFinalSourceBytesWithOriginalReserves':census['knownFinalTotalWithOriginalReservesAndAllOwnPublishers'],
         'knownFinalOver64MiB':census['knownFinalOver64MiB'],
         'pinsBytes':len(praw),'pinsSha256':hashlib.sha256(praw).hexdigest(),
         'STOPBytes':len(sraw),'STOPSha256':hashlib.sha256(sraw).hexdigest(),'sourceEligibility':False,'effects':0}))


def render_report(census,post):
    return f'''# Task Completion Report

## Status: PARTIAL — prospective repair4 packet closed; Source eligibility remains blocked

A concrete successor recipe, schema, finite diagnostic assembler, held body-use broker, and phase-order contract are published. Existing candidate/map/collector/G/U3/B3/Root code is untouched. The current generic loops still read every MF member. No candidate/compiler omission, fitting closed partition, Source approval, actual1914 handoff, private/key/target action, or functional acceptance is adopted.

## Changes Made

- `phase_partition2.py` is the final contract. It validates the exact original cohorts/counts/assertions/caps, charges every actual current enabling read in one ledger, permits only all-nine+size+hash+same-path dedup, denies hidden reads before open, and holds finite FDs through fullEOF/hash/size/literal9/final/once-close. Its nonuse function requires external fresh independent review bound to exact programs/adapters/body-use/conservation; JSON verdicts and mock results grant no authority.
- `prospective-partition-recipe4.json` enumerates exact known declarations, actual read debts, current32/required129/Q6seed5/original13, frozen1907/rootcompiler114/rootCLI5, and all oneDATA inputs. Six old nine-size mismatches remain quarantined/charged96,335B; no historical pin is refreshed. Exact conditional candidate IDs are proposals only. Original1914/3828/compiler114/source161/copy138/frozen1907 assertions remain in the separate actual readiness phase, before all protected actions.
- `adapter-edge-map1.json` names each required collector/G/U3/B3/RootDriver schema/IO/import/guard edge. It explicitly requires shared ownership, current program approval before actual1914, all seven B3 enabling inputs, source-enabling raw/control/schema/header/MF/approval/DATA admission, and unchanged original guards/assertions/deadlines. Those adapters are pending internal implementation; this packet does not edit them.
- `source_edge_probe.py` read32 exact declared current programs with all32 FDs before program bodies, fullEOF/hash/nines/final,32 once-closes/0 errors. It records574 body-use call sites and unresolved dynamic import/control/IO edges without importing or executing a candidate.
- `oldF1-current-lifetime-edge-trace1.json` and `accepted-scope-authority-acquisition9.json` distinguish old actual capture from current use. Old F1 declared2,352 fullEOF Source bodies/66,622,509B and a bounded independent SOURCE_ONLY PASS. The accepted Source conflict is70,736,907>67,108,864 including unique controls. Accepted authority is CURRENT_F2_ONLY/new prospective graph: old capture alone is neither automatic current body debt nor an exemption/refund. Its used header, every current actual body debt and all actual enabling reads stay charged. Exact closed present body-use proof is still required.
- Earlier implementation versions,89/96-control receipts, both finite-preparation denials, six unresolved declarations, STOP1 and the premature real-maturity denial are preserved. Final97 controls additionally reject current material body-use hidden under historical labels and do not equate historical capture with a current Source read.

## Verification

Final97 source/mock cases discovered/executed/passed,0 failed/skipped. The actual postSTOP run retained four code FDs before their first member body, through controls and owned fixture cleanup, then full requalification and four once-closes/0 errors. Minimum current code age was{min(r['currentAgeSeconds'] for r in post['rows']):.3f}s; STOP age was{post['STOPAgeSeconds']:.3f}s. The runner's bootstrap read, publishers and whole graph are explicitly excluded from self-qualification and require later mature Root capture/review. Earlier fixture-clock tests are mock, not240s physical proof. Python sources were AST-parsed; no app quality/module/UI/service checks ran because no product behavior changed.

## Exact known diagnostic and remaining work

The final conservative known catalog contains{census['sourceVersionAdmissions']:,} version admissions/{census['sourcePaths']:,} paths/{census['sourceMemberBytes']:,} member bytes. Original MF4MiB,approval1MiB,oneDATA2MiB reserves are retained. Including all known own late publishers, the known total is{census.get('knownFinalTotalWithOriginalReservesAndAllOwnPublishers',census['originalReservedTotalBytes']):,}B, {census.get('knownFinalOver64MiB',census['over64MiB']):,}B over64MiB. This is the conservative current-loop declaration/read union, not an intrinsic original-contract impossibility or a claimed future saving. Both actual recipe bodies remain charged; no compact PLAN/MF saving is treated as actual.

A fitting faithful partition is unproved. Pending internal work is the exact reviewed collector/G/U3/B3/RootDriver body-use implementation, closed import/control graph and current read-debt proof, final exact L STOP/pins/carry/wire/parser/caller/ledger/helper/control publications, and all late Root/approval/review publishers in one complete census. No genuinely absent critical archival input or unavailable external capability is proved. J5 exclusive348/8,269,992B is not omitted; all11 overlaps/613,696B and every actual manifest/STOP debt remain. L latest relayed188inputs/4,919,241B and351 mock controls are provisional and are not an admitted net census.

## Requirements Checklist

- [x] Concrete prospective source/schema/body-use/assembler/phase contract and exact downstream adapter edges.
- [x] Meaningful hidden-use/read-debt/reuse/mixed-role/nine/hash/size/missing-input/phase-order/assertion-loss/refund/4096/64MiB/16MiB/oneDATA controls, with stopped actual mature held-code final run.
- [x] Original Mac130/113, current32/129, seed5, all13 original physical comparands, root119=114compiler+5CLI, original1914/3828 and compiler/source/copy/frozen readiness preserved.
- [x] Finite known catalog/read ledgers/pins/STOP; Source-enabling publishers charged and self-excluded for later Root maturity.
- [ ] Complete independently reviewed fitting Source graph/adapter adoption — pending internal implementation and exact final inputs.
- [ ] Actual Source/runtime/Task03/04 functional acceptance — not performed. Task03/04 remain0/3; goal1/17 bounded Task01 only; product0%; effects0.

Fresh independent review is required before any adoption or effects. This packet is source-only prospective work; no Docker/CI/network/service/private/secret/key/target/inference or full application check was invoked.
'''

if __name__=='__main__':main()
