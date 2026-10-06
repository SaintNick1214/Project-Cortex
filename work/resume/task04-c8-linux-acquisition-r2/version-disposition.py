"""Read finite original source and prospective copies; never evaluate subjects."""
import json, os, re, sys
from pathlib import Path
sys.path.insert(0, '/repair/finish-tools')
from acquire_lib import held, read_json
root = Path('/repair')
out = root/'version-disposition'
if len(sys.argv) != 1 or out.exists():
    raise ValueError('EXCLUSIVE_VERSION_DISPOSITION_SOURCE_INSPECTION')
maximum=Path('/sys/fs/cgroup/memory.max').read_text().strip()
current=Path('/sys/fs/cgroup/memory.current').read_text().strip()
if not maximum.isdecimal() or not current.isdecimal() or int(maximum)-int(current)<134217728:
    raise ValueError('FRESH_RESOURCE_HOLD')
toolPRE=held(Path(__file__),lambda _:None)
interpreterPRE=held(Path(sys.executable).resolve(),lambda _:None)
contract, contractProof=read_json(root/'attempt2/report/acquisition-contract.json')
objects, objectProof=read_json(root/'attempt2/report/selected-object-baselines.json')
objects={r['sha256']:r for r in objects['objects']}
sourceProofs=[]
matches=[]
count=0
patterns={
 'exact24.19':r'24\.19\.0',
 'versionFieldOrNodeVersion':r'\.versions|[\"\']versions[\"\']|[Nn]ode[Vv]ersion',
 'versionProperty':r'\.version\b|[\"\']version[\"\']',
 'toolchainMetadataRead':r'toolchain-evidence|parentDeclaredToolchain|QA_DECLARED_TOOLCHAIN|QA_TOOLCHAIN_DRIFT',
}
compiled={key:re.compile(pattern) for key,pattern in patterns.items()}
def inspect(path,body,proof,tier):
    global count
    count+=1
    sourceProofs.append({'originalPath':path,'sourceTier':tier,'heldRead':proof})
    for number,line in enumerate(body.decode().splitlines(),1):
        kinds=[key for key,pattern in compiled.items() if pattern.search(line)]
        if kinds:
            matches.append({'path':path,'sourceTier':tier,'line':number,'kinds':kinds,'text':line})
for path,row in sorted(contract['logicalOriginalInputs'].items()):
    if not path.endswith(('.mjs','.cjs','.js','.ts','.tsx')):
        continue
    record=objects[row['sha256']]
    chunks=[]
    proof=held(Path(record['path']),chunks.append)
    if proof!=record:
        raise ValueError('EXISTING_POSITIVE_OBJECT_DRIFT')
    inspect(path,b''.join(chunks),proof,'ORIGINAL_OPERATIONAL_CONTENT')
for path in sorted((root/'completion/source-aids/work/resume/task04-c8-prospective-preparation/candidate').iterdir()):
    if not path.name.endswith(('.py','.mjs','.cjs','.js','.ts','.tsx')):
        continue
    chunks=[]
    proof=held(path,chunks.append)
    inspect(str(path),b''.join(chunks),proof,'PROSPECTIVE_SOURCE_AID_NOT_EVALUATED')
originalPath='_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-extra-preparation-c5/toolchain-evidence.json'
record=objects[contract['logicalOriginalInputs'][originalPath]['sha256']]
chunks=[]
proof=held(Path(record['path']),chunks.append)
if proof!=record:
    raise ValueError('ORIGINAL_METADATA_PIN_DRIFT')
metadata=b''.join(chunks)
result={'scope':'SOURCE_INSPECTION_ONLY_NOT_RUNTIME', 'sources':count,'sourceProofs':sourceProofs,'matches':matches,'literal24.19SourceMatches':sum('exact24.19' in r['kinds'] for r in matches),'originalToolchainMetadata':{'logicalPath':originalPath,'baseline':proof,'body':json.loads(metadata)},'freshMeasuredMemoryReserveBytes':int(maximum)-int(current),'originalAssertionsModified':False,'runtimeDisposition':'PENDING_SEPARATE_SOURCE_INTERPRETATION','candidateImportedOrEvaluated':False,'ROOT':'ABSENT','toolPRE':toolPRE,'interpreterPRE':interpreterPRE}
result['toolPOST']=held(Path(__file__),lambda _:None)
result['interpreterPOST']=held(Path(sys.executable).resolve(),lambda _:None)
if result['toolPRE']!=result['toolPOST'] or result['interpreterPRE']!=result['interpreterPOST']:
    raise ValueError('SOURCE_HELPER_DRIFT')
out.mkdir(mode=0o700)
raw=(json.dumps(result,indent=2)+'\n').encode()
with open(out/'source-inspection.json','xb') as stream:
    os.chmod(stream.name,0o600);stream.write(raw);stream.flush();os.fsync(stream.fileno())
print(json.dumps({'sources':count,'matches':len(matches),'literal24.19SourceMatches':result['literal24.19SourceMatches'],'receipt':held(out/'source-inspection.json',lambda _:None)}))
