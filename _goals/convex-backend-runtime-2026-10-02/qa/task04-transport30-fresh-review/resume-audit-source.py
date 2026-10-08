import ast,datetime,json,sys,traceback
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex');W=ROOT/'work/resume/task04-transport30-fresh-review';OUT=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-transport30-fresh-review';PACK=OUT.parent/'task04-evidence-transport-30';SRC=OUT.parent/'task04-catalog-release-c4-fresh-review'
tree=ast.parse((W/'audit.py').read_text())
selected=[n for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom,ast.FunctionDef))]
exec(compile(ast.Module(body=selected,type_ignores=[]),'corrected-audit-definitions','exec'))
record={'argv':sys.argv,'utcPre':now(),'checks':[],'failures':[],'qualificationAcceptance':False,'priorSuccessfulEvidence':'reviewer-failed-audit-receipt.json; failure there is reviewer expectation defect, not subject helper failure'}
ns={'__name__':'review_helper','__file__':str(PACK/'materialize.py')};exec(compile((PACK/'materialize.py').read_text(),str(PACK/'materialize.py'),'exec'),ns)
source_manifest=json.loads((SRC/'qa-manifest.json').read_bytes())
try:
    check('corrected-independent-negative-controls',adverse)
    check('frozen-source-closure-after',lambda:verify_closure(SRC,source_manifest))
    check('packet-closure-after',packet)
    record['exitCode']=0
except BaseException:
    record['exitCode']=1;raise
finally:
    record['utcPost']=now();(OUT/'completion-receipt.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
