"""Adversarial source/mock controls; never invokes current G/U3/B3 or effects."""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import os
import sys
import time
from unittest.mock import patch

sys.dont_write_bytecode = True
OWN=Path(__file__).absolute().parent
spec=importlib.util.spec_from_file_location('prospective_phase_partition',OWN/'phase_partition.py')
M=importlib.util.module_from_spec(spec);sys.modules[spec.name]=M;spec.loader.exec_module(M)


def row(path, size=1, value=b'x'):
    return {'path':path,'bytes':size,'sha256':hashlib.sha256(value).hexdigest(),
            'nine':{k:str(size if k=='size' else 1) for k in M.FIELDS},
            'nineBasis':'DECLARED_ORIGINAL','originalNineMissing':False,'roles':[]}


def fixture_recipe():
    members=[row('frozen/file'+str(i)) for i in range(1907)]
    members += [row('source/program'+str(i)) for i in range(50)]
    members += [row('source/required'+str(i)) for i in range(79)]
    members += [row('node_modules/typescript/file'+str(i)) for i in range(114)]
    members += [row('node_modules/cli/file'+str(i)) for i in range(5)]
    ids=[M.admission_id(r) for r in members]
    programs=ids[1907:1957]
    for r in members[1907:1957]: r['roles']=['program']
    for r in members[1957:2036]: r['roles']=['header']
    for r in members[:1907]:r['roles']=['candidateCustody']
    for r in members[2036:2150]:r['roles']=['compilerCustody']
    for r in members[2150:]:r['roles']=['CLI']
    recipe={'schema':'task03-prospective-phase-partition-v1','caps':dict(M.CAPS),
            'counts':dict(M.COUNTS),'assertions':list(M.ASSERTIONS),'members':members,
            'cohorts':{'frozen':ids[:1907],'currentPrograms':ids[1907:1939],
                       'Q6Seeds':ids[1939:1944],'originalComparands':ids[1944:1957],
                       'requiredCurrent':ids[1907:2036],'rootCompiler':ids[2036:2150],
                       'rootCLI':ids[2150:2155]},
            'futureDATA':[{'path':'data/one','maxBytes':100}],
            'unknownRequiredInputs':[],'unresolvedEdges':[],
            'writers':'STOPPED','stopSha256':'a'*64,
            'actualReadDebts':[], 'actualPLANBytes':123,
            'proposedCustodyOnly':ids[:1907]+ids[2036:2150],
            'programApprovals':{k:members[ids.index(k)]['sha256'] for k in programs},
            'bodyUseEdges':[{'caller':programs[0],'target':programs[1],'operation':'import'}],
            'conservation':{'originalBodies':'MOCK_SAME_BYTES_NO_NATIVE_CLAIM'},
            'adapters':{name:{'state':'INDEPENDENTLY_REVIEWED','program':programs[i],
                              'sha256':members[1907+i]['sha256'],
                              'direct_IO':'DENY_OUTSIDE_HELD_BROKER',
                              'assertionsSha256':M.digest(list(M.ASSERTIONS))}
                        for i,name in enumerate(M.ADAPTERS)}}
    return recipe


MOCK_AUTHORITY=object()
def mock_review(recipe, _proof):
    return M.ReviewWitness(M.digest(recipe['bodyUseEdges']),M.digest(recipe['adapters']),
                          M.digest(recipe['conservation']),M.digest(recipe['programApprovals']),
                          'b'*64,MOCK_AUTHORITY)


def proof(recipe):
    return {'recipeSha256':M.digest(recipe),'exactCustodyOnly':recipe['proposedCustodyOnly'],
            'verdict':'MOCK_ONLY_NOT_FRESH_INDEPENDENT_ACCEPTANCE'}


def run_controls():
    results=[]
    def check(name, action):
        action();results.append({'name':name,'outcome':'PASS'})
    def deny(action, fragment):
        try:action()
        except M.Denied as error:
            assert fragment in str(error), (fragment,str(error));return
        raise AssertionError('expected denial:'+fragment)
    r=fixture_recipe()
    check('finite_contract_happy_path_exact_cohorts',lambda:assert_eq(len(M.validate_contract(r)),2155))
    check('no_json_verdict_authority',lambda:deny(lambda:M.proof_of_nonuse(r,proof(r)),'review_verifier'))
    check('mock_exact_closed_no_Source_use_partition',lambda:assert_eq(len(M.proof_of_nonuse(r,proof(r),mock_review)[0]),2021))
    check('no_proof_conserves_every_original_declaration',lambda:assert_eq(M.assemble(r)['sourceVersionAdmissions'],2155))
    check('mock_partition_retains_program_header_CLI_bodies',lambda:assert_eq(M.assemble(r,proof(r),mock_review)['sourceVersionAdmissions'],134))
    for key in M.COUNTS:
        bad=copy.deepcopy(r);bad['counts'][key]+=1
        check('unchanged_count_'+key,lambda b=bad:deny(lambda:M.validate_contract(b),'counts'))
    for key in M.CAPS:
        bad=copy.deepcopy(r);bad['caps'][key]+=1
        check('unchanged_cap_'+key,lambda b=bad:deny(lambda:M.validate_contract(b),'caps'))
    bad=copy.deepcopy(r);bad['assertions'].pop()
    check('lost_original_assertion_rejected',lambda:deny(lambda:M.validate_contract(bad),'assertion_loss'))
    bad=copy.deepcopy(r);bad['cohorts']['originalComparands'][0]=bad['cohorts']['Q6Seeds'][0]
    # Distinct cohorts may overlap only when the exact physical requirement says
    # so; the real recipe conservation independently binds all13 original paths.
    bad['cohorts']['originalComparands'][1]=bad['cohorts']['originalComparands'][0]
    check('original13_alias_count_denial',lambda:deny(lambda:M.validate_contract(bad),'cohort'))
    bad=copy.deepcopy(r);bad['programApprovals'].pop(next(iter(bad['programApprovals'])))
    check('missing_Source_program_approval_pre1914',lambda:deny(lambda:M.proof_of_nonuse(bad,proof(bad),mock_review),'approval_required'))
    bad=copy.deepcopy(r);bad['programApprovals'][next(iter(bad['programApprovals']))]='d'*64
    check('changed_program_hash_approval_denial',lambda:deny(lambda:M.proof_of_nonuse(bad,proof(bad),mock_review),'approval_hash'))
    bad=copy.deepcopy(r);bad['adapters']['collector']['state']='CURRENT_GENERIC_LOOP_UNCHANGED'
    check('current_generic_loop_cannot_defer',lambda:deny(lambda:M.proof_of_nonuse(bad,proof(bad),mock_review),'adapter_not_closed'))
    bad=copy.deepcopy(r);bad['unknownRequiredInputs']=['ACTIVE_L_FINAL_UNKNOWN']
    check('missing_L_final_current_pins_blocks_closure',lambda:deny(lambda:M.proof_of_nonuse(bad,proof(bad),mock_review),'unknown_inputs'))
    bad=copy.deepcopy(r);bad['unresolvedEdges']=['dynamic_import_not_traced']
    check('untraced_import_control_blocks_closure',lambda:deny(lambda:M.proof_of_nonuse(bad,proof(bad),mock_review),'unknown_inputs'))
    bad=copy.deepcopy(r);bad['writers']='ACTIVE'
    check('STOP_required',lambda:deny(lambda:M.proof_of_nonuse(bad,proof(bad),mock_review),'unstopped'))
    bad=copy.deepcopy(r);bad['members'][0]['roles']+=['control']
    check('same_path_mixed_control_stays_Source',lambda:deny(lambda:M.proof_of_nonuse(bad,proof(bad),mock_review),'mixed_role'))
    bad=copy.deepcopy(r);bad['actualReadDebts']=[bad['cohorts']['frozen'][0]]
    check('already_consumed_read_debt_never_refunded',lambda:deny(lambda:M.proof_of_nonuse(bad,proof(bad),mock_review),'read_debt'))
    bad=copy.deepcopy(r);bad['members'][0]['originalNineMissing']=True
    check('missing_original_physical9_blocks_exclusion',lambda:deny(lambda:M.proof_of_nonuse(bad,proof(bad),mock_review),'missing_original9'))
    bad=copy.deepcopy(r);bad['quarantinedDeclarations']=[{'path':'old','bytes':6}]
    check('old_malformed_declaration_never_qualifies',lambda:deny(lambda:M.proof_of_nonuse(bad,proof(bad),mock_review),'unqualified_declaration'))
    check('malformed_original_cost_conserved_without_dedup',lambda:assert_eq(M.assemble(bad)['quarantinedDeclarationBytes'],6))
    bad=copy.deepcopy(r);bad['conservation']['sourceReadEvidence']=[{'admission':bad['cohorts']['frozen'][0],'debtRequired':True}]
    check('actual_prior_body_read_receipt_debt_removal_denial',lambda:deny(lambda:M.proof_of_nonuse(bad,proof(bad),mock_review),'debt_removed'))
    bad=copy.deepcopy(r);bad['conservation']['sourceReadEvidence']=[{'evidenceKind':'HISTORICAL_QUALIFICATION_REFERENCE_UNRESOLVED_CURRENT_LIFETIME_USE'}]
    check('old_qualified_MF_lifetime_reliance_unresolved_blocks_partition',lambda:deny(lambda:M.proof_of_nonuse(bad,proof(bad),mock_review),'lineage_unresolved'))
    bad=copy.deepcopy(r);bad['members'][1957]['roles']=['program']
    check('own_or_late_Source_program_needs_independent_approval',lambda:deny(lambda:M.proof_of_nonuse(bad,proof(bad),mock_review),'approval_required'))
    bad=copy.deepcopy(r);bad['bodyUseEdges'].append({'caller':bad['cohorts']['currentPrograms'][0],'target':bad['cohorts']['frozen'][0],'operation':'compile'})
    check('compiler_import_body_is_Source_program_before_actual_phase',lambda:deny(lambda:M.proof_of_nonuse(bad,proof(bad),mock_review),'program_not_approved'))
    bad=copy.deepcopy(r);bad['cohorts']['originalComparands'][0]=bad['cohorts']['Q6Seeds'][0]
    check('13physical_comparands_never_aliased_to_Q6_copies',lambda:deny(lambda:M.validate_contract(bad),'aliased_to_Q6'))
    check('stale_proof_recipe_denial',lambda:deny(lambda:M.proof_of_nonuse(r,dict(proof(r),recipeSha256='f'*64),mock_review),'recipe_binding'))
    check('unbound_independent_witness_denied',lambda:deny(lambda:M.proof_of_nonuse(r,proof(r),lambda *_:M.ReviewWitness('f'*64,'f'*64,'f'*64,'f'*64,'f'*64,None)),'witness_unbound'))
    ledger=M.Ledger();item=row('exact')
    ledger.admit(item,debt=True);ledger.admit(copy.deepcopy(item),debt=True)
    check('exact_all9_size_hash_path_reuse_dedup',lambda:assert_eq((len(ledger.rows),ledger.byte_count),(1,1)))
    for field in M.FIELDS:
        changed=copy.deepcopy(item);changed['nine'][field]='2'
        if field=='size': changed['bytes']=2
        one=M.Ledger();one.admit(item);one.admit(changed)
        check('changed_literal9_'+field+'_distinct_debt',lambda o=one:assert_eq(len(o.rows),2))
    for field in ('sha256','path'):
        changed=copy.deepcopy(item);changed[field]='d'*64 if field=='sha256' else 'other'
        one=M.Ledger();one.admit(item);one.admit(changed)
        check('changed_'+field+'_never_content_only_dedup',lambda o=one:assert_eq(len(o.rows),2))
    check('missing_literal9_denial',lambda:deny(lambda:M.admission_id(dict(item,nine={})), 'literal9'))
    check('read_debt_refund_API_denial',lambda:deny(lambda:ledger.refund(item),'refund'))
    check('subgraph_pool_reset_API_denial',lambda:deny(lambda:ledger.clone_for_new_phase(),'reset'))
    check('hidden_hash_denied_before_open',lambda:deny(lambda:ledger.authorize_use(item,'unknown','hash',[]),'hidden_body'))
    check('phase_launder_enabling_body_denied',lambda:deny(lambda:ledger.authorize_use(item,'c','read',[],'ACTUAL1914'),'laundering'))
    one=M.Ledger();one.admit(row('one',M.CAPS['file'],b'x'))
    one.admit(row('two',M.CAPS['file'],b'x'));one.admit(row('three',M.CAPS['file'],b'x'))
    one.admit(row('four',M.CAPS['file'],b'x'))
    check('64MiB_exact_members_still_reserves_required',lambda:deny(lambda:one.preflight(),'over64M'))
    check('64MiB_plus1_records_sticky_admission_then_denies',lambda:deny(lambda:one.admit(row('five')),'cap_exceeded'))
    check('failed_byte_admission_not_refunded',lambda:assert_eq(one.byte_count,67108865))
    check('per_file16MiB_plus1_denies',lambda:deny(lambda:M.admission_id(row('huge',M.CAPS['file']+1)),'size_hash'))
    many=M.Ledger()
    for i in range(4096):many.admit(row('p'+str(i),0,b''))
    check('4096_plus1_same_pool_denies',lambda:deny(lambda:many.admit(row('p4096',0,b'')),'cap_exceeded'))
    check('4096_members_plus_headers_denies',lambda:deny(lambda:many.preflight(),'over4096'))
    check('oneDATA_cannot_shrink_to_receipt_size',lambda:deny(lambda:ledger.preflight(data=1),'oneDATA'))
    check('oneDATA_cannot_second_pool_expand',lambda:deny(lambda:ledger.preflight(data=4194304),'oneDATA'))
    check('MF4MiB_plus1_denies',lambda:deny(lambda:ledger.preflight(mf=4194305),'oneDATA'))
    check('approval1MiB_plus1_denies',lambda:deny(lambda:ledger.preflight(approval=1048577),'oneDATA'))
    bad=copy.deepcopy(r);bad['futureDATA'][0]['maxBytes']=2097153
    check('named_DATA_within_original_2MiB_denial',lambda:deny(lambda:M.validate_contract(bad),'named_aggregate'))
    machine=M.PhaseMachine(M.Ledger())
    receipt={'counts':dict(M.COUNTS),'assertions':list(M.ASSERTIONS),'originalProgramsUnchanged':True,
             'allProgramsIndependentlyApprovedBefore1914':True}
    check('actual1914_before_Source_approval_denied',lambda:deny(lambda:machine.advance('ACTUAL1914',receipt,lambda *_:True),'phase_order'))
    check('self_attested_phase_receipt_denied',lambda:deny(lambda:machine.advance('SOURCE_APPROVED',receipt),'verifier'))
    lost=dict(receipt,assertions=[])
    check('phase_receipt_original_assertion_loss_denied',lambda:deny(lambda:machine.advance('SOURCE_APPROVED',lost,lambda *_:True),'assertions_loss'))
    noapprove=dict(receipt,allProgramsIndependentlyApprovedBefore1914=False)
    check('phase_requires_all_Source_programs_before1914',lambda:deny(lambda:machine.advance('SOURCE_APPROVED',noapprove,lambda *_:True),'unapproved'))
    for phase in M.PhaseMachine.ORDER[1:]:machine.advance(phase,receipt,lambda *_:True)
    check('all_original_readiness_phases_preserved_order',lambda:assert_eq(machine.phase,'ACTUAL_READY'))
    check('no_effect_release_even_after_mock_readiness',lambda:deny(lambda:machine.protected_action('key'),'never_releases'))
    physical_fixture_controls(check,deny,results)
    return {'scope':'SOURCE_MOCK_CONTROLS_ONLY_NO_PHYSICAL_SOURCE_GRAPH_OR_RUNTIME_ACCEPTANCE',
            'discovered':len(results),'executed':len(results),'passed':len(results),'failed':0,'skipped':0,
            'results':results,'mock_closure_not_independent_review':True,'sourceEligibility':False,'effects':0}


def physical_fixture_controls(check,deny,results):
    fixture=OWN/'controls-fixture1';fixture.mkdir(exist_ok=False)
    values={'one':b'alpha','two':b'beta','empty':b''}
    for path,value in values.items():(fixture/path).write_bytes(value)
    rows=[]
    for path,value in values.items():
        rows.append({'path':path,'bytes':len(value),'sha256':hashlib.sha256(value).hexdigest(),
                     'nine':M.nine(os.lstat(fixture/path))})
    now=time.time_ns();stop_ns=now
    edges=[{'caller':'MOCK_CALLER','target':M.admission_id(r),'operation':'read'} for r in rows]
    def new(rs=rows,es=edges):return M.HeldBroker(fixture,rs,M.Ledger(),es,'MOCK_CALLER',stop_ns)
    broker=new()
    check('body_before_all_FDs_denied',lambda:deny(lambda:broker.read('one'),'before_all'))
    # Clock is deliberately mock. These newly written fixtures do not qualify
    # actual240s maturity; final own-code hold uses the real clock separately.
    with patch.object(M.time,'time_ns',return_value=now+241000000000):
        try:
            broker.open_all();check('all_fixture_FDs_before_body',lambda:assert_eq(len(broker.held),3))
            for p,v in values.items():check('fullEOF_hash_size_'+p,lambda p=p,v=v:assert_eq(broker.read(p),v))
            check('unlisted_fixture_body_read_denied',lambda:deny(lambda:broker.read('hidden'),'undeclared_path'))
            broker.final_check();check('FDs_retained_through_final_full_qualification',lambda:assert_eq(len(broker.held),3))
        finally:broker.close()
    check('all_fixture_once_close_success',lambda:assert_eq([r['attempt'] for r in broker.close_attempts],[1,1,1]))
    check('double_close_denied',lambda:deny(lambda:broker.close(),'already_closed'))
    forbidden=new(es=[])
    with patch.object(M.os,'open',side_effect=AssertionError('hidden open occurred')):
        check('hidden_body_map_denies_before_any_fd_open',lambda:deny(lambda:forbidden.open_all(),'hidden_body'))
    forbidden.close()
    early=new()
    try:check('actual_immature_member_denied',lambda:deny(lambda:early.open_all(),'not_currently240s'))
    finally:early.close()
    changed=copy.deepcopy(rows);changed[0]['nine']['ino']=str(int(changed[0]['nine']['ino'])+1)
    changed_edges=[{'caller':'MOCK_CALLER','target':M.admission_id(r),'operation':'read'} for r in changed]
    broken=new(changed,changed_edges)
    with patch.object(M.time,'time_ns',return_value=now+241000000000):
        try:check('changed_physical9_before_open_denied',lambda:deny(lambda:broken.open_all(),'changed_before_open'))
        finally:broken.close()
    badhash=copy.deepcopy(rows);badhash[0]['sha256']='d'*64
    hedges=[{'caller':'MOCK_CALLER','target':M.admission_id(r),'operation':'read'} for r in badhash]
    broken=new(badhash,hedges)
    with patch.object(M.time,'time_ns',return_value=now+241000000000):
        try:
            broken.open_all();check('fullEOF_changed_hash_denied',lambda:deny(lambda:broken.read('one'),'hash_size'))
        finally:broken.close()
    check('failed_hash_all_FDs_closed_once',lambda:assert_eq(len(broken.close_attempts),3))
    # Replacements and current metadata mutations are detected without refreshing
    # pins. This preserves failure state rather than updating an old identity.
    broken=new()
    with patch.object(M.time,'time_ns',return_value=now+241000000000):
        try:
            broken.open_all();os.chmod(fixture/'two',0o600)
            check('changed_literal9_post_body_denied',lambda:deny(lambda:broken.read('two'),'post_path'))
        finally:broken.close()
    for path in fixture.iterdir():path.unlink()
    fixture.rmdir()
    check('owned_mock_fixture_cleanup_complete',lambda:assert_eq(fixture.exists(),False))


def assert_eq(actual, expected):
    assert actual == expected, (actual,expected)


if __name__=='__main__':
    run=sys.argv[1] if len(sys.argv)>1 else '2'
    if not run.isdigit():raise RuntimeError('finite_run_number_required')
    output=OWN/('partition-control-results'+run+'.json')
    try:
        result=run_controls()
        result['implementationSha256']=hashlib.sha256((OWN/'phase_partition.py').read_bytes()).hexdigest()
        result['controlsSha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    except BaseException as error:
        result={'scope':'PRESERVED_SOURCE_MOCK_CONTROL_FAILURE','failure':str(error),
                'type':type(error).__name__,'sourceEligibility':False,'effects':0}
        with open(OWN/('controls-denial-run'+run+'.json'),'x') as out:json.dump(result,out,indent=2);out.write('\n')
        raise
    with open(output,'x') as out:json.dump(result,out,indent=2);out.write('\n')
    print(json.dumps({k:v for k,v in result.items() if k!='results'}))
