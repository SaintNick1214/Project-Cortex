"""Public synthetic outcomes. No historical or native physical authority."""
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

W = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(W / 'source'))
from strict_io import Hold, Reader, consumer_pin, encoded, ident, strict_json
from producers import Prepared, produce_current, produce_public_control, PACKAGES, HISTORY_IDS, RECEIPT_KEYS

NODE = os.environ.get('C8_PUBLIC_CONTROL_NODE', '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node')
TS = os.environ.get('C8_PUBLIC_CONTROL_TS_PARSER', '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/typescript/lib/typescript.js')
COMMAND_REFERENCE = Path(os.environ.get('C8_PUBLIC_CONTROL_COMMAND_REFERENCE', '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json'))
H = lambda data: hashlib.sha256(data).hexdigest()
RESULTS = []
SETTLE_NEW_METADATA = False


class PublicSyntheticOwner:
    binding_hash = '1'*64
    physical_release_hash = '2'*64
    transform_hash = None
    parser_hash = None
    checks = 0
    def verify(self):
        self.checks += 1


def put(path, data):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with open(path, 'xb') as stream:
        os.chmod(path, 0o600); stream.write(data); stream.flush(); os.fsync(stream.fileno())
    if SETTLE_NEW_METADATA: time.sleep(0.4)
    row, _ = Reader().read(str(path), 8388608)
    return {key: value for key, value in row.items() if key != 'EOF'}


def run_node(script, args, stdout_path):
    argv = [NODE, '--input-type=module', '-e', script, *map(str, args)]
    with open(stdout_path, 'xb') as output, open(str(stdout_path)+'.stderr', 'xb') as error:
        child = subprocess.Popen(argv, stdout=output, stderr=error, env={'PATH': str(Path(NODE).parent)+':/usr/bin:/bin', 'HOME': os.environ['HOME']})
        try: code = child.wait(timeout=30)
        except subprocess.TimeoutExpired:
            child.kill(); child.wait(timeout=5); raise
    assert code == 0, (argv[0], code, Path(str(stdout_path)+'.stderr').read_text())
    assert stdout_path.stat().st_size <= 8388608, 'PUBLIC_SOURCE_CONTROL_OUTPUT_BOUND'
    return strict_json(stdout_path.read_bytes())


def build(root):
    root.mkdir(mode=0o700)
    phase = root/'phase'; phase.mkdir(mode=0o700)
    contract = strict_json((W/'source/reference-contract.json').read_bytes())
    contract = copy.deepcopy(contract)
    original_command = strict_json(COMMAND_REFERENCE.read_bytes())
    producer_calls = {}
    for recipe in contract['recipes'].values():
        for logical in {c['producerLogical'] for c in recipe['calls']}:
            calls = [c for c in recipe['calls'] if c['producerLogical'] == logical]
            if logical in producer_calls:
                assert [(c['kind'], c['argumentExpression']) for c in producer_calls[logical]] == [(c['kind'], c['argumentExpression']) for c in calls]
            else: producer_calls[logical] = calls
    data = {}
    for logical in contract['sources']:
        body = b'export const publicSyntheticMarker="NO_EVALUATION";\n'
        if logical in producer_calls:
            text = "const publicEmoji='🧭'; "
            for call in producer_calls[logical]:
                text += ('new SourceTextModule' if call['kind']=='SourceTextModule' else 'runInContext') + '(' + call['argumentExpression'] + ');\n'
            body = text.encode()
        data[logical] = body
        contract['sources'][logical]['originalSHA256'] = contract['sources'][logical]['comparisonSHA256'] = H(body)
        contract['sources'][logical]['originalBytes'] = contract['sources'][logical]['comparisonBytes'] = len(body)
    # Keep every original ID/argv/other field, while marking hashes in this public synthetic contract.
    command = copy.deepcopy(original_command)
    for item in command['commands']:
        logical = next(arg for arg in item['proposedArgv'] if arg in data)
        item['entrySha256'] = H(data[logical])
    contract['commandCanonicalSHA256'] = H(encoded(command))
    raw = {}; counts = {}; specs = {}; physical = {}; mirrors = []
    def backing(body):
        sha = H(body)
        if sha not in raw: raw[sha] = put(phase/'raw-preimages'/sha, body)
        return raw[sha] | {'encoding': 'RAW_EXACT_PREIMAGE'}
    def regular(phase_name, logical, body, package=None, archive_root=None):
        if phase_name=='packages':
            leaf = 'node_modules/'+package+'/'+logical[len(archive_root)+1:]
            declared = {'path': logical, 'type': 'regular', 'bytes': len(body), 'sha256': H(body)}
        else:
            leaf = logical.removeprefix('/workspace/Project-Cortex/')
            declared = {'path': logical, 'bytes': len(body), 'sha256': H(body)}
            if phase_name=='full8': declared.update(kind='file', mode=0o600)
        path = phase/'cohorts'/phase_name/leaf
        pin = put(path, body); prebytes = backing(body)
        item = {'declared': declared, 'freshPhysicalSource': pin, 'beforeByteBacking': prebytes, 'historicalIdentityAdopted': False}
        declaration = {'declared': declared, 'physicalPath': str(path)}
        if package:
            item.update(package=package, packageImportedOrExecuted=False); declaration.update(package=package, archiveRoot=archive_root)
        physical[(phase_name, logical)] = pin
        return item, declaration
    def cohort(name, objects):
        ledger = [item for item, declaration in objects]; declarations = [declaration for item, declaration in objects]
        ledger_pin = put(phase/'physical-receipts'/name/'source-rows.jsonl', b''.join(encoded(row) for row in ledger))
        decl_pin = put(phase/'declarations'/(name+'.jsonl'), b''.join(encoded(row) for row in declarations))
        receipt = dict.fromkeys(RECEIPT_KEYS, [])
        receipt.update(status='SOURCE_ONLY_PHYSICAL_COHORT_COMPLETE_NOT_RUNTIME', phase=name,
                       binding={'sha256':'1'*64}, reviewRelease={'sha256':'2'*64}, ledgerRows=len(ledger), ledger=ledger_pin,
                       subjectImportedOrEvaluated=False, ROOT='ABSENT', elapsedSeconds=0, rawPins={})
        receipt_pin = put(phase/'physical-receipts'/name/'receipt.json', encoded(receipt))
        specs[name] = {'receipt': receipt_pin, 'ledger': ledger_pin, 'declarations': decl_pin, 'membershipSHA256': H(b''.join(encoded(row) for row in declarations))}
        counts[name] = [len(ledger), sum(row['declared']['bytes'] for row in ledger if 'freshPhysicalSource' in row), sum('freshPhysicalSource' not in row for row in ledger)]
    full = [regular('full8', 'public-root-'+str(i)+'/entry.txt', b'PUBLIC_'+str(i).encode()) for i in range(8)]
    link_path = phase/'cohorts/full8/public-root-0/literal-link'; target = b'entry.txt'; os.symlink(os.fsdecode(target), link_path)
    declaration = {'path':'public-root-0/literal-link','kind':'literal-symlink','mode':0o777,'targetHex':target.hex(),'bytes':len(target),'sha256':H(target)}
    full.append(({'declared':declaration,'freshLiteralSymlink':'entry.txt','targetHex':target.hex(),
                  'beforeByteBacking':{k:v for k,v in backing(target).items() if k!='encoding'}, 'PRE':ident(os.lstat(link_path)),
                  'POST':ident(os.lstat(link_path)),'pathPOST':ident(os.lstat(link_path)),'historicalIdentityAdopted':False},
                 {'declared':declaration,'physicalPath':str(link_path)}))
    cohort('full8', full)
    command_logical = '/workspace/Project-Cortex/work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json'
    history = [regular('history', contract['oldGuardLogical'], b'EXACT_PUBLIC_NEGATIVE_FIXTURE\n'),
               regular('history', command_logical, encoded(command)), regular('history','/workspace/Project-Cortex/public-history.txt',b'PUBLIC_HISTORY\n')]
    cohort('history', history)
    for name in ('original','comparison'):
        cohort(name, [regular(name, logical, body) for logical, body in data.items()])
    package_objects = []
    for name in PACKAGES:
        package_objects.append(regular('packages','package/package.json',encoded({'name':name,'scope':'PUBLIC_SYNTHETIC_NO_IMPORT'}),name,'package'))
    package_objects.append(regular('packages','package/lib/main.js',b'// PUBLIC_SYNTHETIC_NO_IMPORT\n','esbuild','package'))
    package_objects.append(regular('packages','package/bin/esbuild',b'PUBLIC_SYNTHETIC_NEVER_EXECUTE\n','@esbuild/linux-x64','package'))
    cohort('packages',package_objects)
    for logical, body in data.items():
        path = phase/'mirror'/logical.removeprefix('/workspace/Project-Cortex/')
        text=body.decode();changes=[]
        for source,destination in contract['sources'][logical].get('allowedLiteralPairs',[]):
            destination=destination.replace('${PHASE_ROOT}',str(phase));occurrences=text.count(source)
            if occurrences:
                changes.append({'from':source,'to':destination,'occurrences':occurrences,'kind':'EXACT_LITERAL_NAMESPACE_SUBSTITUTION'});text=text.replace(source,destination)
        current=text.encode();pin=put(path,current);mirrors.append({'logicalSource':logical,'currentMirror':pin,'beforeByteBacking':backing(current),'changes':changes})
    extras = []
    for logical in contract['ownSelectorLogicalPaths']:
        text = "const publicEmoji='🧭'; "
        for call in producer_calls[logical]: text += ('new SourceTextModule' if call['kind']=='SourceTextModule' else 'runInContext')+'('+call['argumentExpression']+');\n'
        pin = put(phase/'candidate'/Path(logical).name,text.encode())
        extras.append({'logicalSource':logical,'freshPhysicalSource':pin,'beforeByteBacking':backing(text.encode())})
    alias_root = phase/'mirror/node_modules'; alias_root.mkdir(mode=0o700); (alias_root/'@esbuild').mkdir(mode=0o700); (alias_root/'@types').mkdir(mode=0o700)
    aliases = []
    for package in PACKAGES:
        path=alias_root/package; target=phase/'cohorts/packages/node_modules'/package
        os.symlink(str(target),path)
        aliases.append({'package':package,'path':str(path),'target':str(target),'identity':ident(os.lstat(path)),
                        'capturedPackageRows':sum(item['package']==package for item, declaration in package_objects)})
    alias_doc = {'directories':[{'path':str(p),'identity':ident(os.lstat(p)),'members':sorted(os.listdir(p))}for p in (alias_root,alias_root/'@esbuild',alias_root/'@types')],
                 'links':aliases,'wholeNodeModulesAlias':False,'NODE_PATH':'ABSENT'}
    aliases_pin = put(phase/'input-data/aliases.json',encoded(alias_doc))
    transforms_pin = put(phase/'input-data/transforms.json',encoded({'schema':'C8_LITERAL_CURRENT_MIRRORS_V1','rows':mirrors}))
    source_provenance = physical[('history', command_logical)]
    history_recipes = {'kind':'SOURCE_BOUND_HISTORICAL_INPUT_RECIPES_NO_AMBIENT_READ_MAP_PERMISSION',
                      'perId':{key:{'paths':[contract['oldGuardLogical']] if key!='freeze-after-scratch' else [item['declared']['path']for item,declaration in history],
                                    'sourcePins':[source_provenance]}for key in HISTORY_IDS},'sourceRecipeProvenance':{'scope':'PUBLIC_SYNTHETIC_ONLY'}}
    history_pin = put(phase/'input-data/history.json',encoded(history_recipes))
    parser_pin, _ = Reader().read(str(W/'source/ast_parser.mjs'),8388608)
    parser_mat = {k:v for k,v in parser_pin.items()if k!='EOF'}
    source_pins = []
    mirror_bylogical = {row['logicalSource']:row['currentMirror']for row in mirrors}
    extra_bylogical = {row['logicalSource']:row['freshPhysicalSource']for row in extras}
    for logical in producer_calls:
        materializer = mirror_bylogical.get(logical,extra_bylogical.get(logical))
        source_pins.append({'path':materializer['path'],'bytes':materializer['bytes'],'sha256':materializer['sha256'],'identity':materializer['PRE']})
    ast_request = put(phase/'input-data/ast-source-request.json',encoded({'sources':source_pins,'parser':parser_mat}))
    # Draft fixture pins carry no current AST authority. The first actual parser
    # execution happens after every physical fixture writer closes, below.
    facts = {'schema':'DRAFT_PUBLIC_AST_NOT_AUTHORITY','parser':parser_mat,
             'sources':[{'source':pin,'fullEOF':False,'calls':[],'imports':[]}for pin in source_pins]}
    facts_pin = put(phase/'input-data/ast-facts.json',encoded(facts))
    limits = {'maxSourceBytes':8388608,'metadataRecordBytes':16384,'maxLedgerBytes':67108864,'outputFileBytes':536870912,'allOutputBytes':7516192768,
              'admittedFiles':24,'admittedDirectories':2,'admittedBytes':268435456,'admittedInodes':26}
    request = {'schema':'C8_CURRENT_CANONICAL_INPUT_REQUEST_V1','scope':'PUBLIC_SYNTHETIC_SOURCE_CONTROL','phaseRoot':str(phase),
               'outputRoot':str(phase/'generated-inputs'),'cohorts':specs,'aliases':aliases_pin,'transforms':transforms_pin,'astFacts':facts_pin,
               'commandContract':source_provenance,'historyRecipes':history_pin,'selectorExtras':extras,'limits':limits}
    contract['syntheticCounts'] = counts
    owner = PublicSyntheticOwner(); owner.transform_hash = transforms_pin['sha256']; owner.parser_hash = parser_pin['sha256']
    return request, contract, owner, {'alias_doc':alias_doc,'facts':facts,'history_recipes':history_recipes,'mirrors':mirrors}


def assert_outcome(name, function):
    started = time.monotonic()
    try:
        result = function()
        RESULTS.append({'name':name,'status':'PASS','observed':result,'elapsedSeconds':time.monotonic()-started})
    except BaseException as error:
        RESULTS.append({'name':name,'status':'FAIL','type':type(error).__name__,'message':str(error),'elapsedSeconds':time.monotonic()-started})
        raise


def prospective_fixture_baseline(root, request, contract, owner):
    """A new baseline only in a new control run; failed run1/run2 stay untouched.

    Draft put() observations are explicitly preserved without custody authority.
    Actual source bytes are reopened/full-hashed after setup writers close; new
    metadata basenames and a fresh AST execution bind those current observations.
    """
    put(root/'draft-request-not-authority.json',encoded(request))
    stage=root/'prospective-current-baseline-1';stage.mkdir(mode=0o700)
    time.sleep(0.4)
    reader=Reader(); changes={}; capture_reads=0
    def fresh(old):
        nonlocal capture_reads
        row,_=reader.read(old['path'],67108864)
        current={k:v for k,v in row.items()if k!='EOF'}
        capture_reads+=1
        if old['path'] in changes:
            assert changes[old['path']]['draft']==old and changes[old['path']]['freshCurrent']==current, 'REPEATED_DRAFT_REFERENCE_DRIFT'
        else: changes[old['path']]={'draft':old,'freshCurrent':current,'draftPhysicalAuthority':'NONE'}
        assert current['sha256']==old['sha256'] and current['bytes']==old['bytes'], 'DRAFT_CONTENT_CHANGED'
        return current
    ledger_values={}; declarations={}; receipt_values={}; paths={}
    for phase,spec in request['cohorts'].items():
        rows=[strict_json(line)for line in Path(spec['ledger']['path']).read_bytes().splitlines()]
        for item in rows:
            if 'freshPhysicalSource'in item:item['freshPhysicalSource']=fresh(item['freshPhysicalSource'])
            else:
                logical=item['declared']['path'];path=Path(request['phaseRoot'])/'cohorts'/phase/logical
                item['PRE']=item['POST']=item['pathPOST']=ident(os.lstat(path))
            before=item['beforeByteBacking'];bare={k:v for k,v in before.items()if k!='encoding'}
            item['beforeByteBacking']=fresh(bare) | ({'encoding':before['encoding']}if 'encoding'in before else {})
        ledger_values[phase]=rows
        paths[(phase,'ledger')]=stage/(phase+'-source-rows.jsonl')
        paths[(phase,'declarations')]=stage/(phase+'-declarations.jsonl')
        put(paths[(phase,'ledger')],b''.join(encoded(row)for row in rows))
        put(paths[(phase,'declarations')],Path(spec['declarations']['path']).read_bytes())
        receipt_values[phase]=strict_json(Path(spec['receipt']['path']).read_bytes())
    time.sleep(0.4)
    new=copy.deepcopy(request)
    for phase in request['cohorts']:
        for name in ('ledger','declarations'):
            pin,_=reader.read(str(paths[(phase,name)]),67108864);new['cohorts'][phase][name]={k:v for k,v in pin.items()if k!='EOF'}
        receipt_values[phase]['ledger']=new['cohorts'][phase]['ledger']
        put(stage/(phase+'-receipt.json'),encoded(receipt_values[phase]))
    alias_doc=strict_json(Path(request['aliases']['path']).read_bytes())
    for row in alias_doc['directories']:row['identity']=ident(os.lstat(row['path']))
    for row in alias_doc['links']:row['identity']=ident(os.lstat(row['path']))
    transform=strict_json(Path(request['transforms']['path']).read_bytes())
    for item in transform['rows']:
        item['currentMirror']=fresh(item['currentMirror']);before=item['beforeByteBacking'];item['beforeByteBacking']=fresh({k:v for k,v in before.items()if k!='encoding'})|{'encoding':'RAW_EXACT_PREIMAGE'}
    history=strict_json(Path(request['historyRecipes']['path']).read_bytes())
    for item in history['perId'].values():item['sourcePins']=[fresh(pin)for pin in item['sourcePins']]
    new['commandContract']=fresh(request['commandContract'])
    for item in new['selectorExtras']:
        item['freshPhysicalSource']=fresh(item['freshPhysicalSource']);before=item['beforeByteBacking'];item['beforeByteBacking']=fresh({k:v for k,v in before.items()if k!='encoding'})|{'encoding':'RAW_EXACT_PREIMAGE'}
    for name,value in [('aliases',alias_doc),('transforms',transform),('historyRecipes',history)]:put(stage/(name+'.json'),encoded(value))
    old_facts=strict_json(Path(request['astFacts']['path']).read_bytes())
    pins=[]
    for fact in old_facts['sources']:
        old=fact['source'];pin,_=reader.read(old['path'],8388608);assert pin['sha256']==old['sha256'];pins.append(consumer_pin(pin))
    parser,_=reader.read(str(W/'source/ast_parser.mjs'),8388608);parser={k:v for k,v in parser.items()if k!='EOF'}
    args=put(stage/'ast-request.json',encoded({'sources':pins,'parser':parser}))
    script="import fs from'node:fs';import{deriveASTFacts}from"+json.dumps((W/'source/ast_parser.mjs').as_uri())+";const x=JSON.parse(fs.readFileSync(process.argv[1]));console.log(JSON.stringify(deriveASTFacts(x.sources,x.parser,process.argv[2])));"
    facts=run_node(script,[args['path'],TS],stage/'actual-current-ast.stdout')
    put(stage/'astFacts.json',encoded(facts))
    time.sleep(0.4)
    for phase in request['cohorts']:
        pin,_=reader.read(str(stage/(phase+'-receipt.json')),67108864);new['cohorts'][phase]['receipt']={k:v for k,v in pin.items()if k!='EOF'}
    for name in ('aliases','transforms','historyRecipes','astFacts'):
        pin,_=reader.read(str(stage/(name+'.json')),67108864);new[name]={k:v for k,v in pin.items()if k!='EOF'}
    owner.transform_hash=new['transforms']['sha256'];owner.parser_hash=parser['sha256']
    put(stage/'draft-to-prospective-observations.json',encoded({'scope':'PUBLIC_SYNTHETIC_FRESH_BASELINE_ONLY','drafts':list(changes.values()),'captureReads':capture_reads,'uniquePaths':len(changes),'priorFailedRuns':'UNTOUCHED_NOT_ADOPTED'}))
    put(stage/'current-request.json',encoded(new))
    reader.final()
    return new, {'alias_doc':alias_doc,'facts':facts,'history_recipes':history,'mirrors':transform['rows']}


def main():
    global SETTLE_NEW_METADATA
    run = W/'controls'/(sys.argv[1] if len(sys.argv)==2 else 'run1'); run.mkdir(mode=0o700)
    strategy=os.environ.get('C8_PUBLIC_CONTROL_SETUP','REUSE_RETAINED_MAC')
    if strategy=='FRESH_PUBLIC_LINUX':
        assert sys.platform=='linux' and run.is_relative_to(W/'controls'), 'PUBLIC_LINUX_CONTROL_ONLY'
        SETTLE_NEW_METADATA=False
        request,contract,owner,_=build(run/'fixture')
        (run/'healthy').mkdir(mode=0o700)
    elif strategy=='REUSE_RETAINED_MAC':
        # Do not regenerate the retained writer-closed public population.
        retained=W/'controls/run4/healthy'
        request=strict_json((retained/'draft-request-not-authority.json').read_bytes())
        contract=strict_json((W/'source/reference-contract.json').read_bytes())
        for phase in ('original','comparison'):
            for line in Path(request['cohorts'][phase]['ledger']['path']).read_bytes().splitlines():
                row=strict_json(line)['declared'];spec=contract['sources'][row['path']]
                spec['originalSHA256' if phase=='original' else 'comparisonSHA256']=row['sha256']
                spec['originalBytes' if phase=='original' else 'comparisonBytes']=row['bytes']
        command=strict_json(Path(request['commandContract']['path']).read_bytes());contract['commandCanonicalSHA256']=H(encoded(command))
        contract['syntheticCounts']={}
        for phase,spec in request['cohorts'].items():
            rows=[strict_json(line)for line in Path(spec['ledger']['path']).read_bytes().splitlines()]
            contract['syntheticCounts'][phase]=[len(rows),sum(row['declared']['bytes']for row in rows if 'freshPhysicalSource'in row),sum('freshPhysicalSource'not in row for row in rows)]
        owner=PublicSyntheticOwner();(run/'healthy').mkdir(mode=0o700)
        request['outputRoot']=str(run/'healthy/generated-inputs');request['publicControlOutputRoot']=request['outputRoot']
        request['limits'].update(admittedDirectories=3,admittedInodes=27)
    else: raise Hold('UNKNOWN_PUBLIC_CONTROL_SETUP')
    SETTLE_NEW_METADATA=(sys.platform!='linux')
    request['outputRoot']=str(run/'healthy/generated-inputs');request['publicControlOutputRoot']=request['outputRoot']
    request['limits'].update(admittedDirectories=3,admittedInodes=27)
    request,fixtures=prospective_fixture_baseline(run/'healthy',request,contract,owner)
    result = produce_public_control(request,contract,owner,W/'controls',lambda:time.sleep(0.4)if sys.platform!='linux'else None)
    prepared = strict_json(Path(result['outputs']['candidate/prepared-source-inputs.json']['path']).read_bytes())
    rules = strict_json(Path(result['outputs']['candidate/finite-producer-rules.json']['path']).read_bytes())
    assert_outcome('actual-seven-output-roundtrip',lambda: {'paths':len(result['paths']),'refs':len(prepared['files']),'ids':len(rules['perId']),'selectors':sum(len(r['calls'])for r in rules['perId'].values())} if len(result['paths'])==24 and len(prepared['files'])==7 and len(rules['perId'])==124 and sum(len(r['calls'])for r in rules['perId'].values())==246 else (_ for _ in ()).throw(AssertionError('WRONG_COMPLETE_MEMBERSHIP')))
    assert_outcome('topological-self-exclusion',lambda: True if all(row['path']!=result['outputs']['candidate/prepared-source-inputs.json']['path']for row in prepared['files']) and prepared['files'][3]['path']==request['commandContract']['path'] else (_ for _ in ()).throw(AssertionError('CIRCULAR_OR_LOST_CONTRACT')))
    def gzip_backings():
        import gzip
        for pin in prepared['files']:
            backing=pin['beforeByteBacking']; raw=gzip.decompress(Path(backing['path']).read_bytes())
            assert len(raw)==pin['bytes'] and H(raw)==pin['sha256'] and backing['encoding']=='GZIP_EXACT_PREIMAGE'
        return {'exactBackings':7}
    assert_outcome('all-seven-prepared-gzip-backings',gzip_backings)
    # Execute the literal consumer module against the actual generated bytes; no old consumer imported.
    wire_request = put(run/'healthy/wiring-request.json',encoded({'root':request['phaseRoot'],'outputRoot':request['outputRoot'],'receipt':result['receipt'],'contract':contract,'facts':request['astFacts']['path']}))
    script = "import fs from'node:fs';import{loadPublicControlInputs,wireRegistry,wireComposition}from"+json.dumps((W/'source/consumer_wiring.mjs').as_uri())+";const x=JSON.parse(fs.readFileSync(process.argv[1]));const i=loadPublicControlInputs(x.root,x.receipt,x.outputRoot,x.contract),n=i.data['candidate/mirror-source-transform-map.json'].inputs[0];const p={path:n.source,bytes:n.bytes,sha256:n.sha256,identity:n.sourceIdentity};const r=wireRegistry(i,x.contract,p);let held=false;try{r.dispatch()}catch(e){held=e.message==='ALL_122_EXECUTION_HELD'}const own=JSON.parse(fs.readFileSync(x.facts)).sources.filter(v=>v.source.path.startsWith(x.root+'/candidate/')).map(v=>v.source);const c=wireComposition(i,r.descriptors[0],own,p);console.log(JSON.stringify({ids:r.descriptors.length,held,toolRows:c.toolClosure.length,closure:c.closure.length,argv:r.descriptors[0].argv,scope:i.scope}));"
    observed = run_node(script,[wire_request['path']],run/'healthy/wiring-actual.stdout')
    assert_outcome('literal-registry-and-composition-wiring',lambda:observed if observed['ids']==122 and observed['held'] and observed['toolRows']==3 and observed['scope']=='PUBLIC_SYNTHETIC_SOURCE_CONTROL' else (_ for _ in ()).throw(AssertionError('WIRING_INCOMPLETE')))
    consumer_script = "import fs from'node:fs';import{strictJSON,shape,validateOutput}from"+json.dumps((W/'source/consumer_schema.mjs').as_uri())+";import{loadPublicControlInputs,wireRegistry,wireComposition}from"+json.dumps((W/'source/consumer_wiring.mjs').as_uri())+";const x=JSON.parse(fs.readFileSync(process.argv[1])),out=[];const deny=(name,f,expected)=>{try{f()}catch(e){if(!e.message.includes(expected))throw e;out.push({name,status:'PASS',denied:e.message});return}throw Error('ADVERSE_CONSUMER_ACCEPTED:'+name)};deny('consumer-duplicate-key',()=>strictJSON(Buffer.from('{\"scope\":\"PASS\",\"scope\":\"UNKNOWN\"}')),'DUPLICATE');deny('consumer-partial-json',()=>strictJSON(Buffer.from('{\"scope\":')),'JSON');deny('consumer-unsafe-integer',()=>strictJSON(Buffer.from('9007199254740993')),'UNSAFE');deny('consumer-unsafe-decimal-integer',()=>strictJSON(Buffer.from('9007199254740993.0')),'UNSAFE');deny('consumer-unsafe-exponent-integer',()=>strictJSON(Buffer.from('9.007199254740993e15')),'UNSAFE');deny('consumer-unsafe-large-exponent',()=>strictJSON(Buffer.from('1e20')),'UNSAFE');deny('consumer-unknown-field',()=>shape({scope:'PUBLIC',UNKNOWN:true},['scope']),'SCHEMA');const i=loadPublicControlInputs(x.root,x.receipt,x.outputRoot,x.contract),n=i.data['candidate/mirror-source-transform-map.json'].inputs[0],p={path:n.source,bytes:n.bytes,sha256:n.sha256,identity:n.sourceIdentity};const r=wireRegistry(i,x.contract,p),own=JSON.parse(fs.readFileSync(x.facts)).sources.filter(v=>v.source.path.startsWith(x.root+'/candidate/')).map(v=>v.source);deny('consumer-conflicting-closure-pin',()=>wireComposition(i,r.descriptors[0],own,{...p,sha256:'f'.repeat(64)}),'INCONSISTENT_DUPLICATE');deny('consumer-partial-adapter-membership',()=>wireComposition(i,r.descriptors[0],own.slice(1),p),'COMPLETE_CURRENT_ADAPTER');deny('consumer-unknown-prepared-field',()=>validateOutput('candidate/prepared-source-inputs.json',{...i.data['candidate/prepared-source-inputs.json'],UNKNOWN:true},x.root,x.contract.originalIds,x.outputRoot,true),'SCHEMA');console.log(JSON.stringify(out));"
    consumer_results=run_node(consumer_script,[wire_request['path']],run/'healthy/consumer-adverse.stdout')
    for row in consumer_results: assert_outcome(row['name'],lambda row=row:row)
    bad_request,bad_contract,bad_owner,bad_fixtures=copy.deepcopy(request),copy.deepcopy(contract),copy.copy(owner),copy.deepcopy(fixtures)
    root=run/'negatives';root.mkdir(mode=0o700);cases=root/'cases'; cases.mkdir(mode=0o700)
    bad_request['outputRoot']=str(root/'generated-inputs');bad_request['publicControlOutputRoot']=bad_request['outputRoot']
    def negative(name, mutate, expected):
        def execute():
            r,c,o = copy.deepcopy(bad_request),copy.deepcopy(bad_contract),copy.copy(bad_owner)
            mutate(r,c,o)
            try: produce_public_control(r,c,o,W/'controls')
            except (Hold, FileNotFoundError, ValueError) as error:
                assert expected in str(error),(name,str(error),expected)
                assert not Path(r['outputRoot']).exists(), 'FAILED_VALIDATION_WROTE_OUTPUT'
                return {'denied':str(error),'outputCreated':False}
            raise AssertionError('ADVERSE_INPUT_ACCEPTED')
        assert_outcome(name,execute)
    def replace_json(r,name,value,label): r[name]=put(cases/(label+'.json'),encoded(value))
    negative('unknown-request-field-before-write',lambda r,c,o:r.update(UNKNOWN=True),'STRICT_SCHEMA_UNKNOWN')
    negative('missing-input-before-write',lambda r,c,o:r.pop('historyRecipes'),'STRICT_SCHEMA_UNKNOWN')
    negative('expired-or-unknown-physical-receipt',lambda r,c,o: r['cohorts']['history'].update(receipt=put(cases/'receipt-unknown.json',encoded(strict_json(Path(r['cohorts']['history']['receipt']['path']).read_bytes())|{'status':'UNKNOWN'}))),'COMPLETE_CURRENT_PHYSICAL_RECEIPT')
    negative('wrong-current-owner-binding',lambda r,c,o:setattr(o,'binding_hash','f'*64),'CURRENT_PHYSICAL_OWNER_BINDING')
    negative('whole-node-modules-alias-denied',lambda r,c,o:replace_json(r,'aliases',bad_fixtures['alias_doc']|{'wholeNodeModulesAlias':True},'whole-alias'),'WHOLE_NODE_MODULES_ALIAS')
    negative('missing-seventh-package-alias',lambda r,c,o:replace_json(r,'aliases',bad_fixtures['alias_doc']|{'links':bad_fixtures['alias_doc']['links'][:-1]},'six-aliases'),'SEVEN_ALIAS_EXACT_ORDER')
    doc=copy.deepcopy(bad_fixtures['alias_doc']);doc['links'][0]['target']=doc['links'][0]['target']+'/UNKNOWN'
    negative('literal-target-collision-denied',lambda r,c,o:replace_json(r,'aliases',doc,'wrong-target'),'EXACT_LITERAL_PACKAGE_ALIAS_DESTINATION')
    negative('insufficient-extra-file-admission',lambda r,c,o:r['limits'].update(admittedFiles=23),'EXPLICIT_PRODUCER_ADMISSION_DELTA')
    negative('output-root-directory-not-admitted',lambda r,c,o:r['limits'].update(admittedDirectories=2),'EXPLICIT_PRODUCER_ADMISSION_DELTA')
    negative('output-root-inode-not-admitted',lambda r,c,o:r['limits'].update(admittedInodes=26),'EXPLICIT_PRODUCER_ADMISSION_DELTA')
    negative('insufficient-byte-admission',lambda r,c,o:r['limits'].update(admittedBytes=1),'PRODUCER_BYTE_ADMISSION_DELTA')
    negative('output-byte-bound-before-write',lambda r,c,o:r['limits'].update(outputFileBytes=10),'OUTPUT_FILE_BOUND_BEFORE_ANY_WRITE')
    negative('original-command-argv-drift',lambda r,c,o:c.update(commandCanonicalSHA256='f'*64),'ALL_ORIGINAL_COMMAND_FIELDS')
    facts=copy.deepcopy(bad_fixtures['facts']);facts['sources'][0]['calls'][0]['columnStart']+=1
    negative('utf16-coordinate-drift-denied',lambda r,c,o:replace_json(r,'astFacts',facts,'bad-utf16'),'ACTUAL_CURRENT_UTF16_TOKEN_SPAN')
    facts=copy.deepcopy(bad_fixtures['facts']);facts['sources']=facts['sources'][:-1]
    negative('partial-current-ast-producer-set',lambda r,c,o:replace_json(r,'astFacts',facts,'missing-ast'),'COMPLETE_CURRENT_AST_PRODUCER_MEMBERSHIP')
    facts=copy.deepcopy(bad_fixtures['facts']);facts['sources'].append(facts['sources'][0])
    negative('duplicate-current-ast-source',lambda r,c,o:replace_json(r,'astFacts',facts,'duplicate-ast'),'AST_SOURCE_FINITE_CURRENT_MEMBERSHIP')
    negative('unknown-finite-selector',lambda r,c,o:c['recipes'][c['originalIds'][0]]['calls'][0]['sourceLogicalPaths'].append('/UNKNOWN'),'UNKNOWN_FINITE_SELECTOR_SOURCE')
    history=copy.deepcopy(bad_fixtures['history_recipes']);history['perId']['freeze-after-scratch']['paths']=history['perId']['freeze-after-scratch']['paths'][:-1]
    negative('partial-whole-history-denied',lambda r,c,o:replace_json(r,'historyRecipes',history,'partial-history'),'FULL_70020_HISTORY_FREEZE_MEMBERSHIP')
    history=copy.deepcopy(bad_fixtures['history_recipes']);history['perId']['freeze-after-scratch']['paths'].append(history['perId']['freeze-after-scratch']['paths'][0])
    negative('duplicate-history-recipe-member',lambda r,c,o:replace_json(r,'historyRecipes',history,'duplicate-history'),'DUPLICATE_HISTORY_RECIPE_MEMBER')
    transform=copy.deepcopy({'schema':'C8_LITERAL_CURRENT_MIRRORS_V1','rows':bad_fixtures['mirrors']});transform['rows'][0]['changes']=[{'from':'NO_EVALUATION','to':'WEAKENED','occurrences':1,'kind':'EXACT_LITERAL_NAMESPACE_SUBSTITUTION'}]
    def bad_transform(r,c,o):
        replace_json(r,'transforms',transform,'semantic-change');o.transform_hash=r['transforms']['sha256']
    negative('unapproved-semantic-transform-denied',bad_transform,'UNAPPROVED_SOURCE_SEMANTIC_TRANSFORM')
    def partial_ledger(r,c,o):
        source=r['cohorts']['original']['ledger']; raw=Path(source['path']).read_bytes().rstrip(b'\n');r['cohorts']['original']['ledger']=put(cases/'partial.jsonl',raw)
        receipt=strict_json(Path(r['cohorts']['original']['receipt']['path']).read_bytes());receipt['ledger']=r['cohorts']['original']['ledger'];r['cohorts']['original']['receipt']=put(cases/'partial-receipt.json',encoded(receipt))
    negative('partial-ledger-eof-denied',partial_ledger,'PARTIAL_LEDGER_EOF')
    def duplicate_row(r,c,o):
        raw=Path(r['cohorts']['original']['ledger']['path']).read_bytes();r['cohorts']['original']['ledger']=put(cases/'duplicate.jsonl',raw+raw.splitlines(keepends=True)[0])
        receipt=strict_json(Path(r['cohorts']['original']['receipt']['path']).read_bytes());receipt['ledger']=r['cohorts']['original']['ledger'];r['cohorts']['original']['receipt']=put(cases/'duplicate-receipt.json',encoded(receipt))
    negative('duplicate-physical-ledger-row-denied',duplicate_row,'EXACT_COMPLETE_COHORT_ROW_MEMBERSHIP')
    negative('current-source-stat-pin-drift',lambda r,c,o:r['selectorExtras'][0]['freshPhysicalSource']['PRE']['fields'].update(ctime_ns='1'),'MATERIALIZER_CURRENT_NINE')
    def no_native():
        try: produce_current(bad_request,bad_contract,bad_owner)
        except Hold as e: assert str(e)=='NO_SYNTHETIC_NATIVE_AUTHORITY';return {'nativeAuthority':False}
        raise AssertionError('SYNTHETIC_RELEASED_NATIVE')
    assert_outcome('synthetic-cannot-authorize-native',no_native)
    def duplicate_json():
        try: strict_json(b'{"status":"PASS","status":"UNKNOWN"}')
        except Hold as e: assert str(e)=='DUPLICATE_JSON_KEY';return {'duplicateKeyDenied':True}
        raise AssertionError('DUPLICATE_JSON_ACCEPTED')
    assert_outcome('duplicate-json-key-denied',duplicate_json)
    for token in (b'1e309',b'-1e309'):
        def nonfinite(token=token):
            try:strict_json(token)
            except Hold as e:
                assert str(e)=='NONFINITE_JSON';return {'token':token.decode(),'nonfiniteExponentDenied':True}
            raise AssertionError('NONFINITE_EXPONENT_ACCEPTED')
        assert_outcome('python-nonfinite-exponent-'+token.decode(),nonfinite)
    def output_collision():
        phase=root/'collision-phase';phase.mkdir(mode=0o700);out=phase/'generated-inputs';out.mkdir(mode=0o700);put(out/'foreign-marker',b'PRESERVE')
        r=copy.deepcopy(bad_request);r.update(phaseRoot=str(phase),outputRoot=str(out),publicControlOutputRoot=str(out))
        try: produce_public_control(r,bad_contract,bad_owner,W/'controls')
        except Hold as e: assert 'OUTPUT_NAMESPACE_COLLISION'in str(e);assert (out/'foreign-marker').read_bytes()==b'PRESERVE';return {'foreignMarkerPreserved':True}
        raise AssertionError('COLLISION_ACCEPTED')
    assert_outcome('output-collision-before-input-read',output_collision)
    def physical_drift():
        path=cases/'actual-drift.txt';pin=put(path,b'BEFORE')
        changed=False
        def seam(p,n):
            nonlocal changed
            if not changed:
                changed=True
                with open(path,'ab')as writer:writer.write(b'AFTER');writer.flush();os.fsync(writer.fileno())
        try: Reader(read_seam=seam).read(str(path),100)
        except Hold as e: assert 'SOURCE_FULL_EOF_NINE_DRIFT'in str(e);return {'actualByteDriftDenied':True,'partialBytesRetained':path.read_text()}
        raise AssertionError('READ_DRIFT_ACCEPTED')
    assert_outcome('actual-held-read-identity-and-byte-drift',physical_drift)
    prepared_plan=Prepared(bad_request,bad_contract,bad_owner,synthetic=True).prepare()
    assert_outcome('exact-finite-output-demand',lambda:prepared_plan.demand if prepared_plan.demand['fileCount']==24 and prepared_plan.demand['directoryCount']==3 and set(prepared_plan.demand['files'])==set(prepared_plan.demand['perFileSerializedUpperBytes']) else (_ for _ in ()).throw(AssertionError('INCOMPLETE_DEMAND')))
    def late_link_control(name, target_bytes):
        def execute():
            case=cases/name;case.mkdir(mode=0o700);p=case/'literal-alias';os.symlink(os.fsdecode(target_bytes),p)
            snap=ident(os.lstat(p));gate=Prepared(bad_request,bad_contract,bad_owner,synthetic=True)
            gate.read_literal_link(str(p),target_bytes,snap)
            p.unlink();os.symlink('FOREIGN_LATE_TARGET',p)
            try:gate.source_fence()
            except Hold as e:
                assert 'CURRENT_LITERAL_LINK_PIN' in str(e) or 'LITERAL_BYTES_OR_NINE_DRIFT' in str(e)
                return {'lateLiteralChangeDenied':True,'originalPin':snap,'actualLiteral':os.readlink(p),'outputCreated':False}
            raise AssertionError('LATE_LITERAL_CHANGE_ACCEPTED')
        assert_outcome(name,execute)
    late_link_control('late-relative-full8-link-change',b'public-member')
    late_link_control('late-absolute-package-alias-change',os.fsencode(str(cases/'literal-package-target')))
    def late_directory_control():
        p=cases/'late-directory';p.mkdir(mode=0o700);gate=Prepared(bad_request,bad_contract,bad_owner,synthetic=True)
        gate.remember_directory(str(p));original=copy.deepcopy(gate.literal_directories[str(p)])
        put(p/'FOREIGN_LATE_MEMBER',b'PUBLIC')
        try:gate.source_fence()
        except Hold as e:
            assert str(e)=='LATE_CURRENT_DIRECTORY_NINE_OR_MEMBERSHIP_DRIFT'
            return {'lateDirectoryChangeDenied':True,'original':original,'actualMembers':os.listdir(p),'outputCreated':False}
        raise AssertionError('LATE_DIRECTORY_MEMBER_ACCEPTED')
    assert_outcome('late-package-directory-membership-change',late_directory_control)
    def full_prepare_late_alias():
        gate=Prepared(bad_request,bad_contract,bad_owner,synthetic=True).prepare()
        alias=Path(bad_fixtures['alias_doc']['links'][0]['path']);before=ident(os.lstat(alias))
        alias.unlink();os.symlink('PUBLIC_LATE_REPLACEMENT',alias)
        try:gate.publish()
        except Hold as e:
            assert 'CURRENT_LITERAL_LINK_PIN' in str(e) or 'LITERAL_BYTES_OR_NINE_DRIFT' in str(e)
            assert not Path(bad_request['outputRoot']).exists()
            return {'completePreparedPipelineDeniedBeforePublication':True,'originalPin':before,'outputCreated':False}
        raise AssertionError('LATE_ALIAS_PUBLICATION_ACCEPTED')
    assert_outcome('complete-prepare-late-alias-before-any-publication',full_prepare_late_alias)
    (run/'results.json').write_bytes(encoded({'scope':'PUBLIC_SYNTHETIC_SOURCE_CONTROLS_ONLY','node':NODE,'typescriptParserOnly':TS,'python':sys.version,
        'controls':RESULTS,'count':len(RESULTS),'nativeClaims':False,'original122':'HELD','ROOT':'ABSENT','whole120':'HELD','ownerChecksSynthetic':owner.checks}))
    print(json.dumps({'status':'PASS_PUBLIC_SYNTHETIC_SOURCE_CONTROLS_ONLY','controls':len(RESULTS),'results':str(run/'results.json'),'healthyOutputBytes':result['actualOutputBytes']}))


if __name__=='__main__':
    try: main()
    except BaseException as error:
        target=W/'controls'/(sys.argv[1] if len(sys.argv)==2 else 'run1')/'partial-results.json'
        if target.parent.exists() and not target.exists(): target.write_bytes(encoded({'scope':'FAILED_PUBLIC_SYNTHETIC_CONTROL_RUN','controls':RESULTS,'original122':'HELD','failure':{'type':type(error).__name__,'message':str(error),'evidence':getattr(error,'evidence',None)}}))
        raise
