"""Independent host-only repair2 checks; no Docker or subject evaluation."""
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import stat
import subprocess
import sys
import time

REPO = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
W = REPO/'work/resume/task04-c8-physical-preparation-r3/native-ci-a5-repair2'
Q = REPO/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c8-physical-preparation-r3/native-ci-repair2'
R = Path(__file__).parent
FIELDS = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(st):
    return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(st,'st_'+k)) for k in FIELDS}}
def save(name, value):
    with open(R/name,'x') as f:
        f.write(json.dumps(value,indent=2)+'\n'); f.flush(); os.fsync(f.fileno())
def read(fd):
    os.lseek(fd,0,0)
    out=bytearray()
    while block:=os.read(fd,1048576): out.extend(block)
    return bytes(out)
def digest(raw): return hashlib.sha256(raw).hexdigest()
def checked(path, expected=None):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        before=ident(os.fstat(fd)); raw=read(fd); after=ident(os.fstat(fd)); post=ident(os.lstat(path))
        assert before==after==post and int(before['fields']['size'])==len(raw)
        row={'path':str(path.relative_to(REPO)),'bytes':len(raw),'sha256':digest(raw),'PRE':before,'POST':after,'pathPOST':post,'EOF':True}
        if expected:
            assert all(row[k]==expected[k] for k in ('bytes','sha256','PRE','POST','pathPOST')),(path,'old authority mismatch')
        assert read(fd)==raw and ident(os.fstat(fd))==before
        return row,raw
    finally:os.close(fd)
def bind_packet(path, expected_sha, expected_counts):
    seal,raw=checked(path); assert digest(raw)==expected_sha
    packet=json.loads(raw); held=[]; result={'seal':seal,'files':[],'directories':[],'aliases':[],'hardlinkGroups':packet['hardlinkControlGroups']}
    assert (len(packet['files']),len(packet['directories']),len(packet['ownedControlAliases']),len(packet['hardlinkControlGroups']))==expected_counts
    group_paths={p for group in packet['hardlinkControlGroups'] for p in group}
    try:
        for row in packet['files']:
            path=REPO/row['path'];fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);held.append(('file',fd,row))
            st=os.fstat(fd);assert stat.S_ISREG(st.st_mode)
            assert st.st_nlink==(2 if row['path'] in group_paths else 1)
            data=read(fd);actual={'path':row['path'],'bytes':len(data),'sha256':digest(data),'PRE':ident(st),'POST':ident(os.fstat(fd)),'pathPOST':ident(os.lstat(path)),'EOF':True}
            assert all(actual[k]==row[k] for k in actual),(path,'sealed file mismatch')
            result['files'].append(actual)
        for row in packet['directories']:
            path=REPO/row['path'];fd=os.open(path,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);held.append(('directory',fd,row))
            actual={'path':row['path'],'PRE':ident(os.fstat(fd)),'POST':ident(os.fstat(fd)),'members':sorted(os.listdir(fd))}
            assert actual==row and ident(os.lstat(path))==row['PRE'],(path,'sealed directory mismatch')
            result['directories'].append(actual)
        for row in packet['ownedControlAliases']:
            path=REPO/row['path'];assert hasattr(os,'O_SYMLINK')
            fd=os.open(path,os.O_RDONLY|os.O_SYMLINK);held.append(('alias',fd,row))
            assert stat.S_ISLNK(os.fstat(fd).st_mode)
            actual={'path':row['path'],'targetHex':os.fsencode(os.readlink(path)).hex(),'PRE':ident(os.fstat(fd)),'POST':ident(os.fstat(fd)),'pathPOST':ident(os.lstat(path))}
            assert all(actual[k]==row[k] for k in actual)
            assert path.resolve(strict=True)==path.parent/'bin'
            result['aliases'].append(actual)
        for group in packet['hardlinkControlGroups']:
            assert len(group)==2 and {Path(p).name for p in group}=={'hard-original','hard-link'}
            a,b=[os.lstat(REPO/p) for p in group]
            assert (a.st_dev,a.st_ino)==(b.st_dev,b.st_ino) and a.st_nlink==b.st_nlink==2
        for kind,fd,row in held:
            assert ident(os.fstat(fd))==ident(os.lstat(REPO/row['path']))==row['PRE']
            if kind=='file':
                data=read(fd);assert len(data)==row['bytes'] and digest(data)==row['sha256']
            elif kind=='directory':assert sorted(os.listdir(fd))==row['members']
            else:assert os.fsencode(os.readlink(REPO/row['path'])).hex()==row['targetHex']
            assert ident(os.fstat(fd))==row['PRE']
        assert checked(path if False else REPO/packet['selfExcluded'])[1]==raw
    finally:
        for _,fd,_ in held:os.close(fd)
    result['heldFinalRereadEqual']=True
    return result
def bind(stage):
    assert not (REPO/'.github/workflows/task04-c8-native-infrastructure.yml').exists()
    current=bind_packet(Q/'repair-packet-manifest.json','5209a4b98db687118fdf7cb9723d10f9b56f13811b3659a67aff827b02dcac66',(91,15,2,2))
    oldq=Q.parent/'native-ci-repair1'
    old=bind_packet(oldq/'repair-packet-manifest.json','0cb67f65cddab4a1146e386c1c1a77c8eb13dfa3daf68bc48c3138942d580ff5',(109,25,4,4))
    assert checked(Q/'repair1-packet-manifest.json')[1]==checked(oldq/'repair-packet-manifest.json')[1]
    save('source-binding-'+stage+'.json',current);save('old-conservation-'+stage+'.json',old)
    if stage=='post':
        assert json.loads((R/'source-binding-pre.json').read_bytes())==current
        assert json.loads((R/'old-conservation-pre.json').read_bytes())==old
        save('pre-post-equality.json',{'current91_15_2_2':True,'old109_25_4_4':True,'oldPinsRefreshed':False,'workflowAbsent':True})
    else:
        rawdir=R/'raw-evidence';rawdir.mkdir()
        paths=[Q/'repair-packet-manifest.json',W/'ci-source-manifest.json',Q/'repair-report.md',oldq/'repair-packet-manifest.json']+[W/r['path'] for r in json.loads((W/'ci-source-manifest.json').read_bytes())['files']]
        paths += [REPO/'work/resume/task04-c8-physical-preparation-r3/initialize-phase.py',W/'preimages/derive-finite-demand.py',Q/'review-preimages/report.md',Q/'review-preimages/verdict.json']
        bindings=[]
        for p in paths:
            row,data=checked(p);dest=rawdir/row['sha256']
            if not dest.exists():dest.write_bytes(data)
            row['reviewerRawExactCopy']=str(dest.relative_to(REPO));bindings.append(row)
        save('raw-source-bindings.json',bindings)
def fixed_shape(raw):
    parsed=ast.parse(raw);body=next(n.body for n in parsed.body if isinstance(n,ast.FunctionDef) and n.name=='main')
    f=next(n for n in body if isinstance(n,ast.FunctionDef) and n.name=='fixed_path')
    start=next(i for i,n in enumerate(body) if isinstance(n,ast.For) and ast.unparse(n.iter)=="('tools', 'bin', 'bindings', 'home', 'infra', 'physical-receipts')")
    stop=next(i for i,n in enumerate(body) if isinstance(n,ast.Expr) and ast.unparse(n)=="fixed_path('home/.owned-marker')")
    env={'fixed_outputs':set(),'directory_children':{},'PurePosixPath':PurePosixPath,'raw':{},'contract':{'routes':[]},'cohort_hashes':{k:set() for k in ['full8','history','original','comparison','packages']}}
    exec(compile(ast.Module(body=[f]+body[start:stop+1],type_ignores=[]),'<pure retained declarations>','exec'),env)
    return env['fixed_outputs'],env['directory_children']
def source_checks():
    manifest_raw=(W/'ci-source-manifest.json').read_bytes();manifest=json.loads(manifest_raw)
    assert digest(manifest_raw)=='3cdd4fb86dbf99067861a0d130230d9130da93a1d7b1abee9236faa834b754bd'
    assert len(manifest['files'])==13 and sum(r['bytes'] for r in manifest['files'])==146382
    parsed=[]
    for row in manifest['files']:
        raw=(W/row['path']).read_bytes();assert len(raw)==row['bytes'] and digest(raw)==row['sha256']
        if row['path'].endswith('.py'):ast.parse(raw);parsed.append(row)
    oldraw=(W/'preimages/derive-finite-demand.py').read_bytes();newraw=(W/'derive-finite-demand.py').read_bytes()
    assert newraw==oldraw.replace(b"'materialize-cohort-proposed.py'",b"'materialize-cohort.py'") and oldraw.count(b"'materialize-cohort-proposed.py'")==1
    protected=['native-capability.py','bounded_process.py','ci-run.py','materialize-cohort-proposed.py','Dockerfile','bootstrap-npm.py','native-owner.py','verify-git-route-inputs.py']
    for name in protected:assert (W/name).read_bytes()==(W/'preimages'/name).read_bytes()
    for name in ['seal-repair-packet.py','task04-c8-native-infrastructure.yml.proposed']:
        assert (W/name).read_bytes()==(W/'preimages'/name).read_bytes().replace(b'native-ci-a5-repair1',b'native-ci-a5-repair2').replace(b'native-ci-repair1',b'native-ci-repair2')
    initrow,initraw=checked(REPO/'work/resume/task04-c8-physical-preparation-r3/initialize-phase.py')
    assert digest(initraw)=='ac07766a7b733d81a0ee3b5eb26efd7554e869f900aa8232f3ca80ae78cb3552'
    assert initraw==(W/'preimages/initialize-phase.py.preserved').read_bytes()
    tree=ast.parse(initraw);names=ast.literal_eval(next(n.value for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='FILES' for t in n.targets)))
    main=next(n.body for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='main')
    dirs=set(ast.literal_eval(next(n.iter for n in main if isinstance(n,ast.For) and isinstance(n.target,ast.Name) and n.target.id=='directory')))
    loop=next(n for n in main if isinstance(n,ast.For) and isinstance(n.iter,ast.Name) and n.iter.id=='FILES')
    assert ast.unparse(next(n.value for n in loop.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='target' for t in n.targets)))=="ROOT / 'tools' / name"
    aliases={ast.unparse(n.args[1]) for n in ast.walk(tree) if isinstance(n,ast.Call) and ast.unparse(n.func)=='os.symlink'}
    assert aliases=={"ROOT / 'bin/node'","ROOT / 'bin/python3.12'"}
    wraps=next(n for n in main if isinstance(n,ast.For) and isinstance(n.target,ast.Tuple));wrappers=ast.literal_eval(wraps.iter)
    assert wrappers==[('npm','npm-cli.js'),('npx','npx-cli.js')]
    assert ast.unparse(next(n.value for n in wraps.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='path' for t in n.targets)))=="ROOT / 'bin' / name"
    assert ast.unparse(next(n.value for n in main if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='path' for t in n.targets)))=="ROOT / 'bindings/initialization.json'"
    actual={'tools/'+n for n in names}|{'bin/node','bin/python3.12','bin/npm','bin/npx','bindings/initialization.json'}
    current,parents=fixed_shape(newraw);old,oldparents=fixed_shape(oldraw)
    demand=json.loads((Q/'finite-source-demand.json').read_bytes());prior=json.loads((Q/'repair1-finite-source-demand.json').read_bytes())
    assert set(demand['finiteNoncohortFixedOutputs'])==current and set(prior['finiteNoncohortFixedOutputs'])==old
    assert len(actual)==13 and actual<=current and dirs<=parents.keys()
    assert {str(PurePosixPath(p).parent) for p in actual}<=parents.keys()
    assert actual-old=={'tools/materialize-cohort.py'}
    negative=[]
    for path in sorted(actual):
        missing=actual-(current-{path});assert missing=={path};negative.append({'removed':path,'missing':sorted(missing)})
    assert old-current=={'tools/materialize-cohort-proposed.py'} and current-old=={'tools/materialize-cohort.py'}
    assert parents.keys()==oldparents.keys() and len(current)==len(old)==52
    def allocation(children):return 4096+((sum(((len(os.fsencode(c))+11)//4)*4 for c in children)+4095)//4096)*4096
    changed=[]
    for parent in parents:
        assert allocation(parents[parent])==allocation(oldparents[parent])
        if parents[parent]!=oldparents[parent]:changed.append(parent)
    assert changed==['tools'] and allocation(parents['tools'])==8192
    assert sum(((len(os.fsencode(c))+11)//4)*4 for c in oldparents['tools'])==292
    assert sum(((len(os.fsencode(c))+11)//4)*4 for c in parents['tools'])==284
    stable=[k for k in prior if k not in ['scope','finiteNoncohortFixedOutputs','analyticalLiteralCorrection']]
    assert all(demand[k]==prior[k] for k in stable),[k for k in stable if demand[k]!=prior[k]]
    assert demand['exactPathRows']+demand['distinctRawObjects']+demand['allFinitePreparationDirectoryCount']+64==317989
    proposal=json.loads((Q/'finite-resource-proposal.json').read_bytes())
    assert sum(proposal['terms'].values())==48565877696
    assert proposal['totalAdditionalDiskAdmissionEnforcedMaxBytes']==48565877696 and proposal['additionalInodeAdmissionEnforcedMax']==317989
    assert proposal['terms']=={'physicalAndSameRAW':12452908282,'sourceAidsAndSameRAW':4262420,'literalTargetsAndSameRAW':8948,'blockRoundingPlus64Padding':1374807486,'exactDeclaredDirectoryAllocation':583061504,'unchangedMetadataInputCeilings':34149780480,'helperSourceCeiling':1048576}
    formula="hashlib.sha256(('\\n'.join(sorted(directory_children))+'\\n').encode()).hexdigest()"
    assert formula in newraw.decode()
    mapping_raw=(Q/'prospective-materializer-transfer.json').read_bytes();mapping=json.loads(mapping_raw)
    ref=manifest['prospectiveMaterializerTransfer']
    assert digest(mapping_raw)==ref['mappingReceiptSHA256']
    assert mapping['source']['sha256']==ref['sourceSHA256']==digest((W/'materialize-cohort-proposed.py').read_bytes())
    assert mapping['source']['bytes']==ref['sourceBytes']==26131
    assert mapping['freshPreparedInitializerInput']==ref['preparedInput']=='/tool-source/materialize-cohort.py'
    assert mapping['actualFiniteOutput']==ref['actualOutput']=='tools/materialize-cohort.py'
    assert mapping['retainedInitializer']['FILESMember']==ref['initializerFILESMember']=='materialize-cohort.py'
    assert mapping['release']=='HELD' and mapping['transferExecuted'] is False and mapping['initializerExecuted'] is False
    controls=json.loads((Q/'controls-attempt2/controls.json').read_bytes());assert len(controls['checks'])==29 and all(r['outcome']=='ASSERTIONS_PASSED' for r in controls['checks'])
    assert controls['sourceHashes']==parsed
    save('source-and-inventory-review.json',{'parsed10':parsed,'protectedByteEqual8':protected,'literalDeltaOnly':True,'actual13Outputs':sorted(actual),'actual6Directories':sorted(dirs),'fixed52Outputs':sorted(current),'all13MissingOutputControls':negative,'oldExactRejectedMissing':['tools/materialize-cohort.py'],'changedParentOnly':changed,'parentKeysAndRoundedAllocationsEqual':True,'toolsDirentBytes':[292,284],'toolsRoundedBytes':[8192,8192],'stablePriorDemandKeys':stable,'byteCeiling':48565877696,'inodeCeiling':317989,'directoryHashSemantics':'sorted directory path keys only; tools child names explicitly differ','mapping':mapping,'producer29AssertionsVerified':True,'initializerExecuted':False,'archiveOrCohortRead':False})
def convert(v):
    if isinstance(v,bytes):return {'bytes':len(v),'hex':v.hex(),'sha256':digest(v)}
    if isinstance(v,dict):return {k:convert(x) for k,x in v.items()}
    if isinstance(v,(list,tuple)):return [convert(x) for x in v]
    return v
def host_controls():
    module_ast=ast.parse((W/'bounded_process.py').read_bytes());env={'__name__':'reviewed_bounded_source'}
    exec(compile(module_ast,str(W/'bounded_process.py'),'exec'),env)
    checks=[]
    def run(name,fn,scope='ACTUAL_HOST_SOURCE_PUBLIC_DUMMY_NOT_NATIVE_LINUX'):
        checks.append({'name':name,'scope':scope,'outcome':'ASSERTIONS_PASSED','observation':convert(fn())})
    def command(code,out=7,err=9,timeout=2):return env['bounded_command']([sys.executable,'-c',code],stdout_limit=out,stderr_limit=err,timeout=timeout)
    def boundary():
        row=command('import os;os.write(1,b"1234567");os.write(2,b"abcdefghi")')
        assert row['stdout']==b'1234567' and row['stderr']==b'abcdefghi' and row['terminal'] and row['exit']==0 and row['closeErrors']==[]
        assert row['authorityMode']=='BOOTSTRAP_CREATED_POPEN_HANDLE_ONLY_NOT_TASK04';return row
    run('exact_independent_two_pipe_boundary',boundary)
    for pipe,code,prefix in [(1,'COMMAND_STDOUT_OVERFLOW',b'1234567'),(2,'COMMAND_STDERR_OVERFLOW',b'123456789')]:
        def overflow(pipe=pipe,code=code,prefix=prefix):
            try:command('import os,time;os.write('+str(pipe)+',b"1234567890");time.sleep(8)')
            except env['CollectionFailure'] as e:
                row=e.receipt;assert str(e)==code and row['stdout']==(prefix if pipe==1 else b'') and row['stderr']==(prefix if pipe==2 else b'')
                assert row['terminal'] and row['exit'] is not None and not row['closeErrors'];return row
            raise AssertionError('overflow accepted')
        run('owned_pipe_'+str(pipe)+'_overflow_bound_and_terminal',overflow)
    def deadline():
        try:command('import os,time;os.write(1,b"part");os.write(2,b"err");time.sleep(8)',timeout=.3)
        except env['CollectionFailure'] as e:
            row=e.receipt;assert str(e)=='COMMAND_DEADLINE_EXCEEDED' and row['stdout']==b'part' and row['stderr']==b'err' and row['terminal'] and not row['closeErrors'];return row
        raise AssertionError('deadline accepted')
    run('finite_deadline_retains_both_partial_outputs',deadline)
    def spawn():
        try:env['bounded_command']([str(R/'absent-executable')],stdout_limit=1,stderr_limit=1,timeout=1)
        except env['CollectionFailure'] as e:
            assert str(e)=='COMMAND_SPAWN_FAILURE' and 'createdChildPID' not in e.receipt and not e.receipt['terminal'];return e.receipt
        raise AssertionError('spawn accepted')
    run('missing_executable_has_no_child_authority',spawn)
    def tarstream():
        p=subprocess.Popen([sys.executable,'-c','import os;os.write(1,b"1234567890");os.write(2,b"stderr")'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        stream=env['BoundedFileStream'](p,stdout_limit=10,stderr_limit=6,timeout=2)
        try:
            raw=b''
            while block:=stream.read(3):raw+=block
            row=stream.finish();assert raw==b'1234567890' and row['stderr']==b'stderr' and row['terminal'] and row['exit']==0;return row
        finally:
            if p.poll() is None:p.kill();p.wait(timeout=2)
            assert stream.close()==[]
    run('actual_stream_consumer_exact_eof_and_terminal',tarstream)
    # Parse actual capability functions; Linux-only alias/syscall effects are explicitly substituted.
    native=ast.parse((W/'native-capability.py').read_bytes());names={'identity','members','alias_target','final_verify','capture'}
    ns={'os':os,'stat':stat,'Path':Path,'hashlib':hashlib,'FIELDS':FIELDS,'directories':[],'retained':[],'aliases':[],'byte_total':0,'CAP':536870912,'OUT':R/'host-fixture','BACK':R/'host-fixture/backings','measure':lambda *a,**k:None,'alias':lambda p:None}
    ns['OUT'].mkdir();ns['BACK'].mkdir()
    exec(compile(ast.Module(body=[n for n in native.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'<actual source host file seam>','exec'),ns)
    directory=ns['OUT']/'bin';directory.mkdir();(directory/'member').write_bytes(b'owned')
    alias=ns['OUT']/'bin-alias';alias.symlink_to(directory)
    def directory_alias():
        sources=set();ns['alias_target'](alias,sources)
        assert sources==set() and len(ns['directories'])==1 and ns['directories'][0]['names']==['member']
        ns['final_verify']();return {k:v for k,v in ns['directories'][0].items() if k!='fd'}
    run('directory_target_not_added_to_strict_files',directory_alias,'ACTUAL_HOST_DIRECTORY_AND_ALL9; ALIAS_OPEN_EFFECT_SUBSTITUTED_NOT_LINUX_OPATH')
    def directory_drift():
        (directory/'new-member').write_bytes(b'change')
        try:ns['final_verify']()
        except ValueError as e:assert str(e)=='FINAL_DIRECTORY_MEMBERSHIP_NINE';return {'rejected':str(e)}
        raise AssertionError('directory drift accepted')
    run('held_directory_mutation_rejected',directory_drift,'ACTUAL_HOST_DIRECTORY_DRIFT_NOT_NATIVE_LINUX')
    def regular_reject():
        file=ns['OUT']/'hard-original';file.write_bytes(b'owned');os.link(file,ns['OUT']/'hard-link')
        try:ns['capture'](file)
        except ValueError as e:assert str(e)=='RUNTIME_REGULAR_SINGLE_LINK_SOURCE';return {'rejected':str(e),'nlink':os.lstat(file).st_nlink}
        raise AssertionError('hardlink source accepted')
    run('actual_strict_runtime_hardlink_rejection',regular_reject,'ACTUAL_HOST_FILE_TYPE_NLINK; RESOURCE_READ_EFFECT_SUBSTITUTED')
    for row in ns['directories']:os.close(row['fd'])
    save('independent-controls.json',{'checks':checks,'count':len(checks),'actualNativeRuntime':'HELD','Docker':False,'subjects':False,'ROOT':'ABSENT'})
def main():
    mode=sys.argv[1]
    if mode in ['pre','post']:bind(mode)
    elif mode=='checks':source_checks();host_controls()
    else:raise ValueError(mode)
    print(json.dumps({'mode':mode,'status':'ASSERTIONS_PASSED'}))
if __name__=='__main__':
    try:main()
    except BaseException as e:
        import traceback
        target='reviewer-'+sys.argv[1]+'-failure-'+str(time.time_ns())+'.json'
        save(target,{'type':type(e).__name__,'error':str(e),'traceback':traceback.format_exc(),'producerSourceModified':False})
        raise
