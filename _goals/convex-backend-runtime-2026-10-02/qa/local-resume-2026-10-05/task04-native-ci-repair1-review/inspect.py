"""Fresh read-only source inspection. Only writes this new reviewer namespace."""
import ast
import gzip
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys

sys.dont_write_bytecode = True
REPO = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
OUT = Path(__file__).resolve().parent
Q = REPO / '_goals/convex-backend-runtime-2026-10-02/qa/task04-c8-physical-preparation-r3/native-ci-repair1'
W = REPO / 'work/resume/task04-c8-physical-preparation-r3/native-ci-a5-repair1'
FIELDS = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')

def identity(s):
    return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}

def save(name, value):
    with open(OUT/name, 'x') as f:
        f.write(json.dumps(value,indent=2)+'\n')

def read_bound(path, expected=None, raw_copy=False, allow_pair=False):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        s=os.fstat(fd); pre=identity(s)
        assert stat.S_ISREG(s.st_mode) and (s.st_nlink==1 or (allow_pair and s.st_nlink==2)),str(path)
        sha=hashlib.sha256(); raw=bytearray()
        while block:=os.read(fd,1048576): sha.update(block); raw.extend(block)
        assert os.read(fd,1)==b''
        post=identity(os.fstat(fd)); pathpost=identity(os.lstat(path))
        row={'path':str(path.relative_to(REPO)),'bytes':len(raw),'sha256':sha.hexdigest(),'PRE':pre,'POST':post,'pathPOST':pathpost,'EOF':True}
        assert pre==post==pathpost and len(raw)==s.st_size,row
        if expected:
            for k in ('bytes','sha256','PRE','POST','pathPOST'):
                assert row[k]==expected[k],(str(path),k,row[k],expected[k])
        os.lseek(fd,0,0); second=hashlib.sha256(); size=0
        while block:=os.read(fd,1048576): second.update(block); size+=len(block)
        assert size==len(raw) and second.hexdigest()==row['sha256'] and identity(os.fstat(fd))==pre and identity(os.lstat(path))==pre
        row['heldFinalRereadEqual']=True
        if raw_copy:
            dest=OUT/'raw-evidence'/row['sha256']
            if not dest.exists():
                with open(dest,'xb') as f: f.write(raw)
            assert dest.read_bytes()==raw
            row['reviewerRawExactCopy']=str(dest.relative_to(REPO))
        return row,bytes(raw)
    finally: os.close(fd)

def inspect_packet():
    manifest,raw=read_bound(Q/'repair-packet-manifest.json',raw_copy=True)
    assert manifest['bytes']==193477 and manifest['sha256']=='0cb67f65cddab4a1146e386c1c1a77c8eb13dfa3daf68bc48c3138942d580ff5'
    packet=json.loads(raw); pairpaths={p for g in packet['hardlinkControlGroups'] for p in g}
    files=[read_bound(REPO/r['path'],r,allow_pair=r['path'] in pairpaths)[0] for r in packet['files']]
    dirs=[]; held=[]
    try:
        for r in packet['directories']:
            p=REPO/r['path']; fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW); held.append((fd,r,p))
            pre=identity(os.fstat(fd)); names=sorted(os.listdir(fd))
            assert pre==r['PRE']==r['POST'] and names==r['members'] and identity(os.lstat(p))==pre
            dirs.append({'path':r['path'],'PRE':pre,'POST':identity(os.fstat(fd)),'members':names})
        for fd,r,p in held:
            assert identity(os.fstat(fd))==r['PRE'] and identity(os.lstat(p))==r['PRE'] and sorted(os.listdir(fd))==r['members']
    finally:
        for fd,r,p in held: os.close(fd)
    aliases=[]
    for r in packet['ownedControlAliases']:
        p=REPO/r['path']; fd=os.open(p,os.O_RDONLY|os.O_SYMLINK)
        try:
            pre=identity(os.fstat(fd)); target=os.fsencode(os.readlink(p)).hex()
            assert stat.S_ISLNK(os.fstat(fd).st_mode) and pre==r['PRE']==r['POST']==r['pathPOST'] and target==r['targetHex']
            assert identity(os.fstat(fd))==identity(os.lstat(p))==pre
            aliases.append({'path':r['path'],'PRE':pre,'POST':identity(os.fstat(fd)),'pathPOST':identity(os.lstat(p)),'targetHex':target,'heldDarwinDummyOnly':True})
        finally: os.close(fd)
    for g in packet['hardlinkControlGroups']:
        a,b=(os.lstat(REPO/p) for p in g)
        assert a.st_ino==b.st_ino and a.st_dev==b.st_dev and a.st_nlink==b.st_nlink==2
    assert len(files)==109 and len(dirs)==25 and len(aliases)==4 and len(packet['hardlinkControlGroups'])==4
    assert not (REPO/'.github/workflows/task04-c8-native-infrastructure.yml').exists()
    return {'scope':'FRESH_CURRENT_HOST_PACKET_FULL_BYTES_EOF_HELD_NINE_AND_MEMBERSHIPS_ONLY','manifest':manifest,'files':files,'directories':dirs,'aliases':aliases,'pairedHardlinkGroups':packet['hardlinkControlGroups'],'nativeRuntime':'UNEXECUTED_HELD','workflowActualTargetAbsent':True}

def source_review():
    seal,raw=read_bound(W/'ci-source-manifest.json',raw_copy=True)
    assert seal['sha256']=='faeda0f0da5049e4f610a50fbbd689cfbb9dcbc14bfa018d5675af39e4afc897'
    source=json.loads(raw); rows=[]
    for r in source['files']:
        row,body=read_bound(W/r['path'],raw_copy=True)
        assert row['bytes']==r['bytes'] and row['sha256']==r['sha256']
        if r['path'].endswith('.py'): ast.parse(body)
        rows.append(row)
    assert len(rows)==13 and sum(r['bytes'] for r in rows)==137253
    workflow=next(r for r in rows if r['path'].endswith('.yml.proposed'))
    assert workflow['sha256']=='438f42dafa483431ded305e0a894cc553a2ec1e51817441b9217c7653495233b'
    for n in ('ci-run.py','native-capability.py','bounded_process.py'):
        tree=ast.parse((W/n).read_bytes())
        for a in ast.walk(tree):
            assert not (isinstance(a,ast.Call) and isinstance(a.func,ast.Attribute) and a.func.attr in ('run','communicate') and isinstance(a.func.value,ast.Name) and a.func.value.id=='subprocess'),n
    return {'manifest':seal,'source':rows,'tenASTParsed':True,'sourceBytes':137253,'noPostbufferSubprocessRunOrCommunicate':True}

def conservation():
    oldpath=REPO/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c8-physical-preparation-r3/native-ci-proposal-packet-manifest.json'
    oldseal,raw=read_bound(oldpath,raw_copy=True)
    assert oldseal['sha256']=='598ac93dcf4593ff16bfaca3c228e5226f6e002336c6e80759cd0c7bc35f9bfb'
    old=json.loads(raw); files=[read_bound(REPO/r['path'],r)[0] for r in old['files']]
    assert len(files)==73
    current=json.loads((Q/'repair-conservation-final.json').read_bytes()); ancestors=set(current['intentionallyExtendedOldAncestors']); dirs=[]
    assert len(ancestors)==2
    for r in old['directories']:
        p=REPO/r['path']; fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
        try:
            pre=identity(os.fstat(fd)); names=sorted(os.listdir(fd)); proof=next(x for x in current['oldDirectories'] if x['path']==r['path'])
            if r['path'] in ancestors:
                assert names==proof['currentMembers'] and pre==proof['currentObservedPRE']==proof['currentObservedPOST'] and set(names)-set(r['members'])==set(proof['added']) and set(r['members'])-set(names)==set()
            else: assert names==r['members'] and pre==r['PRE']==r['POST']
            assert pre==identity(os.fstat(fd))==identity(os.lstat(p))
            dirs.append({'path':r['path'],'currentPRE':pre,'members':names,'oldAuthorityUnchanged':r['path'] not in ancestors,'oldPinNeverRefreshed':True})
        finally: os.close(fd)
    sourcechanges=current['sourceChanges']
    for r in sourcechanges:
        pre=read_bound(REPO/r['preservedPreimage']['path'],r['preservedPreimage'])[0]
        assert pre['bytes']==r['oldBytes'] and pre['sha256']==r['oldSHA256']
    original=REPO/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-native-ci-proposal-review'
    witness=[]
    for p in sorted((Q/'review-preimages').iterdir()):
        if p.is_file():
            row,body=read_bound(p)
            assert body==(original/p.name).read_bytes(),p
            witness.append(row)
    failed=json.loads((Q/'host-alias-failed-source-conservation.json').read_bytes())
    failrow,body=read_bound(W/failed['source'],raw_copy=True)
    assert failrow['bytes']==7280 and failrow['sha256']==failed['sha256']
    assert b'os.O_RDONLY|os.O_SYMLINK|os.O_NOFOLLOW' in body
    assert failrow['sha256']==next(r['sha256'] for r in json.loads((Q/'controls-attempt4/controls.json').read_bytes())['sourceHashes'] if r['path']=='seal-repair-packet.py')
    return {'oldManifest':oldseal,'old73FullBytesAllNine':files,'oldDirectories':dirs,'original13PreimagesEqual':True,'reviewerWitnessCopiesEqual':witness,'failedDarwinPreimage':failrow,'historicalCustody':'NOT_REPAIRED_OR_CLAIMED'}

def git_continuity():
    proof=json.loads((Q/'current-git-route-continuity.json').read_bytes())
    _,raw=read_bound(REPO/proof['priorIndependentFullRawProof']['path'],proof['priorIndependentFullRawProof'])
    prior=json.loads(raw)
    assert len(prior['rows'])==361 and len(proof['parts'])==361
    wanted={r['path']:r for r in prior['rows']}
    head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()
    tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=REPO,text=True).strip()
    assert head=='cf926f81b664ba02c77cb057f0495321c02d4e4b'==proof['currentHEAD'] and tree==proof['currentTree']
    raw=subprocess.check_output(['git','ls-tree','-r','--full-tree','-z',head,'--',*wanted],cwd=REPO)
    observed={}
    for r in raw.split(b'\0'):
        if r:
            hdr,path=r.split(b'\t',1); mode,kind,oid=hdr.decode().split(); path=os.fsdecode(path)
            assert kind=='blob' and mode in ('100644','100755') and oid==wanted[path]['currentGitBlobOID']==wanted[path]['pinnedGitBlobOID']
            observed[path]=oid
    assert set(observed)==set(wanted) and sum(r['bytes'] for r in wanted.values())==1872365422
    for r in proof['parts']:
        old=wanted[r['path']]
        assert all(r[k]==old[k] for k in ('bytes','sha256')) and r['gitBlobOID']==old['currentGitBlobOID'] and old['gitFullRawSHA256']==r['sha256']
    return {'scope':'CURRENT_GIT_OID_CONTINUITY_OF_BOUND_PRIOR_FULL_RAW_PROOF_ONLY','HEAD':head,'tree':tree,'parts':len(observed),'encodedBytes':1872365422,'allEqual':True,'newArchiveReads':False,'historicalCustody':'4224_UNPUBLISHED_31_UNVERIFIED_11_FORENSIC_REMAIN_HELD'}

def finite_review():
    d=json.loads((Q/'finite-source-demand.json').read_bytes()); p=json.loads((Q/'finite-resource-proposal.json').read_bytes())
    assert hashlib.sha256((Q/'finite-source-demand.json').read_bytes()).hexdigest()==p['sourceDemandReceiptSHA256']
    assert sum(p['terms'].values())==48565877696==d['proposedFinitePhysicalPreparationAdmissionBytes']
    assert d['exactPathRows']+d['distinctRawObjects']+d['allFinitePreparationDirectoryCount']+64==317989
    assert len(d['finiteNoncohortFixedOutputs'])==52 and 52+7<=64
    required={'bin/node','bin/python3.12','bin/npm','bin/npx','bindings/initialization.json','bindings/capture-failure.json','tools/capture-effective-environment.json','physical-receipts/failure.json'}
    assert required<=set(d['finiteNoncohortFixedOutputs'])
    assert set(d['exactInitializerDirectoryLiterals'])=={'tools','bin','bindings','home','infra','physical-receipts'}
    init=ast.parse((REPO/'work/resume/task04-c8-physical-preparation-r3/initialize-phase.py').read_bytes())
    source=ast.parse((W/'derive-finite-demand.py').read_bytes())
    observed=next(x.iter for x in ast.walk(init) if isinstance(x,ast.For) and isinstance(x.target,ast.Name) and x.target.id=='directory')
    assert ast.literal_eval(observed)==tuple(d['exactInitializerDirectoryLiterals'])
    _,raw=read_bound(REPO/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1/mapParts/part-00000.gzpart')
    assert len(raw)==3027090 and hashlib.sha256(raw).hexdigest()=='bdcd96a750ba26fdc85e6f259ee6457a7f8525c00f6cb0dac185f71ccbfa7c6f'
    data=gzip.decompress(raw)
    assert len(data)==48104635 and hashlib.sha256(data).hexdigest()=='719842f56e3595c163b7d89db9f91bbb9b85397d26a78c4ac8d65f23e2b42d40'
    full=json.loads(data); dirs=set(); targetbytes=0; sizes=0; links=0
    for row in full['files']:
        path=Path('cohorts/full8')/row['path'].removeprefix('/workspace/Project-Cortex/')
        for i in range(1,len(path.parts)): dirs.add('/'.join(path.parts[:i]))
        if row.get('kind')=='literal-symlink': targetbytes+=len(bytes.fromhex(row['targetHex']));links+=1
        else:sizes+=row['bytes']
    assert len(full['files'])==148325 and len(full['roots'])==8 and sizes==3110990905 and targetbytes==4474 and links==30
    # Host source-shaped seam of the exact fixed-path code, no R2/Docker access.
    main=next(n for n in source.body if isinstance(n,ast.FunctionDef) and n.name=='main')
    start=next(i for i,n in enumerate(main.body) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='fixed_outputs' for t in n.targets))
    end=next(i for i,n in enumerate(main.body) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='directory_bytes' for t in n.targets))
    namespace={'directory_children':{},'hashlib':hashlib,'PurePosixPath':__import__('pathlib').PurePosixPath,'raw':{},'cohort_hashes':{k:set() for k in ('full8','history','original','comparison','packages')},'contract':{'routes':[]},'os':os}
    exec(compile(ast.fix_missing_locations(ast.Module(body=main.body[start:end+1],type_ignores=[])),'<exact-fixed-parent-source>','exec'),namespace)
    assert required<=namespace['fixed_outputs'] and {'tools','bin','bindings','home','infra','physical-receipts','generated-inputs','generated-inputs/candidate'}<=namespace['directory_children'].keys()
    return {'scope':'INDEPENDENT_ARITHMETIC_C4_FULL_METADATA_AND_FIXED_PARENT_SOURCE_SEAM_NOT_NATIVE_RUNTIME','terms':p['terms'],'totalBytes':48565877696,'inodeEquation':317989,'directoryCountFromSealedNativeMetadataAudit':70387,'named52PlusFuture7Within64':True,'fixedOutputsSourceSeam':sorted(namespace['fixed_outputs']),'C4FULL':{'rows':148325,'roots':8,'regularBytes':sizes,'links':links,'targets':targetbytes,'directories':len(dirs)},'R2Audit':'SEALED_NATIVE_ARM_METADATA_RECEIPT_REVIEWED_NOT_RERUN','futureBulkRelease':'HELD_REGARDLESS'}

if __name__=='__main__':
    stage=sys.argv[1]
    if stage=='pre':
        (OUT/'raw-evidence').mkdir(mode=0o700)
        save('source-binding-pre.json',inspect_packet())
        save('source-review.json',source_review())
        save('conservation-review.json',conservation())
        save('git-continuity-review.json',git_continuity())
        save('finite-demand-review.json',finite_review())
    elif stage=='supplement':
        save('git-continuity-review.json',git_continuity())
        save('finite-demand-review.json',finite_review())
    else:save('source-binding-post.json',inspect_packet())
    print(json.dumps({'stage':stage,'assertions':'PASS','nativeRuntime':'HELD','DockerCalls':False,'workflowWrites':False}))
