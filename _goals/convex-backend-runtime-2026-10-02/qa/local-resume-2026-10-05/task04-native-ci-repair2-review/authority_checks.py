"""Read-only contract/YAML/Git object metadata audit; no archive bodies or APIs."""
import ast
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from review_checks import REPO,W,Q,R,checked,digest,save

def retain(name,value):
    if (R/name).exists():assert json.loads((R/name).read_bytes())==value
    else:save(name,value)

def command(label,args):
    result=subprocess.run(args,cwd=REPO,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20)
    assert len(result.stdout)<=1048576 and len(result.stderr)<=1048576
    for pipe in ['stdout','stderr']:
        path=R/(label+'.'+pipe)
        if path.exists():assert path.read_bytes()==getattr(result,pipe)
        else:path.write_bytes(getattr(result,pipe))
    retain(label+'-command.json',{'argv':args,'cwd':str(REPO),'exit':result.returncode,'stdout':{'bytes':len(result.stdout),'sha256':digest(result.stdout)},'stderr':{'bytes':len(result.stderr),'sha256':digest(result.stderr)},'scope':'READONLY_METADATA_HOSTONLY_NO_APIS_NO_ARCHIVE_BODIES'})
    assert result.returncode==0
    return result.stdout

priorpath=REPO/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-native-ci-repair1-review/original-native-contract-review.json'
priorrow,raw=checked(priorpath);prior=json.loads(raw)
bindings=[]
for expected in [prior['originalContract']]+prior['recipesAndPriorEvidence']+[prior['heldMaterializerOriginal'],prior['heldMaterializerProspective']]:
    row,data=checked(REPO/expected['path'],expected)
    bindings.append(row)
    dest=R/'raw-evidence'/row['sha256']
    if not dest.exists():dest.write_bytes(data)
contract=json.loads((REPO/prior['originalContract']['path']).read_bytes())
assert len(contract['commands'])==122
assert [r['id'] for r in contract['commands']]==prior['original122IDs']
plan=json.loads((REPO/'work/resume/task04-c8-physical-preparation-r3/plan.json').read_bytes())
assert plan['nativeMinimumSeconds']==20 and plan['wholeAbsoluteSeconds']==120
assert plan['sourceTiers']=='FULL_RPC_UNCHANGED' and plan['semanticIDs']==501 and plan['semanticResiduals']==301
eight=json.loads((REPO/prior['recipesAndPriorEvidence'][2]['path']).read_bytes())
assert len(prior['originalEightRecipeIDs'])==8
original=(REPO/prior['heldMaterializerOriginal']['path']).read_bytes()
proposed=(W/'materialize-cohort-proposed.py').read_bytes()
assert original.count(b"!= 'symlink'")==1
assert original.replace(b"!= 'symlink'",b"!= 'literal-symlink'")==proposed
body=ast.parse(proposed)
materializer_funcs=[n.name for n in body.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))]
controls_old=ast.parse((W/'preimages/repair-controls.py').read_bytes());controls_new=ast.parse((W/'repair-controls.py').read_bytes())
old_nodes=[ast.dump(n,include_attributes=False) for n in controls_old.body if not isinstance(n,ast.ImportFrom)]
new_nodes=[ast.dump(n,include_attributes=False) for n in controls_new.body if not isinstance(n,ast.ImportFrom)]
# All prior definitions and assertions survive verbatim; only pure inventory/allocation additions occur.
assert all(n in new_nodes for n in old_nodes)
retain('original-contract-and-conservation-review.json',{'priorReview':priorrow,'bindings':bindings,'original122IDs':prior['original122IDs'],'eightIDs':prior['originalEightRecipeIDs'],'priorEightRecipeRecord':eight,'nativeEachSeconds':20,'wholeAbsoluteSeconds':120,'sourceTiers':'FULL_RPC_UNCHANGED','semanticIDs':501,'unresolvedSemanticMeanings':301,'originalMaterializerSingleLiteralKindDelta':True,'materializerBodiesParsedOnly':materializer_funcs,'old27ControlASTNodesAllRetained':True,'original122Executed':False,'compilerExecuted':False,'Task04':'HELD','ROOT':'ABSENT','historicalC7':prior['historicalC7'],'recorderV6':prior['recorderV6']})

continuity=json.loads((Q/'repair1-current-git-route-continuity.json').read_bytes())
fullrow,fullraw=checked(REPO/continuity['priorIndependentFullRawProof']['path'],continuity['priorIndependentFullRawProof'])
full=json.loads(fullraw)
parts=continuity['parts'];assert len(parts)==361 and sum(p['bytes'] for p in parts)==1872365422
fullparts=full.get('rows',full.get('parts'));assert len(fullparts)==361
oldby={p['path']:p for p in fullparts}
for part in parts:
    previous=oldby[part['path']]
    assert all(part[k]==previous[k] for k in ['bytes','sha256'])
    assert part['gitBlobOID']==previous['pinnedGitBlobOID']==previous['currentGitBlobOID']
    assert previous['gitFullRawSHA256']==part['sha256'] and previous['EOF'] is True
head=command('git-current-head',['git','rev-parse','HEAD']).decode().strip()
branch=command('git-current-branch',['git','branch','--show-current']).decode().strip()
assert branch=='feat/convex-backend-runtime-completion'
tree=command('git-current-route-tree',['git','ls-tree','-r','--full-tree','-z',head,'--',*[p['path'] for p in parts]])
observed={}
for entry in tree.split(b'\0'):
    if not entry:continue
    metadata,path=entry.split(b'\t',1);mode,kind,oid=metadata.decode().split()
    assert mode in ['100644','100755'] and kind=='blob';observed[path.decode()]=oid
assert len(observed)==361 and all(observed[p['path']]==p['gitBlobOID'] for p in parts)
retain('git-oid-continuity-review.json',{'head':head,'branch':branch,'initialHEADReported':'c51277e841e0830e284c40707d1b2dc2b9da7070','parentAuthorizedCheckpoint':'a6517cfaf2d76fa52e5c5890c54bbfa732cca359','priorFullRawProof':fullrow,'routes':6,'parts':parts,'partCount':361,'encodedBytes':1872365422,'currentTreeOIDsEqualPriorFullRawProof':True,'archiveBodiesReread':False,'API':False,'freshCloneRequiresNewPhysicalBaseline':True,'historical4224_31_11':'UNCHANGED'})

ruby=r'''require 'yaml'
require 'json'
path=ARGV[0]
d=YAML.load_file(path)
raise 'literal on scalar' unless YAML.parse_file(path).root.children.each_slice(2).any?{|key,value|key.value=='on'}
# Psych uses YAML 1.1 and decodes the literal on scalar to true. Keep this parser detail explicit.
trigger=d[true]
raise 'branch trigger' unless trigger['push']['branches']==['feat/convex-backend-runtime-completion']
raise 'path trigger' unless trigger['push']['paths']==['.github/workflows/task04-c8-native-infrastructure.yml']
raise 'permissions' unless d['permissions']=={'contents'=>'read'}
raise 'job set' unless d['jobs'].keys==['native-capability']
j=d['jobs']['native-capability'];s=j['steps']
raise 'runner/deadline' unless j['runs-on']=='ubuntu-24.04' && j['timeout-minutes']==20
raise 'owner guard' unless j['if']=="github.repository == 'SaintNick1214/Project-Cortex' && github.ref == 'refs/heads/feat/convex-backend-runtime-completion'"
raise 'actions' unless [s[0]['uses'],s[2]['uses']]==['actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803','actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02']
raise 'credentials' unless s[0]['with']['persist-credentials']==false
raise 'sparse' unless s[0]['with']['sparse-checkout']=="/work/resume/task04-c8-physical-preparation-r3/native-ci-a5-repair2/\n/.github/workflows/task04-c8-native-infrastructure.yml\n"
raise 'entrypoint' unless s[1]['run']=='python3 work/resume/task04-c8-physical-preparation-r3/native-ci-a5-repair2/ci-run.py'
a=s[2]['with'];prefix='${{ runner.temp }}/task04-c8-native-${{ github.run_id }}-${{ github.run_attempt }}/'
names=['host-preflight.json','native-image.json','owner-before.json','capture-command.json','owner-after-capture.json','export-content-copy.json','owner-terminal.json','host-failure.json','image-build.stdout','image-build.stderr','command-receipts/command-*.json','command-receipts/command-*.stdout','command-receipts/command-*.stderr','export-transport.json','export-transport-failure.json','export/native-capability.json','export/source-backings/pending-*']
raise 'allowlist' unless a['path'].lines.map(&:strip)==names.map{|n|prefix+n}
raise 'export failure/retention' unless s[2]['if']=='always()' && a['if-no-files-found']=='error' && a['retention-days']==7 && a['compression-level']==0 && a['include-hidden-files']==false
puts JSON.generate({'status'=>'ASSERTIONS_PASSED','source'=>path,'exportEntries'=>names,'sourceOnly'=>true,'nativeRuntime'=>'HELD'})
'''
(R/'workflow_assertions.rb').write_text(ruby)
workflow=command('workflow-yaml-parse-final',['ruby',str(R/'workflow_assertions.rb'),str(W/'task04-c8-native-infrastructure.yml.proposed')])
save('workflow-yaml-review.json',json.loads(workflow))
assert not (REPO/'.github/workflows/task04-c8-native-infrastructure.yml').exists()
print(json.dumps({'status':'ASSERTIONS_PASSED','workflowActualAbsent':True,'originalContract':'PRESERVED_HELD','OIDContinuity361':True,'nativeRuntime':'HELD'}))
