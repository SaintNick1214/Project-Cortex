"""Independent actual CI content/capability review. No Docker or extraction."""
from pathlib import Path, PurePosixPath
import copy, hashlib, importlib.util, io, json, os, posixpath, re, stat, tarfile, types, zipfile
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';P=QA/'local-resume-2026-10-05'
C=QA/'task04-c8-physical-preparation-r3/native-ci-actual-attempt2';OUT=Path(__file__).parent
S=R/'work/resume/task04-c8-physical-preparation-r3/native-ci-a5-repair3'
spec=importlib.util.spec_from_file_location('ci_independent_readcheck',P/'task03-attempt5-public-repair2-review/readcheck.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
read,manifest,dump,identity=h.read,h.manifest,h.dump,h.identity
value,pin,receiptrows=manifest(C,'receipt-manifest.json',58,'1edd60445a2f15d57784a8690b6c270a785e48c7b28c0aae7e3ef70bf63ddc4c')
dump(OUT/'raw/current-receipt-58-recheck.json',{'manifest':pin,'members':receiptrows,'allNineFullBytesEOF':True})
zip_path=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task04-native-ci-37444733993-1/artifact.zip')
pre=identity(zip_path.lstat());fd=os.open(zip_path,os.O_RDONLY|os.O_NOFOLLOW)
try:
    assert identity(os.fstat(fd))==pre and stat.S_ISREG(int(pre['mode'])) and pre['nlink']=='1'
    digest=hashlib.sha256();size=0
    while True:
        block=os.read(fd,1048576)
        if not block:break
        digest.update(block);size+=len(block)
    assert identity(os.fstat(fd))==identity(zip_path.lstat())==pre
finally:os.close(fd)
assert size==159840855 and digest.hexdigest()=='8e98e28f901ff227bb94a04e8dd5280613ca3524091a8ff0386405c353273a58'
zipproof={'path':str(zip_path),'bytes':size,'sha256':digest.hexdigest(),'PRE':pre,'POST':pre,'pathPOST':pre,'EOF':True,'copiedOrExtracted':False,'retainOnlyExternalCopy':True}
z=zipfile.ZipFile(zip_path);infos=z.infolist();names=[i.filename for i in infos]
assert len(names)==len(set(names))==2113 and not any(i.is_dir() or '..' in PurePosixPath(i.filename).parts or i.filename.startswith('/') for i in infos)
assert not any(stat.S_ISLNK(i.external_attr>>16) for i in infos)
inventory=json.loads(read(C/'artifact-member-inventory.json')[0]);assert len(inventory['members'])==len(infos)
observed={i.filename:i for i in infos}
for row in inventory['members']:
    member=observed[row['path']];assert member.file_size==row['bytes'] and member.compress_size==row['compressedBytes'] and member.CRC==row['CRC']
assert sum(i.file_size for i in infos)==inventory['totalUncompressedBytes']
capraw=z.read('export/native-capability.json');assert capraw==read(C/'raw/export/native-capability.json')[0]
cap=json.loads(capraw);assert cap['status']=='NATIVE_INFRASTRUCTURE_CAPABILITY_AND_SOURCE_CAPTURE_COMPLETE_NOT_SUBJECT_QUALIFICATION'
FIELDS=set(h.FIELDS)
def native_identity(value):
    assert value['schema']=='FS_IDENTITY_DECIMAL_V1' and set(value['fields'])==FIELDS
    assert all(type(x) is str and re.fullmatch(r'[0-9]+',x) for x in value['fields'].values())
    return value['fields']
def same9(row):
    a=native_identity(row['PRE']);assert a==native_identity(row['POST'])==native_identity(row['pathPOST']);return a
files=cap['files'];assert len(files)==2063 and len({r['path'] for r in files})==2063 and len({r['rawExactBacking'] for r in files})==2063
assert {i.filename for i in infos if i.filename.startswith('export/source-backings/')}=={'export/'+r['rawExactBacking'] for r in files}
proofs=[];sourcebodies={};total=0
for row in files:
    src=same9(row);assert stat.S_ISREG(int(src['mode'])) and src['nlink']=='1' and int(src['size'])==row['bytes'] and row['EOF'] is True
    backing=native_identity(row['rawBackingIdentity']);assert stat.S_ISREG(int(backing['mode'])) and backing['nlink']=='1' and backing['uid']==backing['gid']=='0' and int(backing['size'])==row['bytes'] and stat.S_IMODE(int(backing['mode']))==0o600
    assert row['actualOwnedBackingAdviceReturn'] is None
    member=observed['export/'+row['rawExactBacking']];assert member.file_size==row['bytes']
    digest=hashlib.sha256();n=0;blocks=[] if row['path'].startswith('/source/') else None
    with z.open(member) as stream:
        while True:
            block=stream.read(1048576)
            if not block:break
            n+=len(block);digest.update(block)
            if blocks is not None:blocks.append(block)
        assert stream.read(1)==b''
    assert n==row['bytes'] and digest.hexdigest()==row['sha256']
    total+=n
    if blocks is not None:sourcebodies[row['path']]=b''.join(blocks)
    proofs.append({'path':row['path'],'rawExactBacking':row['rawExactBacking'],'bytes':n,'sha256':digest.hexdigest(),'ZIPmemberCRCReadToEOF':True,'nativeAllNine':row['PRE'],'nativeAllNineEquality':'PASS','reviewerNativeIdentityReacquisition':False})
assert total==155019678==cap['rawSourceBackingBytes']
metadata=[]
for member in infos:
    if member.filename.startswith('export/source-backings/'):continue
    raw=z.read(member);local,p=read(C/'raw'/member.filename);assert raw==local
    metadata.append({'path':member.filename,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'archiveAndLocalFullBytesMatch':True,'CRCReadToEOF':True})
assert identity(zip_path.lstat())==pre
z.close()
dump(OUT/'raw/independent-complete-zip-source-backing-proof.json',{'archive':zipproof,'allSourceBackings':proofs,'sourceBackingFiles':2063,'sourceBackingBytes':total,'metadataMembers':metadata,'allArchiveMembers':2113,'sourceBodiesBulkExtracted':False,'historicalCustodyRepaired':False,'nativeOwnerAuthorityReacquired':False})
declared=json.loads(sourcebodies['/source/ci-source-manifest.json']);assert len(declared['files'])==16
declaredproof=[]
for row in declared['files']:
    raw=sourcebodies['/source/'+row['path']];assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256']
    actual,local=read(S/row['path']);assert actual==raw
    declaredproof.append({'path':row['path'],'bytes':len(raw),'sha256':row['sha256'],'captureVsReviewedCurrentFullBytes':'PASS','currentReadAllNine':local['PRE']})
assert read(R/'.github/workflows/task04-c8-native-infrastructure.yml')[0]==sourcebodies['/source/task04-c8-native-infrastructure.yml.proposed']
assert hashlib.sha256(sourcebodies['/source/ci-source-manifest.json']).hexdigest()==json.loads(read(C/'raw/host-preflight.json')[0])['sourceManifestSHA256']
aliases=[]
for row in cap['aliases']:
    ident=same9(row);assert stat.S_ISLNK(int(ident['mode']))
    target=bytes.fromhex(row['targetHex']);assert len(target)==int(ident['size'])
    aliases.append({'path':row['path'],'literalTargetHex':row['targetHex'],'nativeAllNine':row['PRE'],'aliasNotRegularFile':True})
assert len(aliases)==6
dirs=[]
for row in cap['directories']:
    ident=same9(row);assert stat.S_ISDIR(int(ident['mode']))
    assert row['names']==sorted(set(row['names'])) and all('/' not in n and n not in ('.','..') for n in row['names'])
    dirs.append({'path':row['path'],'nativeAllNine':row['PRE'],'literalMemberCount':len(row['names']),'names':row['names']})
assert len(dirs)==475
allpaths={r['path'] for r in files}|{r['path'] for r in cap['aliases']}|{r['path'] for r in cap['directories']}
for row in cap['directories']:
    if row['path'].startswith('/usr/local/lib/node_modules/npm'):
        assert {posixpath.basename(p) for p in allpaths if posixpath.dirname(p)==row['path']}==set(row['names']),row['path']
maps=[]
sourcepaths={r['path'] for r in files}
for row in cap['maps']:
    paths=set()
    for line in row['rawMaps'].splitlines():
        split=line.split(maxsplit=5)
        if len(split)==6 and split[5].startswith('/'):
            p=split[5].replace('\\040',' ').replace('\\011','\t').replace('\\012','\n').replace('\\134','\\');assert not p.endswith(' (deleted)');paths.add(p)
    assert paths==set(row['paths']) and paths<=sourcepaths
    maps.append({'pid':row['pid'],'completeMappedRegularPaths':sorted(paths),'allHaveCompleteExactBacking':True})
nominal_uncaptured_caches=[]
for row in cap['PythonImportOriginsAndCaches']:
    for path in (row['origin'],):
        if path and path.startswith('/'):
            resolved=posixpath.normpath(path)
            if resolved.startswith('/usr/local/lib/python3.12/'):assert resolved in sourcepaths,resolved
    if row['cache'] and row['cache'] not in sourcepaths:
        # __cached__ names are nominal even when bytecode does not exist. Exact
        # collector captures any existing file at origin OR cache; do not assert
        # nominal names were opened, or invent their absent bytes as a backing.
        assert row['origin'] in sourcepaths
        nominal_uncaptured_caches.append({'module':row['module'],'nominalCache':row['cache'],'operativeOriginBacking':row['origin'],'captureDisposition':'Not an existing regular cache in executed collector membership; not independently reacquired after owner expiry'})
dump(OUT/'raw/native-files-aliases-directories-maps-and-exact-sources.json',{'declaredSourceCount':16,'declaredSources':declaredproof,'aliases':aliases,'directories':dirs,'maps':maps,'PythonImports':cap['PythonImportOriginsAndCaches'],'nominalUncapturedCaches':nominal_uncaptured_caches,'nativeAllNineScope':'Captured all-nine receipts from this job; owner now expired'})
env=cap['environment'];assert env['PATH']=='/usr/local/bin:/usr/bin:/bin' and env['HOME']=='/phase/home' and env['TMPDIR']=='/tmp' and env['PYTHONDONTWRITEBYTECODE']=='1'
assert cap['nodeVersion']=='v24.15.0' and cap['npmVersion']=='12.2.0' and cap['pythonVersion'].startswith('3.12.15 ') and cap['architecture']=='x86_64'
assert cap['ownerPRE']==cap['ownerPOST'] and bytes.fromhex(cap['ownerPRE']['rawArgvHex'])==b'/usr/local/bin/python3.12\0/source/native-owner.py\0'
assert bytes.fromhex(cap['nodeKernelBinding']['rawArgvHex'])==b'\0'.join(os.fsencode(a) for a in cap['nodeRequestedArgv'])+b'\0'
assert cap['actualOwnerPidfdOpen'] is True and cap['actualNodePidfdOpen'] is True and cap['actualOwnerSignal0Return'] is cap['actualNodeSignal0Return'] is cap['actualNodeTerminationSignalReturn'] is None
assert cap['actualOwnerLivePoll']==[] and cap['actualNodeExit']==-15 and cap['actualNodeTerminationSignal']=='SIGTERM_VIA_PIDFD' and cap['actualNodeTerminalPoll'] and cap['actualLifecycleCloseErrors']==[]
for probe,want in zip(cap['actualVersionCommands'],[b'v24.15.0\n',b'linux x64\n',b'12.2.0\n']):
    assert bytes.fromhex(probe['stdout'])==want and probe['stderr']=='' and probe['exit']==0 and probe['terminal'] is True and probe['closeErrors']==[]
    assert probe['authorityMode']=='NATIVE_REQUIRED_PIDFD' and probe['actualChildPidfdOpen'] is True and probe['actualChildTerminalPoll'] and probe['actualChildPidfdCloseReturn'] is None
assert cap['literalReserveMinimum']>=536870912 and cap['literalResourceCheckCount']==6582
for row in cap['resourceSnapshots']:
    assert row['memoryMax']=='6442450944' and row['memorySwapMax']=='0'
    assert int(row['memoryMax'])-int(row['memoryCurrent'])==row['literalReserveBytes']>=row['requiredReserveBytes']
    assert row['diskStatvfs']['f_frsize']<=4096 and row['diskStatvfs']['f_bavail']*row['diskStatvfs']['f_frsize']>=553648128
    for target in ['/phase','/tmp']:
        lines=[l for l in row['mountinfo'].splitlines() if l.split()[4]==target];assert len(lines)==1 and lines[0].split(' - ')[1].split()[0] not in ['tmpfs','ramfs']
before=json.loads(read(C/'raw/owner-before.json')[0]);after=json.loads(read(C/'raw/owner-after-capture.json')[0]);terminal=json.loads(read(C/'raw/owner-terminal.json')[0]);obj=terminal['inspect']
assert before['Id']==after['Id']==obj['Id'] and before['State']['StartedAt']==after['State']['StartedAt']==obj['State']['StartedAt']
assert before['State']['Pid']==after['State']['Pid']>0 and before['State']['Running'] is after['State']['Running'] is True
assert before['HostConfig']['Memory']==before['HostConfig']['MemorySwap']==6442450944 and before['HostConfig']['NetworkMode']=='none' and before['HostConfig']['ReadonlyRootfs'] is True and before['HostConfig']['PidsLimit']==128
assert terminal['dockerStopExit']==0 and obj['State']['Running'] is False and obj['State']['Pid']==0 and obj['State']['ExitCode']==0 and obj['State']['OOMKilled'] is False
commandproof=[]
for n in range(13):
    receipt=json.loads(read(C/'raw/command-receipts'/('command-'+str(n).zfill(5)+'.json'))[0]);assert receipt['terminal'] is True and receipt['closeErrors']==[]
    for stream in ['stdout','stderr']:read(C/'raw/command-receipts'/receipt[stream]['path'],receipt[stream])
    commandproof.append(receipt)
assert json.loads(read(C/'raw/capture-command.json')[0])['exit']==0
transport=json.loads(read(C/'raw/export-transport.json')[0]);t=transport['tarRecordTermination']
assert transport['exit']==0 and transport['terminal'] is True and transport['stderr']=='' and transport['stdoutBytes']==161034240
assert t=={'scope':'EXACT_FINITE_GNU_TAR_RECORD_TERMINATION_ONLY','lastMemberEnd':161025536,'firstZeroBlockBytes':512,'remainingZeroPaddingBytes':8192,'recordBytes':10240,'streamBytes':161034240,'exactPhysicalEOF':True,'arbitraryTrailingBytesAccepted':False}
assert t['lastMemberEnd']+t['firstZeroBlockBytes']+t['remainingZeroPaddingBytes']==t['streamBytes'] and t['streamBytes']%10240==0
# Fresh small host parser outcome controls on exact captured code, no Docker.
parser={};exec(compile(sourcebodies['/source/tar_export.py'],'captured_tar_export.py','exec'),parser)
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w',format=tarfile.GNU_FORMAT) as tf:
    ti=tarfile.TarInfo('native-capability.json');ti.size=2049;tf.addfile(ti,io.BytesIO(b'PUBLIC-DUMMY-'*157+b'x'*8))
small=buf.getvalue();last=512+((2049+511)//512)*512
parserproof=[]
for name,data,reject in [('exact-GNU-record',small,False),('nonzero-second-zero',small[:last+512]+b'x'+small[last+513:],True),('truncated-second-zero',small[:last+700],True),('extra-record',small+b'\0'*10240,True),('extra-byte',small+b'x',True),('missing-first-zero',small[:last]+b'x'*512+small[last+512:],True)]:
    error=None;result=None
    try:
        with tarfile.open(fileobj=io.BytesIO(data),mode='r|') as tf:
            tracked=parser['TrackedTarReader'](tf.fileobj);tf.fileobj=tracked
            for member in tf:
                with tf.extractfile(member) as stream:
                    got=stream.read();assert len(got)==member.size
            result=parser['finish_tar_record'](tf,tracked)
    except (ValueError,tarfile.ReadError) as exc:error=str(exc)
    assert bool(error)==reject,(name,error,result)
    parserproof.append({'name':name,'expectedRejected':reject,'observedRejected':bool(error),'error':error,'result':result,'DockerCalls':0})
dump(OUT/'raw/actual-lifecycle-command-resource-and-tar-receipt-crosscheck.json',{'nativeVersions':{'Node':cap['nodeVersion'],'npm':cap['npmVersion'],'Python':cap['pythonVersion'],'arch':cap['architecture']},'ownerPRE':cap['ownerPRE'],'ownerPOST':cap['ownerPOST'],'nodeKernelBinding':cap['nodeKernelBinding'],'actualOwnerNodePidfdReceipts':True,'actualNativeCloseErrors':cap['actualLifecycleCloseErrors'],'actualVersionCommands':cap['actualVersionCommands'],'environment':env,'resourceSnapshots':cap['resourceSnapshots'],'literalReserveMinimum':cap['literalReserveMinimum'],'literalResourceChecks':cap['literalResourceCheckCount'],'bootstrapCommandReceipts':commandproof,'tarReceipt':t,'independentParserControls':parserproof,'originalFullTarStreamRetained':False,'tarEvidenceScope':'Exact executed collector/source/terminal/receipt cross-check and fresh parser controls; original tar byte replay unavailable. ZIP source members fully independently streamed.','ownerStoppedTerminalPID':0,'ownerAuthority':'EXPIRED_NOT_PHYSICAL_AUTHORITY','noContainerOrVolumeDeletion':terminal['noContainerOrVolumeDeletion']})
run=json.loads(read(C/'run-primary.json')[0]);jobs=json.loads(read(C/'jobs-primary.json')[0]);assert run['id']==37444733993 and run['run_attempt']==1 and run['head_sha']=='e0573bde765f9c9b7bd3f2b503ad9dc27b3977fe' and run['status']=='completed' and run['conclusion']=='success'
assert jobs['jobs'][0]['conclusion']=='success' and all(s['conclusion']=='success' for s in jobs['jobs'][0]['steps'])
assert cap['subjectImports'] is False and cap['cohortsMaterialized'] is False and cap['ROOT']=='ABSENT' and cap['originalGates']=='122_EIGHT20_WHOLE120_FULLRPC_501_301_UNCHANGED'
history={}
for label,path in [('originalCI',C.parent/'native-ci-actual-attempt1/parent-observation.json'),('originalRejectedSeal',P/'task04-native-ci-repair3-review/verdict.json'),('prospectiveSourceOnly',P/'task04-native-ci-repair3-prospective2-review/verdict.json')]:history[label]=json.loads(read(path)[0])
assert history['originalCI']['overall']=='FAIL' and history['originalCI']['originalTrailingByteValues']=='UNAVAILABLE_UNKNOWN'
assert history['originalRejectedSeal']['verdict']=='REJECT' and history['prospectiveSourceOnly']['verdict']=='PASS'
dump(OUT/'raw/scope-history-and-held-next-inputs.json',{'runId':run['id'],'attempt':run['run_attempt'],'headSha':run['head_sha'],'actualJob':'success','history':history,'sevenCanonicalInputs':'HELD_NOT_GENERATED_BY_THIS_JOB','sourceGeneratorStatus':'Current initial-native job captures infrastructure only. No field-complete producer/generator is implemented and wired in this job for current package-graph, original-read-map, historical-plan-index, package-aliases, mirror-source-transform-map, finite-producer-rules and prepared-source-inputs. Preserved historical JSON and old candidate scripts are references, not current Linux schemas/identities. This is implementation/preparation work, not established missing external credentials.','physicalMaterialization':'HELD_EXCLUSIVE_COHORT_AND_CURRENT_LINUX_BINDING_REQUIRED','original122':'HELD_ALL_ORIGINAL_COMMANDS_AND_ASSERTIONS','ROOT':'ABSENT','Task04Accepted':False,'goalAccepted':False,'current03FoundationAcceptanceRequired':True,'allCapturedSourceBytesRecoverableFromGit':False,'historicalCustodyRestored':False,'externalOnlyInputs':'Any genuinely external missing object can be named only after field-complete schema/membership and exact missing-byte inventory; no credential gate established by this scope.'})
dump(OUT/'raw/summary.json',{'status':'PASS_ACTUAL_INITIAL_NATIVE_INFRASTRUCTURE_AND_COMPLETE_SOURCE_CONTENT_ONLY','receiptManifestSha256':pin['sha256'],'archive':zipproof,'runId':37444733993,'attempt':1,'headSha':run['head_sha'],'sourceBackingFiles':2063,'sourceBackingBytes':total,'nativeAliases':6,'nativeDirectories':475,'capturedReviewedSources':16,'independentParserControls':len(parserproof),'actualNativeOwnerAndNodePidfdReceipts':True,'ownerBinding':'EXPIRED_STOPPED_TERMINAL_PID0','enablingAttestationWritten':False,'physicalAdmissionAccepted':False,'Task04Accepted':False,'goalAccepted':False})
print(json.dumps({'status':'PASS_BOUNDED_ACTUAL','sourceBackingsIndependentlyStreamed':2063,'sourceBytes':total,'ownerAuthority':'EXPIRED','Task04Accepted':False}))
