import ast,json,hashlib
from pathlib import Path
J=Path(REVIEW_DIR);U=J.parent/'task03-attempt6-actual-public-custody-readiness-repair3';OLD=U.parent/'task03-attempt6-actual-public-custody-readiness-repair2';QA=J.parent.parent
names=['independent-fault-controls2-result.json','independent-contract-controls3-result.json','independent-host-controls1-result.json','independent-interpreter-controls2-result.json']
controls=[];sources=[]
for i,name in enumerate(names):
 p=str(J/name);b=DATA[p];r=json.loads(b);rows=[x for x in r['controls'] if not x['name'].startswith('js:')] if i==0 else r['controls']
 for original in rows:
  x=dict(original);x['qualification']='OBSERVED_UNQUALIFIED_FAILED_REVIEWER_CUSTODY_INTERVAL' if i in (0,2) else 'CURRENT_DISTINCT_SOURCE_INTERVAL';controls.append(x)
 sources.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'scope':r['scope']})
parsed=ast.parse(DATA[str(J/'independent-contract-controls3.py')]);f=next(n for n in parsed.body if isinstance(n,ast.FunctionDef) and n.name=='common_conservation');scope={'DATA':DATA,'QA':QA,'OLD':OLD,'hashlib':hashlib}
exec(compile(ast.fix_missing_locations(ast.Module(body=[f],type_ignores=[])),'<held-current-Common-conservation>','exec'),scope)
replacement={'name':'Common:full-original-byte-conservation','status':'PASS','details':scope['common_conservation'](),'qualification':'CURRENT_DISTINCT_SOURCE_INTERVAL','retainedMissingComparandAttempt':'independent-contract-controls3-result.json'}
controls=[replacement if x['name']==replacement['name'] else x for x in controls]
assert len(set(x['name'] for x in controls))==len(controls)==137
current=[x for x in controls if x['qualification']=='CURRENT_DISTINCT_SOURCE_INTERVAL'];assert len(current)==69
program_names=['fd_fault_oracle.py','highfd-host-matrix.json','u3_prospective_bootstrap3.py','held_ledger2.py','u3_prospective_reader2.py','independent-fault-controls2.py','independent-js-controls2.mjs','independent-contract-controls3.py','independent-interpreter-controls2.py','independent-host-controls1.py','common-host-fixture1.py','aggregate-controls4.py','review-packet-close1.py']
programs=[{'path':str(J/n),'bytes':len(DATA[str(J/n)]),'sha256':hashlib.sha256(DATA[str(J/n)]).hexdigest()} for n in program_names]
raws=[{'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for p,b in DATA.items() if p.startswith(str(J/'independent-host1')+'/') or p in {str(J/'independent-js-controls3.stdout'),str(J/'independent-js-controls3.stderr'),str(J/'independent-interpreter-controls2.stdout'),str(J/'independent-interpreter-controls2.stderr')}]
assert len([x for x in raws if '/independent-host1/' in x['path']])==27
RESULT={'scope':'INDEPENDENT_U3_SOURCE_ONLY_FINAL_CONTROL_AGGREGATE','sourceEligibility':False,'independent':True,'observedControls':137,'observedPASS':sum(x['status']=='PASS' for x in controls),'observedFAIL':sum(x['status']=='FAIL' for x in controls),'qualifiedCurrentControls':69,'qualifiedCurrentPASS':sum(x['status']=='PASS' for x in current),'qualifiedCurrentFAIL':sum(x['status']=='FAIL' for x in current),'earlierUnqualifiedControls':68,'controls':controls,'actualOriginalHostCommandsObserved':9,'currentRawResultInputs':sources,'actualReviewProgramDependencies':programs,'rawDependencies':raws,'readerHeldInputs':len(OWNERS),'failedOwnThreeNinePinsNeverRefreshed':True,'noCustodyThroughGap':True,'oldHostAndPythonControlsNotRetrospectivelyQualified':True,'author97NotIndependent':True,'originalU2REJECTPreserved':True,'fullTask03':False,'fullGoal':False,'productAcceptance':False,'actualEffects':{'Docker':0,'network':0,'credentials':0,'private':0,'service':0,'actualRunner':0}}
