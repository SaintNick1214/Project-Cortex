"""Bounded receipt capture for source-only checks; no operational approval."""
import importlib.util,json,os,sys
from pathlib import Path
sys.dont_write_bytecode=True
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=Path(__file__).absolute().parent
COMMON=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06/coordinate-source/repair3/task03-attempt5-coordinate-common.py'
spec=importlib.util.spec_from_file_location('unchanged_bounded_source_check_supervisor',COMMON);C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C)
out=QA/'raw/source-checks-qualified-absence';out.mkdir(mode=0o700)
rows=[]
for label in ('private-guards','static-audit','absence-guards','selected-main-controls'):
 row,stdout,stderr=C.run(label,[sys.executable,'-B',str(QA/(label+'.py'))],out,60,{**os.environ,'CORTEX_COORDINATOR_CWD':str(R)},required=False)
 rows.append(row)
 C.durable_json(out/(label+'-summary.json'),{'stdout':stdout.decode(),'stderr':stderr.decode(),'exitCode':row['exitCode']})
 if row['terminal'] is not True or row['closeErrors'] or row['failureClass'] is not None or type(row['exitCode']) is not int or row['exitCode']!=0:
  C.durable_json(out/'commands.json',{'status':'FAIL','scope':'SOURCE_ONLY_CHECKS','commands':rows});raise SystemExit(1)
C.durable_json(out/'commands.json',{'status':'PASS','scope':'SOURCE_ONLY_CHECKS','commands':rows,'operationalApprovalWritten':False})
print(json.dumps({'status':'PASS','checks':len(rows),'scope':'SOURCE_ONLY_CHECKS','raw':str(out)}))
