"""Independent finite source/data review; no implementation imports or cohort walk."""
import ast
import hashlib
import json
from pathlib import Path
import sys

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
W = R / 'work/resume/task04-c8-current-canonical-input-producers'
D = Path(__file__).resolve().parent
observations = []
checks = []
label=sys.argv[1]if len(sys.argv)==2 else'initial'
assert label in ('initial','closed-r3')

def read(relative, maximum=8388608):
    path = R / relative
    pre = path.stat()
    raw = path.read_bytes()
    post = path.stat()
    assert len(raw) <= maximum
    keys = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
    before = {key:str(getattr(pre,'st_'+key))for key in keys}
    after = {key:str(getattr(post,'st_'+key))for key in keys}
    observations.append({'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'PRE':before,'POST':after,'hostStatUnchangedAtRead':before==after,'authority':'CURRENT_HOST_REFERENCE_READ_ONLY_NOT_NATIVE_CUSTODY'})
    return raw

def data(relative):
    return json.loads(read(relative))

def check(name, condition, evidence):
    checks.append({'name':name,'status':'PASS'if condition else'FAIL','evidence':evidence})

base = 'work/resume/task04-c8-current-canonical-input-producers/source/'
names = ['ast_parser.mjs','build_reference_contract.py','canonical_entry.py','consumer_schema.mjs','consumer_wiring.mjs','literal-destination-map.json','native_boundary.py','producers.py','reference-contract.json','reference-input-observations.json','strict_io.py']
source = {name:read(base+name)for name in names}
for name,raw in source.items():
    if name.endswith('.py'):
        try: ast.parse(raw.decode('utf-8'),filename=name)
        except SyntaxError as error: check('python-parser-only:'+name,False,str(error))
        else: check('python-parser-only:'+name,True,'AST parse only; no imports or execution')
contract = json.loads(source['reference-contract.json'])
mapping = json.loads(source['literal-destination-map.json'])['rows']
old = 'work/resume/task04-c7-exact-identity-repair/candidate/'
lineage = data(old+'mirror-source-transform-map.json')['inputs']
rules = data(old+'finite-producer-rules.json')['perId']
prepared = data(old+'prepared-source-inputs.json')
command_raw = read('work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json')
command = json.loads(command_raw)
canonical = lambda value:(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)+'\n').encode()
check('all-823-original-and-comparison-content-declarations',len(contract['sources'])==len(lineage)==823 and all(contract['sources'].get(row['source'],{}).get('originalSHA256')==row['sha256'] and contract['sources'][row['source']]['originalBytes']==row['bytes'] and contract['sources'][row['source']]['comparisonSHA256']==row['legacyC6']['sha256'] and contract['sources'][row['source']]['comparisonBytes']==row['legacyC6']['bytes']for row in lineage),'Compared every source against finite C7 lineage data; no source subjects read')
check('all-823-exact-literal-destination-paths',len(mapping)==823 and len({row['logicalSource']for row in mapping})==823 and set(row['logicalSource']for row in mapping)==set(contract['sources']) and all(row[key]=='${PHASE_ROOT}/'+prefix+'/'+row['logicalSource'].removeprefix('/workspace/Project-Cortex/')for row in mapping for key,prefix in [('original','cohorts/original'),('comparison','cohorts/comparison'),('mirror','mirror')]),'Complete literal mapping comparison')
check('all-122-original-command-ids-and-canonical-content',contract['originalIds']==[row['id']for row in command['commands']] and len(set(contract['originalIds']))==122 and contract['commandCanonicalSHA256']==hashlib.sha256(canonical(command)).hexdigest() and contract['commandRawSHA256']==hashlib.sha256(command_raw).hexdigest(),'Full original command JSON bytes and every canonical field including argv/guards hashed')
logical = {row['destination']:row['source']for row in lineage}
logical.update({path:path for path in contract['ownSelectorLogicalPaths']+[contract['oldGuardLogical']]})
same_recipes = set(contract['recipes'])==set(rules)
for key,current in contract['recipes'].items():
    historical=rules[key]
    expected_entry=historical['entry']if'entry'in historical else historical['calls'][0]['producer']
    same_recipes &= current['entryLogical']==logical[expected_entry] and current['parentProfile']==historical.get('parentProfile') and len(current['calls'])==len(historical['calls'])
    for left,right in zip(current['calls'],historical['calls']):
        same_recipes &= left['producerLogical']==logical[right['producer']] and left['sourceLogicalPaths']==[logical[row['path']]for row in right['sources']] and left['kind']==right['kind'] and left['argumentExpression']==right['argumentExpression'] and left['resolution']==right['resolution']
        same_recipes &= all(left[tag]==bool(right.get(tag,False))for tag in ('parent','canonical','json'))
check('all-124-reference-recipes-and-246-selectors',same_recipes and len(contract['recipes'])==124 and sum(len(row['calls'])for row in contract['recipes'].values())==contract['selectors']==246,'Every finite selector producer/source/kind/argument/parent/canonical/JSON/resolution compared against C7 reference data')
check('prepared-reference-seven-and-self-exclusion',contract['preparedReferenceLogicalPaths']==[row['path']for row in prepared['files']] and len(prepared['files'])==7 and not any(row['path'].endswith('/candidate/prepared-source-inputs.json')for row in prepared['files']),'Reference seven inputs preserve enclosing topological self-exclusion')
gates={'ROOT':27,'ROOTReceiptBytes':1073741824,'RPC':'FULL','commands':122,'executableOperational':741,'nativeRecipes':8,'nativeSeconds':20,'residuals':301,'selectors':246,'semantic':501,'sources':823,'status':'HELD','wholeSeconds':120}
check('all-original-assertion-deadline-and-root-gates-held',contract['originalGates']==gates,'Exact independent gate vector, not executed')
delta_path='_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-canonical-input-producers/'+('proposed-admission-delta-final.json'if label=='closed-r3'else'proposed-admission-delta.json')
delta=data(delta_path)
prior_path=Path(delta['priorFiniteMetadata']['path']).relative_to(R)
prior_raw=read(str(prior_path));prior=json.loads(prior_raw)
old_paths=set(prior['finiteNoncohortFixedOutputs']);new_paths=set(delta['combinedFiniteNoncohortPaths']);added=set(delta['newFixedPaths'])
check('analytical-admission-original-paths-and-minimum-overflow',hashlib.sha256(prior_raw).hexdigest()==delta['priorFiniteMetadata']['sha256'] and len(old_paths)==52 and len(new_paths)==93 and new_paths-old_paths==added and len(added)==41 and old_paths<=new_paths and len(new_paths)-64==delta['64SlotOverflowMinimum']==29 and len(added)+len(delta['newParentPathsComparedWithPriorFixedPaths'])==delta['minimumAdditionalInodeDeltaForListedFixedPathsAndParents']==44,'29 is minimum metadata-slot overflow only; 44 excludes separately required mirrors/raw objects/aliases')
helper_bytes=sum(len(source[Path(name).name])for name in delta['futureHelperSources'])
check('analytical-admission-current-helper-bytes',helper_bytes==delta['futureHelperSourceBytes'],{'actualFiniteNamedSourceBytes':helper_bytes,'declared':delta['futureHelperSourceBytes'],'physicalCapacity':'UNKNOWN_UNRELEASED'})
check('analytical-admission-remains-unreleased',delta['scope']=='EXPLICIT_PROPOSED_ADMISSION_DELTA_NOT_RELEASE_OR_PHYSICAL_AUTHORITY' and delta['original122']=='HELD' and delta['ROOT']=='ABSENT' and delta['prior48565877696AnalyticalAdmission']=='PRESERVED_NOT_PHYSICAL_AUTHORITY' and delta['requiredOwnedCurrentMirrors']['regularSources']==823 and delta['requiredOwnedCurrentMirrors']['literalPackageAliases']==7 and delta['requiredOwnedCurrentMirrors']['notIncludedIn64MetadataSlots']is True,'Separate exact transformed bytes/directory union/raw membership/allocation/release remain required')
result={'scope':'INDEPENDENT_FINITE_SOURCE_REFERENCE_AND_ANALYTICAL_ACCOUNTING_ONLY','checks':checks,'observations':observations,'cohortTraversal':False,'implementationImports':False,'subjectEvaluation':False,'nativeQualification':False,'ROOT':'ABSENT','original122':'HELD','wholeGoal':'OPEN'}
target=D/('finite-source-analysis-'+label+'.json')
with target.open('x')as stream:stream.write(json.dumps(result,indent=2)+'\n')
print(json.dumps({'scope':result['scope'],'passed':sum(row['status']=='PASS'for row in checks),'failed':sum(row['status']=='FAIL'for row in checks),'report':str(target)}))
raise SystemExit(1 if any(row['status']=='FAIL'for row in checks)else 0)
