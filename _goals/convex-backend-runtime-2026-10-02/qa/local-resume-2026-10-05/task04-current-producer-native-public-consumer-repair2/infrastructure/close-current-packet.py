"""HOST QA closing consumer; inject an independently byte-verified consumer namespace.

No operative runtime import, workflow activation, service, or Git mutation.
All inputs must mature for 60 seconds before this first current capture.
"""
def close_current_packet(C, plan_raw):
    N=C['N'];Path=C['Path'];require=C['require'];strict=C['strict'];output=C['output']
    expected_names={
      'CONSUMER-CONTRACT.md','controls/outcome-results1.json','controls/outcome_controls.py',
      'data/future-root-approval-contract.json','data/reference-contract.json',
      'evidence/consumer-loader-FDclosure1.json','evidence/consumer-program-first-FDclosure1.json',
      'evidence/consumer-program-first-mature-capture1.json','evidence/current-consumer1.json',
      'evidence/first-current-mature-baseline1.json','evidence/root-quiescence-first-capture1.json',
      'evidence/report-input-current-readback1.json','program-source-manifest.json','program-source-manifest2.json',
      'programs/consumer.py','semantic-delta0.json','source-writer-stop.json','source-writer-stop2.json',
      'infrastructure/close-current-packet.py','report.md','verdict.json','source-consumer-manifest.json',
      'packet-input-plan.json','writer-stop.json','exact-digests.sha256'}
    plan=strict(plan_raw)
    require(type(plan)is dict and set(plan)=={'schema','files','selfExcludedFinalOutputs','maturitySeconds','runtimeAuthority','sourceEligibility','old119Scope'},'EXACT_CLOSING_PLAN_KEYS')
    require(plan['schema']=='FINITE_MATURE_CURRENT_CLOSING_INPUT_PLAN_V2'and type(plan['files'])is list and all(type(p)is str for p in plan['files'])and len(plan['files'])==len(expected_names)and set(plan['files'])==expected_names,'EXACT_FINITE_CURRENT_INPUT_MEMBERSHIP')
    require(type(plan['maturitySeconds'])is int and plan['maturitySeconds']==60 and plan['runtimeAuthority']is False and plan['sourceEligibility']is False and plan['old119Scope']=='FAILED_IMMUTABLE','EXACT_NON_ENABLING_CLOSING_SCOPE')
    require(plan['selfExcludedFinalOutputs']==['final-current-closed-readback1.json','closed-handoff.json'],'EXACT_FINAL_OUTPUT_SELF_EXCLUSIONS')
    actual={str(p.relative_to(N))for p in N.rglob('*')if p.is_file()}
    require(actual==expected_names,'NO_UNDECLARED_OWN_PACKET_INPUT_OR_EARLY_FINAL_OUTPUT')
    own_held=C['open_inputs']([N/name for name in sorted(expected_names)]);own_rows=[];raws={};ref_held=[];ref_rows=[];total=0
    try:
        for held in own_held:
            row,raw=C['read_held'](held,collect=True);own_rows.append(row);raws[row['path']]=raw;total+=row['bytes']
            require(total<=C['TOTAL_MAX'],'FINITE_CLOSING_TOTAL')
        base_row=next(row for row in own_rows if row['path']==str(N/'evidence/first-current-mature-baseline1.json'))
        require((base_row['bytes'],base_row['sha256'])==(2366575,'d6415ab558cfca2dfe246e261d8c01fce26152487314a6ef7fdfb7bfcce22b5e'),'EXACT_FIRST_MATURE_BASELINE_TRANSFER_BYTES')
        baseline=strict(raws[base_row['path']])
        require(baseline['schema']=='DISTINCT_FIRST_CURRENT_MATURE_BASELINE_V2'and type(baseline['count'])is int and baseline['count']==1277 and len(baseline['files'])==1277 and baseline['oldPacketScope']=='FAILED'and baseline['oldFailedCount']==119 and baseline['runtimeAuthority']is False and baseline['sourceEligibility']is False,'EXACT_CURRENT_BASELINE_HISTORY_AND_MEMBERSHIP')
        reference_paths=[row['path']for row in baseline['files']]
        require(len(set(reference_paths))==1277,'NO_DUPLICATE_CURRENT_REFERENCE')
        ref_held=C['open_inputs']([Path(p)for p in reference_paths])
        for held,expected in zip(ref_held,baseline['files']):
            row,_=C['read_held'](held,expected)
            C['check_row'](row,{'identity':expected['PRE'],'bytes':expected['bytes'],'sha256':expected['sha256']})
            ref_rows.append(row);total+=row['bytes'];require(total<=C['TOTAL_MAX'],'FINITE_CLOSING_TOTAL')
        source_rows=[row for row in baseline['files']if'STABLE_OPERATIVE113'in row['roles']]
        original_rows=[row for row in baseline['files']if'STABLE_ORIGINAL336'in row['roles']]
        failed=[row for row in baseline['files']if row['oldPacketLiteral']is not None and row['PRE']!=row['oldPacketLiteral']]
        require(len(source_rows)==113 and len(original_rows)==336 and len(failed)==119,'EXACT_CONSERVED_SCOPE_COUNTS')
        require(all(row['stableLiteral']==row['PRE']for row in source_rows+original_rows),'ALL_ORIGINAL_STABLE_LITERAL_NINE_CONSERVED')
        require(all([k for k in C['FIELDS']if row['PRE'][k]!=row['oldPacketLiteral'][k]]==['ctime_ns']for row in failed),'OLD119_LITERAL_CTIME_FAILURES_STILL_FAILED')
        mf=strict(raws[str(N/'program-source-manifest2.json')])
        for pin in mf['files']:
            row=next(row for row in own_rows if row['path']==str(N/pin['path']))
            require((row['bytes'],row['sha256'])==(pin['bytes'],pin['sha256']),'EXACT_EXISTING_CONSUMER_CODE_DATA_MF')
        smf=strict(raws[str(N/'source-consumer-manifest.json')])
        close_pin=smf['closingInfrastructureSource']
        close_row=next(row for row in own_rows if row['path']==str(N/'infrastructure/close-current-packet.py'))
        require(close_pin['path']=='infrastructure/close-current-packet.py'and (close_pin['bytes'],close_pin['sha256'])==(close_row['bytes'],close_row['sha256']),'EXACT_MATURE_CLOSING_SOURCE_BYTES')
        for row in own_rows+ref_rows:C['final_fence'](row)
    finally:
        ref_closes=C['close_inputs'](ref_held);own_closes=C['close_inputs'](own_held)
    value={'schema':'FINITE_FIRST_MATURE_CURRENT_CLOSED_READBACK_V2','status':'CURRENT_REFERENCE_MATCH',
      'ownInputs':own_rows,'ownInputCount':len(own_rows),'referencedInputs':ref_rows,'referenceCount':len(ref_rows),
      'totalReadBytes':total,'ownFDCloses':own_closes,'referenceFDCloses':ref_closes,
      'allInputsMinimumActualAgeNs':min(row['ageNsAtFirstOpen']for row in own_rows+ref_rows),
      'allNineFullEOFHashSizeAndHeldPathFinalCompared':True,'oldStableSource113':'EXACT_LITERAL_MATCH',
      'oldStableOriginal336':'EXACT_LITERAL_MATCH','old119OriginalScope':'FAILED_IMMUTABLE',
      'historicalCustodyRepaired':False,'runtimeAuthority':False,'sourceEligibility':False,
      'selfExcludedNewOutputs':plan['selfExcludedFinalOutputs'],'finalOutputsRequireMatureFirstCaptureBeforeFutureInputUse':True}
    closure_pin=output('final-current-closed-readback1.json',value)
    exact_pins=[{'path':str(Path(row['path']).relative_to(N)),'bytes':row['bytes'],'sha256':row['sha256']}for row in own_rows]
    exact_pins.append({'path':'final-current-closed-readback1.json','bytes':closure_pin['bytes'],'sha256':closure_pin['sha256']})
    handoff={'schema':'CLOSED_DISTINCT_PROSPECTIVE_CONSUMER_HANDOFF_V2','role':'IMPLEMENTATION_EXECUTOR_PARTIAL_PENDING_NEW_FRESH_INDEPENDENT_JUDGE',
      'namespace':str(N),'exactPins':exact_pins,'closedReadback':closure_pin,
      'referenceCount':1277,'oldStableSource113':'EXACT_LITERAL_MATCH','oldStableOriginal336':'EXACT_LITERAL_MATCH',
      'old119OriginalPinsNowMatch':False,'old119Scope':'FAILED_IMMUTABLE','source2OwnSetupFailurePreserved':True,
      'source2BehavioralQualification':'UNEXECUTED','prior83RuntimeAssertions':'CONSERVED_NOT_INDEPENDENTLY_QUALIFIED',
      'newControls':'48_MOCK_STATIC_PASS','semanticDelta':0,'operativeSourceCopies':0,
      'sourceEligibility':False,'runtimeAuthority':False,'futureRootApproval':'ABSENT_REQUIRED',
      'nextJudgeMustReview':'ALL_UNCHANGED_R1_OPERATIVE_PROGRAM_BEHAVIOR_AND_DISTINCT_CONSUMER_BOUNDARY',
      'allOriginalTask04RuntimePhysicalFunctionalAnd17GoalCriteria':'OPEN_HELD',
      'workflowActivation':'ABSENT_HELD','minimumActualInputAgeBeforeNextJudgeFirstCaptureSeconds':60,
      'noHistoricalPinForFreshFinalOutput':True,'freshOutputsRequireNewCurrentNineFullEOFHeldFDConsumer':True,
      'inputWritersStoppedBeforeFirstCurrentCapture':True,'closingWriterWritesOnlyTwoSelfExcludedOutputsThenStops':True}
    handoff_pin=output('closed-handoff.json',handoff)
    return {'closedReadback':closure_pin,'closedHandoff':handoff_pin,'ownInputCount':len(own_rows),
      'referenceCount':len(ref_rows),'totalReadBytes':total,'minimumActualInputAgeNs':value['allInputsMinimumActualAgeNs']}
