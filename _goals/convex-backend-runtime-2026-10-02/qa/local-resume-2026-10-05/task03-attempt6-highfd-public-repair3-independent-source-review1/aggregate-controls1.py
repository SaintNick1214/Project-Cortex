"""Finite count and provenance publication from separately mature held receipts."""
import json,hashlib
from pathlib import Path
J=Path(REVIEW_DIR)
names=['independent-fault-controls2-result.json','independent-contract-controls1-result.json','independent-host-controls1-result.json','independent-interpreter-controls1-result.json']
controls=[];sources=[]
for i,name in enumerate(names):
 p=str(J/name);raw=DATA[p];r=json.loads(raw)
 rows=[x for x in r['controls'] if not x['name'].startswith('js:')] if i==0 else r['controls']
 controls.extend(rows);sources.append({'path':p,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'scope':r['scope']})
assert len({r['name'] for r in controls})==len(controls)
actual_host=json.loads(DATA[str(J/names[2])])
failures=[x for x in controls if x['status']=='FAIL']
required_program_names=['fd_fault_oracle.py','highfd-host-matrix.json','u3_bootstrap2.py','held_ledger2.py','u3_review_reader.py','independent-fault-controls2.py','independent-js-controls2.mjs','independent-contract-controls1.py','independent-interpreter-controls1.py','independent-host-controls1.py','common-host-fixture1.py','aggregate-controls1.py']
programs=[{'path':str(J/n),'bytes':len(DATA[str(J/n)]),'sha256':hashlib.sha256(DATA[str(J/n)]).hexdigest()} for n in required_program_names]
raws=[{'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for p,b in DATA.items() if p.startswith(str(J/'independent-host1')+'/') or p in {str(J/'independent-js-controls2.stdout'),str(J/'independent-js-controls2.stderr'),str(J/'independent-interpreter-controls1.stdout'),str(J/'independent-interpreter-controls1.stderr')}]
assert len([r for r in raws if '/independent-host1/' in r['path']])==27
RESULT={'scope':'INDEPENDENT_U3_SOURCE_ONLY_FINAL_CONTROL_AGGREGATE','sourceEligibility':False,'independent':True,'controls':controls,'PASS':sum(x['status']=='PASS' for x in controls),'FAIL':len(failures),'findings':failures,'qualifiedControls':len(controls),'actualOriginalHostCommands':actual_host['actualHostCommands'],'readerHeldInputs':len(OWNERS),'currentRawResultInputs':sources,'actualReviewProgramDependencies':programs,'rawDependencies':raws,'countsExcludePriorReviewerHarnessFailures':True,'originalU2REJECTPreserved':True,'author97NotIndependent':True,'fullTask03':False,'fullGoal':False,'productAcceptance':False,'actualEffects':{'Docker':0,'network':0,'credentials':0,'private':0,'service':0,'actualRunner':0}}
