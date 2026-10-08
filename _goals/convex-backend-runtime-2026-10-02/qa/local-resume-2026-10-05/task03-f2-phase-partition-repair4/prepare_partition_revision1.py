"""Finite metadata assembler. Reads only explicit enabling headers/programs.

No frozen candidate/compiler/J5 transitive member body is opened. Missing
original nine remains missing. All ordinary acquisitions are charged and
published; this does not qualify Source or grant a historical refund.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import os
import sys
import time

sys.dont_write_bytecode=True
OWN=Path(__file__).absolute().parent;ROOT=OWN.parents[4]
P=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
spec=importlib.util.spec_from_file_location('phase_partition_recipe',OWN/'phase_partition.py')
M=importlib.util.module_from_spec(spec);sys.modules[spec.name]=M;spec.loader.exec_module(M)
DECLARED={
 'base':P/'task03-f2-finite-source-assembler-repair3/prospective-source-plan1.json',
 'priorRecipe':P/'task03-f2-finite-source-assembler-repair3/recipe3.json',
 'classification':P/'task03-source-scope-nonuse-audit1/classification2.json',
 'freezeIndex':P/'task03-source-scope-nonuse-audit1/raw-original-freeze-index1.json',
 'auditPins':P/'task03-source-scope-nonuse-audit1/finite-publication-pins2.json',
 'auditSTOP':P/'task03-source-scope-nonuse-audit1/final-writer-stop2.json',
 'A3STOP':P/'task03-f2-finite-source-assembler-repair3/final-writer-stop1.json',
 'rootA3':P/'root-task03-f2-assembler-repair3-full30-mature-readback2.json',
 'rootAuditPrimary':P/'root-task03-source-scope-audit1-primary3-mature-readback1.json',
 'rootAuditFull':P/'root-task03-source-scope-audit2-full18-mature-readback1.json',
 'oldF1QualificationReference':P/'task03-attempt6-integrated-repair1/prospective-source-manifest-final.json',
 'RootDriver':P/'task03-attempt6-current-binding-repair2/automatic-root-driver.py',
 'ledger1':OWN/'actual-enabling-read-ledger1.json',
 'ledger2':OWN/'continued-enabling-read-ledger2.json',
 'ledger3':OWN/'continued-enabling-read-ledger3.json',
 'controls':OWN/'partition-control-results1.json',
}
EXPECTED={'classification':(124214,'6a77f535080caf0a0c89c038f7c013d063d93e72caabfa94596226246452e56d'),
          'auditPins':(9626,'b0a08dc23aacba9647b52fb5321b9b3786a43b4389b996ee89840f365d9d1d4f'),
          'auditSTOP':(1395,'cdd78b0af043d2ab8c68fbd1989c152803f6700bc27e89ae1b88a6fffc59b109')}


def acquire():
    held=[];rows=[];docs={};events=[];errors=[]
    try:
        for key,path in DECLARED.items():
            pin=M.nine(os.lstat(path));fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
            held.append((key,path,pin,fd))
            if M.nine(os.fstat(fd))!=pin or M.nine(os.lstat(path))!=pin:raise M.Denied('ordinary_open9')
        events.append({'event':'ALL_FINITE_METADATA_INPUT_FDS_BEFORE_FIRST_METADATA_BODY','count':len(held)})
        for key,path,pin,fd in held:
            chunks=[];n=0
            while True:
                b=os.read(fd,65536)
                if not b:break
                n+=len(b);chunks.append(b)
                if n>int(pin['size']) or n>M.CAPS['file']:raise M.Denied('ordinary_body_size')
            raw=b''.join(chunks);sha=hashlib.sha256(raw).hexdigest()
            if n!=int(pin['size']) or M.nine(os.fstat(fd))!=pin or M.nine(os.lstat(path))!=pin:raise M.Denied('ordinary_EOF_final9')
            if key in EXPECTED and (n,sha)!=EXPECTED[key]:raise M.Denied('stopped_audit_expected_pin_mismatch:'+key)
            rows.append({'path':str(path.relative_to(ROOT)),'bytes':n,'sha256':sha,'nine':pin,'final9':pin,
                         'fullEOF':True,'ordinaryOnly':True,'phase':'SOURCE','readCompleted_ns':time.time_ns(),
                         'role':'actual_assembler_enabling_body','closeAttempts':1})
            docs[key]=json.loads(raw) if path.suffix=='.json' else raw.decode()
        for _,path,pin,fd in held:
            if M.nine(os.fstat(fd))!=pin or M.nine(os.lstat(path))!=pin:raise M.Denied('ordinary_held_final9')
        return docs,rows,events
    finally:
        for key,path,_,fd in held:
            try:os.close(fd);error=None
            except BaseException as e:error=type(e).__name__;errors.append(error)
            events.append({'event':'ONCE_CLOSE','path':str(path.relative_to(ROOT)),'attempt':1,'error':error})
        # This file is preserved even if a later assemble step fails.
        publish('finite-metadata-acquisition4.json',{'records':rows,'events':events,'sourceEligibility':False,
                                                   'ordinaryOnly':True,'noRefund':True,'effects':0})
        if errors:raise M.Denied('ordinary_close_errors:'+','.join(errors))


def publish(name,value):
    raw=M.encode(value);fd=os.open(OWN/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
    with os.fdopen(fd,'wb')as out:out.write(raw);out.flush();os.fsync(out.fileno())
    return len(raw),hashlib.sha256(raw).hexdigest()


def normalized(value, role, basis=None):
    path=Path(value['path']);rel=str(path.relative_to(ROOT)) if path.is_absolute() else str(path)
    size=value.get('bytes',value.get('size',value.get('expectedBytes')))
    sha=value.get('sha256',value.get('expectedSha256'))
    rawpin=value.get('nine',value.get('PRE9',value.get('PRE',value.get('literal9_before'))))
    missing=rawpin is None
    if rawpin is None:
        # Only finite declared publisher paths are statted, never transitive
        # candidate/compiler/history bodies. This is current metadata only.
        rawpin=M.nine(os.lstat(ROOT/rel));basis='UNQUALIFIED_METADATA_ONLY'
    if set(rawpin)=={'st_'+f for f in M.FIELDS}:rawpin={f:rawpin['st_'+f] for f in M.FIELDS}
    pin={f:str(rawpin[f]) for f in M.FIELDS}
    row={'path':rel,'bytes':size,'sha256':sha,'nine':pin,'roles':[role],
         'nineBasis':basis or value.get('nineBasis','DECLARED_ORIGINAL'),
         'originalNineMissing':missing or value.get('originalNineMissing',False),
         'originalSerializedNine':value.get('originalSerializedNine',rawpin),
         'origins':value.get('origins',[])}
    M.valid_row(row);return row


def build(docs, actual_rows):
    members={}; debt=set(); evidence=[]
    def add(value,role,actual=False,basis=None,kind='DECLARATION_ONLY'):
        row=normalized(value,role,basis);key=M.admission_id(row)
        if key in members:
            members[key]['roles']=sorted(set(members[key]['roles'])|{role})
            members[key]['origins']=sorted(set(members[key]['origins'])|set(row['origins']))
        else:members[key]=row
        if actual:debt.add(key)
        if kind!='DECLARATION_ONLY':evidence.append({'admission':key,'path':row['path'],'evidenceKind':kind,
                                                  'debtRequired':actual,'refundAllowed':False})
        return key
    base=docs['base'];classification=docs['classification'];recipe=docs['priorRecipe']
    originalkeys={}
    for value in base['members']:
        key=add(value,'inheritedDeclaration')
        originalkeys[value['path']]=key
        if 'ACTUAL_REPAIR_ENABLING_BODY_READ' in value.get('origins',[]):
            add(value,'document',True,kind='ACTUAL_A3_ENABLING_BODY_READ_CONSERVED')
        for origin in value.get('origins',[]):
            if 'ACTUAL_SOURCE_CUSTODY_REFERENCE' in origin or 'QUALIFIED_SOURCE_INTERVAL_REFERENCE' in origin:
                evidence.append({'admission':key,'path':value['path'],
                                 'evidenceKind':'HISTORICAL_QUALIFICATION_REFERENCE_UNRESOLVED_CURRENT_LIFETIME_USE',
                                 'origin':origin,'debtRequired':False,'refundAllowed':False})
    def exact_keys(values,role):
        return [add(v,role) for v in values]
    programs=exact_keys(classification['sourcePrograms'],'program')
    seeds=[]
    for seed in classification['originalProgramSeeds']:
        found=[(k,v)for k,v in members.items()if v['path']==seed['path'] and v['bytes']==seed['bytes'] and v['sha256']==seed['sha256']]
        if len(found)!=1:raise M.Denied('missing_exact_Q6_seed:'+seed['path'])
        key,v=found[0];v['roles']=sorted(set(v['roles'])|{'program'});seeds.append(key)
    comparands=[k for k,v in members.items()if '/task03-local-native-attempt5-2026-10-06/'in v['path']]
    if len(comparands)!=13:raise M.Denied('exact_original13_comparands_required:'+str(len(comparands)))
    for k in comparands:members[k]['roles']=sorted(set(members[k]['roles'])|{'control'})
    required=[originalkeys[path] for path in base['requiredCurrent129']]
    for k in required:members[k]['roles']=sorted(set(members[k]['roles'])|{'control'})
    q6='_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt6-2026-10-06/'
    frozen=[]
    for row in docs['freezeIndex']['original']['files']:
        matches=[(k,v)for k,v in members.items()if v['path']==q6+row['path'] and v['bytes']==row['bytes'] and v['sha256']==row['sha256']]
        if len(matches)!=1:raise M.Denied('frozen_missing_or_multiple_admission:'+row['path'])
        k,v=matches[0];frozen.append(k);v['roles']=sorted(set(v['roles'])|{'candidateCustody'})
    rootnode=[k for k,v in members.items()if v['path'].startswith('node_modules/')]
    rootcompiler=[k for k in rootnode if members[k]['path'].startswith('node_modules/typescript/')]
    rootcli=[k for k in rootnode if k not in rootcompiler]
    for k in rootcompiler:members[k]['roles']=sorted(set(members[k]['roles'])|{'compilerCustody'})
    for k in rootcli:members[k]['roles']=sorted(set(members[k]['roles'])|{'CLI'})
    # Roles inheritedDeclaration are conservative costs, not evidence of body use.
    for value in classification['sourceAssemblerAndPrerequisiteHeaderBodies']:
        add(value,'header',True,kind='ACTUAL_A3_PREPARATION_INPUT_NO_REFUND')
    for value in classification['sourceAssemblerOwnBodies']:
        add(value,'header',False,kind='KNOWN_REQUIRED_USED_A3_PUBLICATION')
    for doc in ('rootA3','rootAuditPrimary','rootAuditFull'):
        for value in docs[doc]['rows']:
            add(value,'document',True,kind='ACTUAL_ROOT_ORDINARY_BODY_READ_'+doc.upper())
    for value in docs['auditPins']['members']:
        add(value,'document',False,kind='FINITE_AUDIT_PUBLICATION_REQUIRED_FOR_FUTURE_CONSERVATION_REVIEW')
    for doc in ('ledger1','ledger2','ledger3'):
        for value in docs[doc]['records']:
            add(value,'document',True,kind='ACTUAL_REPAIR4_ENABLING_BODY_READ')
    for value in actual_rows:
        add(value,'header',True,kind='ACTUAL_REPAIR4_FINITE_METADATA_ASSEMBLER_READ')
    # Prior ordinary control execution reads were not logged with a physical
    # nine at the original interpreter/body-read instant. Preserve that gap;
    # current metadata observation is separately charged, never retroqualified.
    for name in ('phase_partition.py','partition_controls.py','prepare_partition.py'):
        path=OWN/name;raw=path.read_bytes()
        add({'path':str(path.relative_to(ROOT)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},
            'program',True,kind='ACTUAL_OWN_PROGRAM_BODY_CURRENT_PIN_NOT_ORIGINAL_EXECUTION_INSTANT')
    old=docs['oldF1QualificationReference']
    old_rows=old.get('files',old.get('members',[]))
    lineage={'manifestHeaderAlreadyUsed':True,'headerBodyDebtConserved':True,
             'scope':old.get('scope'),'status':old.get('status'),'declaredCapturedRows':len(old_rows),
             'declaredCapturedBytes':sum(x.get('bytes',0) for x in old_rows),
             'allDescriptorsCapturedBeforeFirstContent':old.get('allDescriptorsCapturedBeforeFirstContent'),
             'underlyingBodiesReadByThisAssembler':False,
             'qualificationReferenceIsNotClosedNonuse':True,
             'presentLifetimeUseOfOldCapturedRows':'UNRESOLVED_NO_REFUND_NO_CUSTODY_ONLY_PROOF',
             'chargedPolicy':'ALL_INHERITED_SOURCE_DECLARATIONS_RETAINED',
             'knownSourceUseDebtCannotBeClearedByPhaseLabels':True}
    # Candidate proposals are exact IDs only. Current inheritedDeclarations
    # remain charged by assemble() with no accepted proof; Source roles/debts
    # and missing original-nine candidates can never be automatically omitted.
    proposed=[k for k in frozen+rootcompiler if not(set(members[k]['roles'])&M.SOURCE_ROLES) and k not in debt]
    for k in proposed:members[k]['roles']=[r for r in members[k]['roles'] if r!='inheritedDeclaration']
    rowlist=list(members.values())
    adapters={}
    adapter_paths={'collector':str((P/'task03-attempt6-current-binding-repair2/collect-prospective-source.py').relative_to(ROOT)),
                   'G':str((P/'task03-attempt6-current-binding-repair2/source-gates.py').relative_to(ROOT)),
                   'U3':str((P/'task03-attempt6-actual-public-custody-readiness-repair3/run-actual-review.py').relative_to(ROOT)),
                   'B3':str((P/'task03-attempt6-current-binding-repair2/new-bounded-private-native-reader3/shared-source-epoch3/audit-reader.py').relative_to(ROOT)),
                   'RootDriver':str((P/'task03-attempt6-current-binding-repair2/automatic-root-driver.py').relative_to(ROOT))}
    for name,path in adapter_paths.items():
        matches=[(k,v)for k,v in members.items()if v['path']==path]
        current=[(k,v)for k,v in matches if k in debt]
        k,v=current[-1]if current else matches[-1]
        adapters[name]={'program':k,'sha256':v['sha256'],'currentPath':path,
                        'state':'CURRENT_GENERIC_LOOP_UNCHANGED_PENDING_REVIEWED_ADAPTER',
                        'direct_IO':'CURRENT_DIRECT_IO_PENDING_HELD_BROKER_INTEGRATION',
                        'assertionsSha256':M.digest(list(M.ASSERTIONS))}
    unknown=list(base['unknownRequiredInputs'])+[
        {'role':'oldF1_actual_SOURCE_body_use_lifetime_trace','state':'UNRESOLVED',
         'required':'exact lineage/current-decision body-use and prior read debts; no old qualifying receipt refund'},
        {'role':'Root_A3_and_complete_audit_and_late_publishers','state':'READ_DEBT_CONSERVED_KNOWN_HEADERS_MORE_LATE_INPUTS_PENDING'},
        {'role':'reviewed_collector_G_U3_B3_RootDriver_adapters','state':'ALL_CURRENT_GENERIC_LOOPS_UNCHANGED'},
        {'role':'L_final_closed_source_plan_carry_wire_headers_parser_caller_bridge_ledgers_351controls',
         'state':'ACTIVE_UNQUALIFIED_LAST_ROOT_RELAY',
         'provisionalUnique':184,'provisionalBytes':4696730,'provisionalPlanBytes':106605,
         'provisionalNumbersNotAdmittedOrSavings':True,
         'exact130OriginalPinsReportedMatch':True,'newFourHelperCtimeGapPreserved':True},
        {'role':'own_stopped_final_recipe_controls_raw_review_and_Root_capture','state':'UNPUBLISHED_PENDING_THIS_PACKET_CLOSURE'}]
    conservation={'originalFrozenEnumerationSha256':classification['originalFrozen1907']['enumerationSha256'],
                  'originalCompilerEnumerationSha256':classification['compiler114PhysicalPairs']['enumerationExpectedSha256'],
                  'originalRawFreezeHeaderSha256':docs['freezeIndex']['originalSha256'],
                  'sourceReadEvidence':evidence,'oldF1QualificationLineage':lineage,
                  'original61criteriaAndCaseDeadlines':'BYTE_UNCHANGED_ORIGINAL_PROGRAMS_AND_TASKS_NOT_REDEFINED',
                  'originalAdditional7':classification['originalAdditional7'],
                  'B3SevenReaderInputsRemainSOURCE':classification['B3OriginalReaderInputs'],
                  'J5OptionalExclusive348Bytes8269992':'NO_NONUSE_PROOF_NO_OMISSION_ALL11OVERLAPS613696_AND_MANIFEST_STOP_DEBTS_RETAINED',
                  'historicalQualificationReferencesAreNotCurrentSourceEligibility':True,
                  'actualBodiesBeforeOriginalReadinessSameCumulativeSOURCE':True,
                  'currentGenericLoopsDoNotImplementThisRecipe':True}
    result={'schema':'task03-prospective-phase-partition-v1','caps':dict(M.CAPS),'counts':dict(M.COUNTS),
            'assertions':list(M.ASSERTIONS),'members':rowlist,
            'cohorts':{'currentPrograms':programs,'requiredCurrent':required,'Q6Seeds':seeds,
                       'originalComparands':comparands,'frozen':frozen,'rootCompiler':rootcompiler,'rootCLI':rootcli},
            'futureDATA':base['futureDATA'],'actualReadDebts':sorted(debt),
            'proposedCustodyOnly':proposed,'bodyUseEdges':[],
            'bodyUseEdgesState':'BLOCKED_CLOSED_CENSUS_AND_ADAPTER_EDGE_IMPLEMENTATION_REQUIRED',
            'programApprovals':{},'adapters':adapters,'conservation':conservation,
            'writers':'ACTIVE_PROSPECTIVE_AUTHOR_RECIPE_NOT_QUALIFIED', 'stopSha256':None,
            'unknownRequiredInputs':unknown,'unresolvedEdges':['original dynamic imports/control bodies and direct-IO use closure pending'],
            'actualPLANBytes':None,'actualMFBytes':None,'sourceEligibility':False,'effects':0}
    M.validate_contract(result)
    return result


if __name__=='__main__':
    try:
        docs,rows,events=acquire();recipe=build(docs,rows)
        rbytes,rsha=publish('prospective-partition-recipe1.json',recipe)
        recipe['actualPLANBytes']=rbytes
        census=M.assemble(recipe)
        census.pop('sourceRows');census.pop('custodyOnlyRows')
        census['actualPublishedPLANBytesAdditional']=rbytes
        census['knownTotalIncludingThisActualPLAN']=census['originalReservedTotalBytes']+rbytes
        census['knownOver64IncludingThisActualPLAN']=max(0,census['knownTotalIncludingThisActualPLAN']-M.CAPS['bytes'])
        census['recipeSha256']=rsha;census['actualReadDebtVersionAdmissions']=len(recipe['actualReadDebts'])
        census['historicalQualificationReferenceCount']=sum(x['evidenceKind'].startswith('HISTORICAL_')for x in recipe['conservation']['sourceReadEvidence'])
        census['exactCustodyOnlyCandidatesWithoutProof']=len(recipe['proposedCustodyOnly'])
        census['missingOriginalNineCandidates']=sum(next(x for x in recipe['members']if M.admission_id(x)==k)['originalNineMissing']for k in recipe['proposedCustodyOnly'])
        census['knownLateOwnInputsAdditional']=True
        census['verdict']='BLOCKED_KNOWN_OVER_CAP_UNCLOSED_USE_LINEAGE_CURRENT_ADAPTERS_L_AND_LATE_INPUTS'
        publish('finite-census-results1.json',census)
        print(json.dumps(census,separators=(',',':')))
    except BaseException as error:
        publish('first-preparation-denial1.json',{'scope':'PRESERVED_FINITE_AUTHOR_PREPARATION_DENIAL',
                 'error':str(error),'type':type(error).__name__,'sourceEligibility':False,'effects':0})
        raise
