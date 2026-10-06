"""Selected syntax/AST/dependency checks; no helper effects or private stats."""
from pathlib import Path
import ast, hashlib, importlib.util, json, sys
sys.dont_write_bytecode=True
B=Path(__file__).resolve().parent;P=B.parent
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
B1=P/'task03-attempt5-private-source-repair1'
spec=importlib.util.spec_from_file_location('repair2_public_receipt_io',B/'receipt-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)
oldraw,old=io.read(B1/'task03-attempt5-private-coordinate.py')
newraw,new=io.read(B/'task03-attempt5-private-coordinate.py')
assert old['sha256']=='55d427ca84fed1d957edc40940c558e0659fd6b132e606f2e538fe8a8d3345f9'
oldtree,newtree=ast.parse(oldraw),ast.parse(newraw)
changes=[]
assert len(oldtree.body)==len(newtree.body)
for a,b in zip(oldtree.body,newtree.body):
    if ast.dump(a,include_attributes=False)!=ast.dump(b,include_attributes=False):
        changes.append(a.name if isinstance(a,ast.FunctionDef) else ast.unparse(a.targets[0]) if isinstance(a,ast.Assign) else type(a).__name__)
assert changes==['B','assert_recipe'],changes
oldselector,oldsp=io.read(B1/'task03-attempt5-retire-selector.py');selector,sp=io.read(B/'task03-attempt5-retire-selector.py')
assert selector==oldselector and sp['sha256']=='6ed06bdfb8a5499bdc2fabeda7ef2e3f4aa23a881011172ed810dd969818550a'
syntax=[]
for path in sorted(B.glob('*.py')):
    raw,pin=io.read(path);compile(raw,str(path),'exec');syntax.append({'path':path.name,'sha256':pin['sha256'],'status':'PASS'})
# Every unchanged coordinator function, including actual preflight/run/main/
# cleanup/retirement, is AST-exact relative to the rejected preserved B1.
unchanged=[n.name for n in oldtree.body if isinstance(n,ast.FunctionDef) and n.name!='assert_recipe']
prior=json.loads(io.read(B1/'dependency-pins.json')[0]);rows=[]
for row in prior['dependencies']:
    row=dict(row)
    if row['path'].endswith('task03-attempt5-private-source-repair1/task03-attempt5-retire-selector.py'):
        row['path']=str((B/'task03-attempt5-retire-selector.py').relative_to(R))
    path=R/row['path']
    if row['state']=='ABSENT_HELD_ACTUAL_CUSTODY_DEPENDENCY':
        assert not path.exists();rows.append(row)
    else:
        raw,pin=io.read(path);assert pin['sha256']==row['sha256'] and pin['bytes']==row['bytes']
        rows.append({**row,'currentPublicRead':pin})
assert len(rows)==12 and sum(r['state']=='ABSENT_HELD_ACTUAL_CUSTODY_DEPENDENCY' for r in rows)==1
assert not (B/'independent-private-coordinator-source-review.json').exists()
recipe=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06/coordinate-source/repair2'
commonraw,common=io.read(recipe/'task03-attempt5-coordinate-common.py');commontext=commonraw.decode()
assert 'PIPE_LIMIT = 262144' in commontext and 'INPUT_LIMIT = 327692' in commontext
assert 'input_deadline = start+12' in commontext and '0 < timeout <= 190' in commontext
assert "'terminal':command_pid is not None and command_exited and group_absent and not close_errors" in commontext
text=newraw.decode()
assert 'time.monotonic()+2400' in text
assert "'provision'], 190)" in text and "'retire'], 190)" in text
assert "NAME], 60," in text and "SELECTOR_NAME], 60," in text
assert "RECIPE = Q / 'coordinate-source/repair2'" in text
assert "assert public['ownedSourceMounts'] == {'candidate': str(Q), 'helper': str(RECIPE)}" in text
manifest=next(row for row in rows if row['path'].endswith('coordinate-source/repair2/source-receipt-manifest.json'))
assert manifest['sha256']=='73cde47e71c30a1fa63f8d9d04ee10c8950ef15d964ddd1a8f7dbfe01751b304'
io.dump_new(B/'dependency-pins-final.json',{'scope':'CURRENT_PUBLIC_DEPENDENCY_INVENTORY_NOT_APPROVAL','dependencies':rows,'approvalDependenciesExactCount':12,'sourceApprovalPresent':False,'actualCustodyHeld':True,'futureSourceApprovalPath':str((B/'independent-private-coordinator-source-review.json').relative_to(R)),'realTargetOperation':'ba2253a8-26a7-4db5-b503-9bca6710471c','actualProvisioning':False})
io.dump_new(B/'source-quality-final.json',{'scope':'SCOPED_SOURCE_SYNTAX_AST_AND_PUBLIC_DEPENDENCIES_ONLY','status':'PASS','oldSource':old,'newSource':new,'selector':sp,'changedTopLevelASTNodes':changes,'unchangedFunctionsASTExact':unchanged,'syntax':syntax,'unchangedReviewedSupervisorDependency':common,'limits':{'commandSeconds':190,'stdinSeconds':12,'inputBytes':327692,'pipeBytes':262144,'receiverSeconds':60,'selectorSeconds':60,'reviewWindowSeconds':2400},'allNinePublicDependencyReadStableFullEOF':True,'independentJudgment':False,'sourceApproved':False,'actualPrivateReads':0,'actualPrivateStats':0,'actualDockerCalls':0,'actualAPICalls':0})
print(json.dumps({'status':'PASS','syntaxFiles':len(syntax),'changedASTNodes':changes,'publicDependenciesPresent':11,'actualCustodyDependency':'ABSENT_HELD','sourceApproved':False}))
