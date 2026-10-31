import json,hashlib
from pathlib import Path
J=Path(REVIEW_DIR)
names=['independent-fault-controls2-result.json','independent-contract-controls3-result.json','independent-host-controls1-result.json','independent-interpreter-controls2-result.json']
controls=[];sources=[]
for i,name in enumerate(names):
 p=str(J/name);b=DATA[p];r=json.loads(b);rows=[x for x in r['controls'] if not x['name'].startswith('js:')] if i==0 else r['controls'];controls.extend(rows);sources.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'scope':r['scope']})
assert len(set(x['name'] for x in controls))==len(controls)==137
program_names=['fd_fault_oracle.py','highfd-host-matrix.json','u3_prospective_bootstrap3.py','held_ledger2.py','u3_prospective_reader2.py','independent-fault-controls2.py','independent-js-controls2.mjs','independent-contract-controls3.py','independent-interpreter-controls2.py','independent-host-controls1.py','common-host-fixture1.py','aggregate-controls2.py']
programs=[{'path':str(J/n),'bytes':len(DATA[str(J/n)]),'sha256':hashlib.sha256(DATA[str(J/n)]).hexdigest()} for n in program_names]
raws=[{'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for p,b in DATA.items() if p.startswith(str(J/'independent-host1')+'/') or p in {str(J/'independent-js-controls3.stdout'),str(J/'independent-js-controls3.stderr'),str(J/'independent-interpreter-controls2.stdout'),str(J/'independent-interpreter-controls2.stderr')}]
assert len([x for x in raws if '/independent-host1/' in x['path']])==27
RESULT={'scope':'INDEPENDENT_U3_SOURCE_ONLY_FINAL_CONTROL_AGGREGATE','sourceEligibility':False,'independent':True,'qualifiedControls':137,'controls':controls,'PASS':sum(x['status']=='PASS' for x in controls),'FAIL':sum(x['status']=='FAIL' for x in controls),'actualOriginalHostCommands':9,'currentRawResultInputs':sources,'actualReviewProgramDependencies':programs,'rawDependencies':raws,'readerHeldInputs':len(OWNERS),'oldFailedControlPinsNeverRefreshed':True,'noCustodyThroughGap':True,'countsExcludePriorReviewerHarnessFailures':True,'author97NotIndependent':True,'originalU2REJECTPreserved':True,'fullTask03':False,'fullGoal':False,'productAcceptance':False,'actualEffects':{'Docker':0,'network':0,'credentials':0,'private':0,'service':0,'actualRunner':0}}
