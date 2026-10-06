"""Source audit only. Never read or stat the private scratch namespace."""
import ast,hashlib,importlib.util,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');G=R/'_goals/convex-backend-runtime-2026-10-02/qa';Q=G/'task03-local-native-attempt5-2026-10-06';P=G/'local-resume-2026-10-05';QA=Path(__file__).absolute().parent;B=P/'task03-attempt5-private-source-repair3';PUBLIC=Q/'coordinate-source/repair3'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
old=P/'task03-attempt5-private-source-repair2/task03-attempt5-private-coordinate.py';new=B/old.name
before=ast.parse(old.read_bytes());after=ast.parse(new.read_bytes());changed=[]
assert len(before.body)==len(after.body)
for a,b in zip(before.body,after.body):
 if ast.dump(a,include_attributes=False)!=ast.dump(b,include_attributes=False):
  assert isinstance(a,ast.Assign) and isinstance(b,ast.Assign)
  assert len(a.targets)==len(b.targets)==1 and isinstance(a.targets[0],ast.Name)
  assert a.targets[0].id==b.targets[0].id
  changed.append(a.targets[0].id)
assert changed==['B','RECIPE','VOLUME']
functions=[n.name for n in before.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef))]
assert sha(B/'task03-attempt5-retire-selector.py')==sha(P/'task03-attempt5-private-source-repair2/task03-attempt5-retire-selector.py')=='6ed06bdfb8a5499bdc2fabeda7ef2e3f4aa23a881011172ed810dd969818550a'
for name,pin in [('task03-attempt5-coordinate-common.py','1f8f6005c668401b63681e28002715d977abcc02312a199a468e32c2505fa0a2'),('task03-attempt5-linux-public-transfer.py','8faad381879d628e7c2c67cbab25b64b3135e09eb004e903e5b4b42c50dcc13f')]:assert sha(PUBLIC/name)==sha(Q/'coordinate-source/repair2'/name)==pin
freeze=Q/'candidate-freeze-attempt5.json';assert sha(freeze)=='053e131a8f408031af7ead1e2c8c73f75954ba5acd905eac9e6091a24429e570';f=json.loads(freeze.read_bytes());assert len(f['files'])==1905
names=[x['path'] for x in f['files']]+['candidate-freeze-attempt5.json','independent-preparation-review.json']+['managed-fixture/fixture/convex/_generated/'+n for n in ('api.d.ts','api.js','dataModel.d.ts','server.d.ts','server.js')];assert len(names)==len(set(names))==1912
for p in [*PUBLIC.glob('*.py'),*B.glob('*.py')]:compile(p.read_bytes(),str(p),'exec')
spec=importlib.util.spec_from_file_location('actual_repair3_private_preflight',new);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
reads=[];original=Path.read_bytes

def safe_read(path):
 assert not str(path).startswith(str(m.S)), 'private reads forbidden in source audit'
 reads.append(str(path));return original(path)
Path.read_bytes=safe_read
try:
 try:m.preflight();raise AssertionError('missing real approval must fail')
 except FileNotFoundError as e:assert e.filename==str(m.APPROVAL)
finally:Path.read_bytes=original
assert reads==[str(m.APPROVAL)]
deps=m.dependencies();assert len(deps)==len(set(deps))==12
present=[];missing=[]
for p in deps:
 try:present.append({'path':str(p.relative_to(R)),'sha256':sha(p)})
 except FileNotFoundError:missing.append(str(p.relative_to(R)))
# The source manifest will be written later after finalization. Its prospective
# absence here is not a fabricated dependency or runtime eligibility result.
assert set(missing)=={str((PUBLIC/'source-receipt-manifest.json').relative_to(R)),str((P/'task03-attempt5-linux-public-custody-review.json').relative_to(R))}
result={'scope':'SOURCE_ONLY_DELTA_CONSERVATION_AND_HELD_PREFLIGHT','status':'PASS','privateChangedAssignmentNames':changed,'privateFunctionASTExact':functions,'privateSourceSha256':sha(new),'publicSourceSha256':sha(PUBLIC/'task03-attempt5-public-coordinate.py'),'selectorSha256':sha(B/'task03-attempt5-retire-selector.py'),'frozenPublicMembers':1905,'plannedExactCopyMembership':1912,'exactDependencyCount':12,'presentBeforeManifest':present,'missingBeforeManifest':missing,'actualPreflightReads':reads,'actualPreflight':'DENIED_MISSING_SOURCE_APPROVAL_BEFORE_PRIVATE_NAMESPACE','actualPublicCopyExecuted':False,'actualPrivateOutputsExecuted':False,'privateReads':0,'privateStats':0,'DockerCalls':0,'APICalls':0,'sourceApproved':False}
(QA/'raw/static-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ('presentBeforeManifest','privateFunctionASTExact')}))
