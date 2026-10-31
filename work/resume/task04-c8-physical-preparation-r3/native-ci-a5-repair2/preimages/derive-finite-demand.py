"""Read declared source metadata only. No source subjects or cohorts are executed."""
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import sys
import time

FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')
def identity(s):
    return {'schema': 'FS_IDENTITY_DECIMAL_V1', 'fields': {k: str(getattr(s, 'st_' + k)) for k in FIELDS}}

def reserve():
    maximum = Path('/sys/fs/cgroup/memory.max').read_text().strip()
    current = Path('/sys/fs/cgroup/memory.current').read_text().strip()
    if not maximum.isdecimal() or not current.isdecimal() or int(maximum)-int(current)<134217728:
        raise ValueError('LITERAL_128MIB_CGROUP_RESERVE_HOLD')
    swap=Path('/sys/fs/cgroup/memory.swap.max').read_text().strip()
    if maximum!='1073741824' or swap!='0': raise ValueError('EXACT_ONE_GIB_MATCHED_SWAP_METADATA_WINDOW')
    return {'max': maximum, 'current': current, 'swapMax':swap,'reserveBytes': int(maximum)-int(current),'memoryEvents':Path('/sys/fs/cgroup/memory.events').read_text(),'memoryStat':Path('/sys/fs/cgroup/memory.stat').read_text()}

PROOFS = []
SEAL = {}
def read_bytes(path, maximum, old=None):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = identity(os.fstat(fd)); digest = hashlib.sha256(); raw = bytearray()
        if not stat.S_ISREG(os.fstat(fd).st_mode) or int(before['fields']['nlink'])!=1:
            raise ValueError('LITERAL_REGULAR_METADATA_REQUIRED')
        while block := os.read(fd, 1048576):
            raw.extend(block); digest.update(block)
            if len(raw)>maximum: raise ValueError('FINITE_METADATA_BYTE_BOUND')
            reserve()
        after = identity(os.fstat(fd)); path_post = identity(os.lstat(path))
        if before!=after or after!=path_post: raise ValueError('HELD_METADATA_DRIFT')
        proof={'path':str(path),'bytes':len(raw),'sha256':digest.hexdigest(),'PRE':before,'POST':after,'pathPOST':path_post,'EOF':True}
        if old and any(proof[k]!=old[k] for k in ('bytes','sha256','PRE','POST','pathPOST')):
            raise ValueError('SEALED_R2_METADATA_NINE_OR_CONTENT_DRIFT')
        PROOFS.append(proof)
        return bytes(raw)
    finally:
        os.close(fd)

def sealed_json(relative, maximum=16777216):
    old=SEAL['/repair/'+relative]
    return json.loads(read_bytes(Path('/r2')/relative, maximum, old))

def history_rows():
    path=Path('/r2/attempt2/report/historical70020-coverage.json')
    old=SEAL['/repair/attempt2/report/historical70020-coverage.json']
    fd=os.open(path, os.O_RDONLY|os.O_NOFOLLOW)
    digest=hashlib.sha256(); count=0; pending=None
    try:
        before=identity(os.fstat(fd))
        with os.fdopen(os.dup(fd), 'rb') as stream:
            for line in stream:
                digest.update(line); count+=len(line)
                if count>128914214: raise ValueError('EXACT_HIST_METADATA_BOUND')
                if line==b'      "declared": {\n': pending=bytearray(b'{\n')
                elif pending is not None:
                    if line==b'      },\n':
                        pending.extend(b'}'); yield json.loads(pending); pending=None
                    else:
                        pending.extend(line)
                        if len(pending)>16384: raise ValueError('DECLARED_ROW_SIZE_HOLD')
                if count%1048576<len(line): reserve()
        after=identity(os.fstat(fd)); post=identity(os.lstat(path))
        proof={'path':str(path),'bytes':count,'sha256':digest.hexdigest(),'PRE':before,'POST':after,'pathPOST':post,'EOF':True}
        if pending is not None or before!=after or after!=post or any(proof[k]!=old[k] for k in ('bytes','sha256','PRE','POST','pathPOST')):
            raise ValueError('EXACT_SEALED_HIST_METADATA_CONTENT_NINE_EOF')
        PROOFS.append(proof)
    finally: os.close(fd)

def literal(path):
    result=path.removeprefix('/workspace/Project-Cortex/')
    parts=PurePosixPath(result).parts
    if not parts or result.startswith('/') or '..' in parts or len(parts)>64 or len(os.fsencode(result))>4096:
        raise ValueError('FINITE_LITERAL_MEMBERSHIP')
    return result

def main():
    started=time.monotonic(); pre=reserve()
    sealraw=read_bytes(Path('/r2/final-linux-packet-manifest.json'),1031477)
    if len(sealraw)!=1031477 or hashlib.sha256(sealraw).hexdigest()!='2e55621b73fed30c608559d76f215b1f5ccf8cda72857d5122acb4ea9d7f79c6':
        raise ValueError('EXACT_R2_CONTENT_SEAL')
    global SEAL
    SEAL={r['path']:r for r in json.loads(sealraw)['files']}
    repo=Path('/source-repo')
    mapfile=repo/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1/mapParts/part-00000.gzpart'
    mapraw=read_bytes(mapfile,3027090)
    if hashlib.sha256(mapraw).hexdigest()!='bdcd96a750ba26fdc85e6f259ee6457a7f8525c00f6cb0dac185f71ccbfa7c6f': raise ValueError('C4_ENCODED_HASH')
    decoded=gzip.decompress(mapraw)
    if len(decoded)!=48104635 or hashlib.sha256(decoded).hexdigest()!='719842f56e3595c163b7d89db9f91bbb9b85397d26a78c4ac8d65f23e2b42d40': raise ValueError('C4_DECODED_HASH')
    full=json.loads(decoded); del decoded,mapraw
    if len(full['files'])!=148325 or len(full['roots'])!=8: raise ValueError('ALL_EIGHT_FULL_ROOTS')
    inventory=sealed_json('attempt2/report/seven-package-source-inventory.json')
    lineage=sealed_json('input-metadata/work/resume/task04-c7-exact-identity-repair/candidate/mirror-source-transform-map.json')
    contract=sealed_json('attempt2/report/acquisition-contract.json')
    raw={}; directory_children={}; cohort_results={}; paths=set(); regular_sizes=[]; cohort_hashes={}; link_sizes=[]
    def add(cohort, row, relative=None):
        relative=literal(relative or row['path']); path='cohorts/'+cohort+'/'+relative
        if path in paths: raise ValueError('DUPLICATE_PHYSICAL_LITERAL')
        paths.add(path)
        parts=PurePosixPath(path).parts
        for i in range(1,len(parts)):
            directory_children.setdefault('/'.join(parts[:i]),set()).add(parts[i])
        item=cohort_results.setdefault(cohort,{'rows':0,'regularRows':0,'literalLinks':0,'regularBytes':0,'literalTargetBytes':0,'maxComponents':0,'maxPathBytes':0,'declaredJSONBytes':0,'blockRoundedRegularBytes':0,'membershipSHA256Builder':hashlib.sha256()})
        item['rows']+=1; item['maxComponents']=max(item['maxComponents'],len(PurePosixPath(relative).parts)); item['maxPathBytes']=max(item['maxPathBytes'],len(os.fsencode(relative)))
        item['declaredJSONBytes']+=len(json.dumps(row,separators=(',',':')).encode())+1
        link=row.get('kind')=='literal-symlink'; size=len(bytes.fromhex(row['targetHex'])) if link else row['bytes']
        if link: item['literalLinks']+=1; item['literalTargetBytes']+=size; link_sizes.append(size)
        else:
            item['regularRows']+=1; item['regularBytes']+=size; item['blockRoundedRegularBytes']+=((size+4095)//4096)*4096; regular_sizes.append(size)
        h=row['sha256']
        if h in raw and raw[h]!=size: raise ValueError('DECLARED_HASH_SIZE_CONFLICT')
        raw[h]=size
        cohort_hashes.setdefault(cohort,set()).add(h)
        item['membershipSHA256Builder'].update((json.dumps({'path':path,'sha256':h,'bytes':size,'kind':'symlink' if link else 'file'},sort_keys=True,separators=(',',':'))+'\n').encode())
    for row in full['files']: add('full8',row)
    del full
    for row in history_rows(): add('history',row)
    for row in lineage['inputs']:
        add('original',{'path':row['source'],'sha256':row['sha256'],'bytes':row['bytes']})
        add('comparison',{'path':row['source'],'sha256':row['legacyC6']['sha256'],'bytes':row['legacyC6']['bytes']})
    for p in inventory['packages']:
        for row in p['members']:
            if row['type']=='regular': add('packages',row,'node_modules/'+p['package']+'/'+row['path'].removeprefix(p['literalArchiveRoot']+'/'))
    aidrows=[]
    aidroot=Path('/r2/completion/source-aids')
    for path in sorted(aidroot.rglob('*')):
        if path.is_symlink(): raise ValueError('SOURCE_AID_LINK_NOT_DECLARED')
        if path.is_file():
            old=SEAL['/repair/'+str(path.relative_to('/r2'))]
            row={'path':str(path.relative_to(aidroot)),'bytes':old['bytes'],'sha256':old['sha256']}
            aidrows.append(row); add('source-aids',row)
    if len(aidrows)!=138 or sum(r['bytes'] for r in aidrows)!=2131210: raise ValueError('EXACT_SOURCE_AIDS')
    expected={'full8':(148325,3110990905),'history':(70020,3001521619),'original':(823,18836975),'comparison':(823,19047356),'packages':(3458,76057286),'source-aids':(138,2131210)}
    for key,(n,b) in expected.items():
        item=cohort_results[key]
        if item['rows']!=n or item['regularBytes']!=b: raise ValueError('EXACT_COMPLETE_COHORT_DEMAND:'+key)
        item['orderedMembershipSHA256']=item.pop('membershipSHA256Builder').hexdigest()
    physical_directory_count=len(directory_children)
    fixed_outputs=set()
    physical_directory_hash=hashlib.sha256(('\n'.join(sorted(directory_children))+'\n').encode()).hexdigest()
    def fixed_path(path):
        fixed_outputs.add(path)
        parts=PurePosixPath(path).parts
        for i in range(1,len(parts)):
            directory_children.setdefault('/'.join(parts[:i]),set()).add(parts[i])
    for name in ('tools','bin','bindings','home','infra','physical-receipts'):
        directory_children.setdefault(name,set())
    for name in ('node','python3.12','npm','npx'): fixed_path('bin/'+name)
    fixed_path('bindings/initialization.json')
    fixed_path('bindings/capture-failure.json')
    fixed_path('tools/capture-effective-environment.json')
    fixed_path('physical-receipts/failure.json')
    for digest in raw: fixed_path('raw-preimages/'+digest)
    for phase in ('full8','history','original','comparison','packages'):
        for name in ('source-rows.jsonl','owned-fd-advice.jsonl','source-eligibility.jsonl','receipt.json'):
            fixed_path('physical-receipts/'+phase+'/'+name)
        fixed_path('bindings/raw-positive-index-'+phase+'.json')
        if phase!='packages':
            for route in contract['routes']:
                for digest in cohort_hashes[phase].intersection(route['members']):
                    fixed_path('physical-receipts/'+phase+'/stream-'+route['name']+'/'+digest)
    for name in ('runtime-binding.json','source-release.json'):
        fixed_path('bindings/'+name)
    for name in ('package-graph.json','original-read-map.json','historical-plan-index.json','package-aliases.json','candidate/mirror-source-transform-map.json','candidate/finite-producer-rules.json','candidate/prepared-source-inputs.json'):
        fixed_path('generated-inputs/'+name)
    for name in ('acquire_lib.py','capture-binding.py','held_runtime.py','materialize-cohort-proposed.py','phase-holder.py','phase_resource.py','initialize-phase.py','plan.json','source-phase-entry.py'):
        fixed_path('tools/'+name)
    fixed_path('home/.owned-marker')
    # Finite literal directory membership replaces the preserved 64-level-per-file bound.
    # Directory byte allocation is a new enforceable preparation ceiling: per exact
    # directory one block plus rounded serialized dirents. Actual filesystem must fit.
    directory_bytes=sum(4096+((sum(((len(os.fsencode(c))+8+3)//4)*4 for c in children)+4095)//4096)*4096 for children in directory_children.values())
    raw_rounding=sum(((b+4095)//4096)*4096 for b in raw.values())
    rows=223449
    old=json.loads((repo/'work/resume/task04-c8-physical-preparation-r3/plan.json').read_text())
    physical=6226454141; aid=2131210; targets=sum(i['literalTargetBytes'] for i in cohort_results.values())
    if targets!=4474: raise ValueError('EXACT_LITERAL_TARGET_DEMAND')
    # Keep all old finite metadata/input ceilings. This is a conservative enforceable
    # allocation plan, not a claim those ceilings are realized output bytes.
    rounded=sum(i['blockRoundedRegularBytes'] for i in cohort_results.values())
    no_dedup_raw_rounding=sum(((b+4095)//4096)*4096 for b in regular_sizes)
    padding=rounded-(physical+aid)+no_dedup_raw_rounding-(physical+aid)+2*sum(((b+4095)//4096)*4096-b for b in link_sizes)
    finite_additional_file_block_padding=64*4095
    padding+=finite_additional_file_block_padding
    fixed=old['metadataAllocationMaxBytes']+1048576
    cohort_max=2*(physical+aid+targets)+padding+directory_bytes+fixed
    backing_bytes=sum(p['bytes'] for route in contract['routes'] for p in route['parts'])
    result={'scope':'DECLARED_FINITE_MEMBERSHIP_AND_ENFORCEABLE_PREPARATION_CEILINGS_ONLY_NOT_RUNTIME','cohorts':cohort_results,'physicalDirectoryCount':physical_directory_count,'allFinitePreparationDirectoryCount':len(directory_children),'exactInitializerDirectoryLiterals':['tools','bin','bindings','home','infra','physical-receipts'],'exactInitializerBinEntries':['bin/node','bin/python3.12','bin/npm','bin/npx'],'exactInitializerReceipt':'bindings/initialization.json','exactOtherCaptureFailureAndEffectiveEnvironmentOutputs':['bindings/capture-failure.json','tools/capture-effective-environment.json','physical-receipts/failure.json'],'finiteNoncohortFixedOutputs':[p for p in sorted(fixed_outputs) if not p.startswith('raw-preimages/') and '/stream-' not in p],'additionalInodeAdmissionEnforcedMax':len(paths)+len(raw)+len(directory_children)+64,'physicalDirectoryMembershipSHA256':physical_directory_hash,'additionalMetadataHelperFileCountEnforcedMax':64,'additionalMetadataHelperFileBlockPaddingMaxBytes':finite_additional_file_block_padding,'directoryMembershipSHA256':hashlib.sha256(('\n'.join(sorted(directory_children))+'\n').encode()).hexdigest(),'actualMaximumChildren':max(map(len,directory_children.values())),'exactPathRows':len(paths),'distinctRawObjects':len(raw),'distinctRawExactBytesDiagnosticOnly':sum(raw.values()),'distinctRawBlockRoundedBytesDiagnosticOnly':raw_rounding,'knownPhysicalAndSameRAWWithoutDedupBytes':12452908282,'sourceAidsPhysicalAndRAW':2*aid,'literalTargetsPhysicalAndRAW':2*targets,'knownRegularBlockRoundingNoDedupMaxBytes':padding,'finiteLiteralDirectoryAllocationMaxBytes':directory_bytes,'unchangedMetadataInputAllocationCeilingsBytes':old['metadataAllocationMaxBytes'],'preservedOldBroadAdmissionCeilingBytes':old['physicalAdmissionMaxBytes'],'preservedRejectedAdmissionCeilingBytes':48565865408,'proposedFinitePhysicalPreparationAdmissionBytes':cohort_max,'publishedGitSixRouteEncodedBytes':backing_bytes,'sameFilesystemCheckoutRuntimeBackingExtras':'MEASURE_MEASURED_ALLOCATED_BYTES_AND_RESERVE_SEPARATELY; NO14GB_OR_FREE_SPACE_ASSUMPTION','futureGeneratedCanonicalClosure':'HELD_UNTIL_FIELD_COMPLETE_SEVEN_INPUTS; compilerRaw=32*(admittedGraphBytes+snapshotBytes)+8192*inputClosureRows+16384; compilerEncoded=raw+ceil(raw/65536)*64+1024; rootRaw=32*closureBytes+16384; eachRootReceiptQuota=1GiB; processOwnerRaw=256000','actualResourcePRE':pre,'actualResourcePOST':reserve(),'metadataReadProofs':PROOFS,'subjectExecuted':False,'physicalCohortMaterialized':False,'elapsedSeconds':time.monotonic()-started}
    target=Path(sys.argv[1]); target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    with open(target,'xb') as out: os.chmod(target,0o600); out.write((json.dumps(result,indent=2)+'\n').encode()); out.flush(); os.fsync(out.fileno())
    print(json.dumps({k:v for k,v in result.items() if k not in ('cohorts','metadataReadProofs')}))

if __name__=='__main__': main()
