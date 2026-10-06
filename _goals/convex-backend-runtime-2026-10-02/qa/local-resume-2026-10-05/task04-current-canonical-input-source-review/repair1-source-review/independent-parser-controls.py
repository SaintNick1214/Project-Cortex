"""Own fixture AST parsing and Prepared.build_rules only; no VM or pipeline."""
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace

R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
W=R/'work/resume/task04-c8-current-canonical-input-producers/repair1'
D=Path(__file__).resolve().parent
sys.path.insert(0,str(W/'source'))
from strict_io import Hold,Reader,consumer_pin,encoded,read_materializer,strict_json
from producers import Prepared
NODE='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node'
TS=R/'node_modules/typescript/lib/typescript.js'
checks=[];errors=[]
def main():
    phase=D/'independent-parser-fixture';(phase/'candidate').mkdir(parents=True,mode=0o700);(phase/'selected').mkdir(mode=0o700)
    contract=strict_json((W/'source/reference-contract.json').read_bytes());narrow=copy.deepcopy(contract)
    narrow['recipes']={k:copy.deepcopy(contract['recipes'][k])for k in('OWN_VM_CONSUMER_CONTROL','OWN_EXTERNAL_REVIEW')};narrow['originalIds']=[];narrow['selectors']=4
    narrow['externalSelectorLogicalPaths']={x:'${PHASE_ROOT}/candidate/'+Path(x).name for x in contract['ownSelectorLogicalPaths']}
    narrow['externalSelectorLogicalPaths'][contract['oldGuardLogical']]='${PHASE_ROOT}/selected/guard'
    candidate={}
    for name,body in [('vm-consumer-controls.mjs',"const label = '🧭';\nfunction construct(source,options){return new SourceTextModule(source,options);}\nfunction run(source){return vm.runInContext(source,context);}\n"),('external-review-executor.mjs',"new SourceTextModule(source);\nrunInContext('JSON');\n")]:
        p=phase/'candidate'/name;p.write_bytes(body.encode());os.chmod(p,0o600);candidate[name]=p
    selected={}
    for i,logical in enumerate(narrow['recipes']['OWN_VM_CONSUMER_CONTROL']['calls'][0]['sourceLogicalPaths']):
        p=phase/'selected'/str(i);p.write_bytes(b'OWN_PUBLIC_SOURCE_PLACEHOLDER\n');os.chmod(p,0o600);selected[logical]=p
    guard=phase/'selected/guard';guard.write_bytes(b'OWN_PUBLIC_GUARD_PLACEHOLDER\n');os.chmod(guard,0o600)
    reader=Reader(deadline_seconds=120);pins={}
    for p in list(candidate.values())+list(selected.values())+[guard]:row,_=reader.read(str(p),65536);pins[str(p)]=consumer_pin(row)
    parser_observed,_=reader.read(str(TS),16777216);assert parser_observed['sha256']=='569177652966bd528c319171c7dd22860dbf72bde116cbc4f644f1d02bb12e39'
    parser={k:v for k,v in parser_observed.items()if k!='EOF'}
    request=D/'independent-parser-request.json';request.write_bytes(encoded({'sources':[pins[str(p)]for p in candidate.values()],'parser':parser}));os.chmod(request,0o600)
    js="import fs from'node:fs';import{deriveASTFacts}from"+json.dumps((W/'source/ast_parser.mjs').as_uri())+";const q=JSON.parse(fs.readFileSync(process.argv[1]));console.log(JSON.stringify(deriveASTFacts(q.sources,q.parser,process.argv[2])));"
    with(D/'independent-parser.stdout').open('xb')as out,(D/'independent-parser.stderr').open('xb')as err:
        child=subprocess.Popen([NODE,'--input-type=module','-e',js,str(request),str(TS)],stdout=out,stderr=err,env={'PATH':str(Path(NODE).parent)+':/usr/bin:/bin','HOME':os.environ['HOME'],'PYTHONDONTWRITEBYTECODE':'1'})
        try:code=child.wait(timeout=30)
        except BaseException:child.kill();child.wait(timeout=5);raise
    assert code==0,(code,(D/'independent-parser.stderr').read_bytes())
    facts=strict_json((D/'independent-parser.stdout').read_bytes());assert len(facts['sources'])==2 and sum(len(x['calls'])for x in facts['sources'])==4
    fp=D/'independent-parser-facts.json';fp.write_bytes(encoded(facts));os.chmod(fp,0o600);fact_row,_=reader.read(str(fp),1048576);fact_mat={k:v for k,v in fact_row.items()if k!='EOF'}
    gate=Prepared.__new__(Prepared);gate.contract=narrow;gate.reader=reader;gate.request={'astFacts':fact_mat,'limits':{'maxSourceBytes':16777216},'phaseRoot':str(phase)};gate.files=pins;gate.authority=SimpleNamespace(parser_hash=parser_observed['sha256']);gate.lineage={'inputs':[{'logicalSource':k,'destination':str(v)}for k,v in selected.items()]};gate.output_data={}
    def actual_input(pin):
        row,raw=read_materializer(reader,pin,16777216,collect=True);return strict_json(raw),row
    gate.json_input=actual_input;gate.build_rules();rules=gate.output_data['candidate/finite-producer-rules.json']['perId'];own=rules['OWN_VM_CONSUMER_CONTROL'];marked=own['calls'][1]
    assert set(rules)=={'OWN_VM_CONSUMER_CONTROL','OWN_EXTERNAL_REVIEW'}and sum(len(x['calls'])for x in rules.values())==4
    assert marked['json']is True and marked['argumentExpression']=='source' and marked['sources']==[] and own['scope']=='OWN_ONLY_NOT_REGISTRY_OR_ROOT_ID'
    assert len(own['calls'][0]['sources'])==len(selected)==6 and rules['OWN_EXTERNAL_REVIEW']['calls'][1]['argumentExpression']=="'JSON'"
    checks.append({'name':'actual-pinned-two-own-recipes-four-AST-calls','status':'PASS','recipes':2,'calls':4,'selectedSources':6,'argument':marked['argumentExpression'],'json':True,'scope':own['scope'],'original122':'HELD'})
    def adverse(name,mutate,token,mutate_contract=None):
        value=copy.deepcopy(facts);mutate(value);gate.contract=copy.deepcopy(narrow)
        if mutate_contract:mutate_contract(gate.contract)
        gate.json_input=lambda pin:(value,fact_row)
        try:gate.build_rules()
        except Hold as error:
            assert token in str(error),(name,str(error),token);checks.append({'name':name,'status':'PASS','denial':str(error)});return
        raise AssertionError('adverse accepted:'+name)
    def ownfact(x):return next(r for r in x['sources']if r['source']['path']==str(candidate['vm-consumer-controls.mjs']))
    adverse('current-UTF16-column-cannot-shift',lambda x:ownfact(x)['calls'][1].update(columnStart=1),'ACTUAL_CURRENT_UTF16_TOKEN_SPAN')
    adverse('current-fragment-SHA-cannot-drift',lambda x:ownfact(x)['calls'][1].update(callTextSHA256='f'*64),'ACTUAL_CURRENT_UTF16_TOKEN_SPAN')
    adverse('current-source-SHA-cannot-drift',lambda x:ownfact(x)['source'].update(sha256='f'*64),'AST_CURRENT_SOURCE_PIN')
    adverse('current-JSON-argument-cannot-be-literal-alias',lambda x:ownfact(x)['calls'][1].update(argumentExpression="'JSON'"),'CURRENT_AST_RECIPE_ARGUMENT_DRIFT')
    adverse('current-JSON-kind-cannot-drift',lambda x:ownfact(x)['calls'][1].update(kind='SourceTextModule'),'CURRENT_AST_RECIPE_ARGUMENT_DRIFT')
    adverse('current-producer-omission-denied',lambda x:x['sources'].pop(),'COMPLETE_CURRENT_AST_PRODUCER_MEMBERSHIP')
    adverse('current-duplicate-AST-call-denied',lambda x:ownfact(x)['calls'].append(copy.deepcopy(ownfact(x)['calls'][1])),'DUPLICATE_AST_CALL')
    adverse('selected-source-omission-denied',lambda x:None,'UNKNOWN_FINITE_SELECTOR_SOURCE',lambda c:c['recipes']['OWN_VM_CONSUMER_CONTROL']['calls'][0]['sourceLogicalPaths'].append('/UNDECLARED_SOURCE'))
    adverse('own-JSON-parent-zero-is-not-false',lambda x:None,'FINITE_SELECTOR_RECIPE_EMPTY_OR_JSON',lambda c:c['recipes']['OWN_VM_CONSUMER_CONTROL']['calls'][1].update(parent=0))
    reader.final();checks.append({'name':'all-own-fixture-reader-final-nine-fence','status':'PASS','fixtureFiles':len(pins),'fullEOF':True})
try:main()
except BaseException as error:errors.append(repr(error))
result={'scope':'INDEPENDENT_CURRENT_AST_AND_OWN_BUILD_RULES_ONLY','status':'PASS'if not errors else'FAIL','checks':checks,'count':len(checks),'errors':errors,'subjects':'NOT_IMPORTED_OR_EVALUATED','typescript':'PARSER_ONLY','actualPipelineExecuted':0,'Docker':False,'native':False,'original122':'HELD','original48':'UNEXECUTED_HELD','Task04':'OPEN','wholeGoal':'OPEN'}
with(D/'parser-controls-results.json').open('x')as f:f.write(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':result['status'],'count':len(checks),'errors':errors}));raise SystemExit(bool(errors))
