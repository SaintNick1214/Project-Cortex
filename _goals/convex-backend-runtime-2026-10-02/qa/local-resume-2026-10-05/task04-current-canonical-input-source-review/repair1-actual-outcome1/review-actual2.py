"""Finite failed repair1 outcome forensic checks only; no actual commands/imports."""
import ast
import hashlib
import json
import os
from pathlib import Path
import stat
import types

R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
B=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
RUN=B/'task04-current-producer-linux-public-repair1'
W=R/'work/resume/task04-c8-current-canonical-input-producers/repair1'
BASE=B/'task04-current-producer-repair1-current-source-baseline1'
SOURCE_D=B/'task04-current-canonical-input-source-review/repair1-current-source-review2'
D=Path(__file__).resolve().parent
CID='8683039783b5eadd4771170f6b923ba10e2cd8c138ec69e847faf47160e132dc'
OP='f83336fb-794a-4878-87ec-f85612ade6a6'
NAME='cortex-task04-current-producer-public-repair1'
GUEST='/var/tmp/task04-c8-producer-repair1/'
FOREIGN='b551bbf5025aba25568eb1bb6fb42009edf15d31e39771fea617d2fbccea034c'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
ident=lambda s:{k:str(getattr(s,'st_'+k))for k in FIELDS}
observations=[];fds=[];checks=[];errors=[];proofs={}
def read(path,maximum=16777216):
    pre=os.lstat(path);assert stat.S_ISREG(pre.st_mode)and pre.st_nlink==1 and pre.st_size<=maximum and path.resolve()==path
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);fds.append((path,fd,ident(pre)));opened=os.fstat(fd);raw=bytearray()
    while part:=os.read(fd,65536):raw.extend(part);assert len(raw)<=maximum
    post=os.fstat(fd);final=os.lstat(path);assert ident(pre)==ident(opened)==ident(post)==ident(final)and len(raw)==pre.st_size
    row={'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'PRE':ident(pre),'OPEN':ident(opened),'POST':ident(post),'pathPOST':ident(final),'EOF':True};observations.append(row)
    return bytes(raw),row
def data(path,maximum=262144):return json.loads(read(path,maximum)[0])
def cli(label,argv=None,exitcode=0):
    row=data(RUN/'raw'/(label+'.receipt.json'),65536);out=read(RUN/'raw'/(label+'.stdout'),262144)[0];err=read(RUN/'raw'/(label+'.stderr'),262144)[0]
    assert row['terminal']is True and row['failureClass']is None and row['closeErrors']==[]and row['ownedGroup']['absenceObserved']is True and row['stdinBytes']==0
    assert type(row['exitCode'])is int and row['exitCode']==exitcode and row['elapsedSeconds']<=30
    assert row['argv'][0]=='docker'and (argv is None or row['argv']==argv)
    assert row['streamByteCounts']=={'stdout':len(out),'stderr':len(err)}and row['stdoutSha256']==hashlib.sha256(out).hexdigest()and row['stderrSha256']==hashlib.sha256(err).hexdigest()
    return row,out,err
def passcheck(name,detail):checks.append({'name':name,'status':'PASS_FORENSIC_ONLY','evidence':detail})
try:
    handoff=data(RUN/'actual-failed-public-handoff.json');assert handoff['parentWriters']=='STOPPED_AFTER_THIS_HANDOFF'and handoff['status']=='FAILED_CLOSED_ACTUAL_PUBLIC_ATTEMPT'and handoff['containerId']==CID and handoff['operationUUID']==OP and handoff['controlsCompleted']==0
    mfraw,mfrow=read(BASE/'operative-source-manifest2.json',262144);assert mfrow['sha256']=='5fc499d7e1f61a3abb169e796e4b7e466a2f2bc0d6a56853f05aebb9f056eeef';mf=json.loads(mfraw)
    for pin in mf['files']:
        raw,row=read(R/pin['path']);assert row['sha256']==pin['sha256']and row['bytes']==pin['bytes']and row['PRE']==pin['PRE']['fields'],('current-operative',pin['path'])
    for name,sha in [('verdict.json','8d474d8d480651393e8557b38d17843e044643d7875e9ad11555fcbb22df9929'),('report.md','e370cc83969d40592870925823f75b6ac88be4922e5b5f3b51b7a72cc6eef229'),('finite-evidence-manifest.json','9d8aa13753902539136ed52c5c914d3721d1b92ff14f2c95c8a21c0389d5b4f9')]:
        raw,row=read(SOURCE_D/name,262144);assert row['sha256']==sha
    release=data(RUN/'independent-source-release.json');assert release['verdict']=='PASS'and release['operationUUID']==OP and release['reviewSHA256']=='8d474d8d480651393e8557b38d17843e044643d7875e9ad11555fcbb22df9929'and release['operativeSourceManifestSHA256']==mfrow['sha256']
    source=data(RUN/'parent-initial-source-check.json');before=data(RUN/'before-start-proof.json');assert before['status']=='PASS'and len(before['sourceObservations'])==22
    pins={r['path']:r for r in mf['files']}
    for row in before['sourceObservations']:
        pin=pins[row['path']];assert row['bytes']==pin['bytes']and row['sha256']==pin['sha256']and row['currentNine']==pin['PRE']['fields']and row['EOF']is True
    passcheck('exact22-actual-source-release-and-preserved-current-source-verdict',{'files':22,'manifestSHA256':mfrow['sha256'],'notFunctionalAcceptance':True})
    recipe=data(W/'proposal/recipe.json');module_raw,_=read(B/'task04-current-producer-repair1-parent-preparation/metadata-module.py');meta=types.ModuleType('finite_review_metadata');exec(compile(module_raw,'reviewed_metadata_helper','exec'),meta.__dict__)
    failure=data(RUN/'parent-readonly-preflight1-failure.json');assert failure['status']=='FAILED_ROOT_READONLY_PREFLIGHT'and failure['effects']=='READONLY_ONLY_NO_CREATE_START'
    for label in ('new-volume-absence1','new-volume-absence2'):
        _,out,err=cli(label,['docker','volume','inspect','--format','{{json .Name}}',NAME],1);assert out==b'\n'and err==('Error response from daemon: get '+NAME+': no such volume\n').encode()
    for label in ('new-container-absence1','new-container-absence2','new-container-absence3'):
        _,out,err=cli(label,['docker','container','inspect','--format','{{json .Id}}',NAME],1);assert out==b'\n'and err==('Error response from daemon: No such container: '+NAME+'\n').encode()
    fresh=data(RUN/'parent-fresh-readonly-preflight2.json');assert fresh['status']=='PASS'and fresh['priorRootReadOnlyAssertion']=='FAILED_PRESERVED_NOT_RELABELED'
    attempt=data(RUN/'owned-create-attempt.json');assert attempt['operationUUID']==OP and attempt['independentSourceReviewSHA256']==release['reviewSHA256']
    _,out,err=cli('volume-create1',attempt['volumeCreateArgv']);assert out==(NAME+'\n').encode()and err==b''
    _,out,err=cli('container-create1',attempt['containerCreateArgv']);assert out==(CID+'\n').encode()and err==b''
    volume_proof=data(RUN/'owned-volume-create-proof.json');assert volume_proof['status']=='PASS'
    for label in ('owned-volume-inspect1','before-start-volume-inspect1'):
        _,out,err=cli(label,['docker','volume','inspect',NAME]);assert err==b'';volume=json.loads(out)[0]
        assert volume==volume_proof['volume']and volume['Labels']==recipe['ownershipBeforeEffects']['volumeInspectRequired']['Labels']and volume['Driver']==volume['Scope']=='local'and volume['Options']is None
    inspected={};byte_sum=0
    for label,created,counted in [('created-container-inspect1',True,False),('before-start-inspect1',True,True)]+[(f'owned-poll-{i:04}',False,True)for i in range(1,9)]+[('failure-owned-inspect1',False,True),('before-export-terminal-inspect1',False,False),('final-owned-terminal-inspect1',False,False)]:
        _,out,err=cli(label,['docker','container','inspect',CID]);assert err==b''and len(out)<=65536;parsed=json.loads(out);assert type(parsed)is list and len(parsed)==1;c=parsed[0];proof=meta.validate(c,recipe,CID,created=created);assert proof['coordinateChoice']=='desktopSourceLiteral';inspected[label]=c
        if counted:byte_sum+=len(out)
    createdproof=data(RUN/'created-container-proof.json');id_record=data(RUN/'created-container-id.json');assert createdproof['containerId']==id_record['containerId']==CID
    _,out,err=cli('container-start1',['docker','start',CID]);assert out==(CID+'\n').encode()and err==b''
    terminal=data(RUN/'terminal-run-result.json');state=inspected['final-owned-terminal-inspect1']['State'];assert terminal['status']=='FAIL'and terminal['terminalState']==state==handoff['terminalState']and terminal['polls']==8 and terminal['combinedRawInspectBytes']==byte_sum==129828
    assert state['Status']=='exited'and state['Running']is False and type(state['Pid'])is int and state['Pid']==0 and type(state['ExitCode'])is int and state['ExitCode']==1 and state['OOMKilled']is False and state['Error']==''
    assert terminal['errors']==["RuntimeError('actual public run terminal failure')"]and terminal['elapsedSeconds']<=480
    assert not(RUN/'raw/failure-owned-stop1.receipt.json').exists()
    logs=cli('terminal-container-logs1',['docker','logs',CID]);assert b'SYNTHETIC_SCOPE_CANNOT_BECOME_NATIVE_AUTHORITY'in logs[1]+logs[2]
    _,inventory,err=cli('running-public-inventory1');assert err==b''and FOREIGN.encode()in inventory
    daemon=cli('daemon-info1');image=cli('image-info1');assert daemon[2]==image[2]==b''
    passcheck('fresh-labelled-owned-public-attempt-natural-terminal-failure',{'containerId':CID,'exit':1,'PID':0,'OOMKilled':False,'polls':8,'combinedInspectBytes':byte_sum,'metadataFailure':False,'foreignActions':False,'noStopNeeded':True})
    exported=data(RUN/'exports/public-export-manifest.json');bootstrap_raw,_=read(W/'proposal/bootstrap.py');tree=ast.parse(bootstrap_raw);allow=ast.literal_eval(next(n.value for n in tree.body if isinstance(n,ast.Assign)and any(isinstance(t,ast.Name)and t.id=='EXPORT_ALLOWLIST'for t in n.targets)))
    assert len(allow)==23 and [r['relativePath']for r in exported['files']]==list(allow)and exported['fileCount']==23 and exported['allDescendantsTerminal']is True and exported['combinedExportBytesMaxIncludingThisManifest']==1048576
    assert exported['ROOT']=='ABSENT'and exported['nativeClaims']is False and exported['original122']=='HELD'
    manifest_row=next(row for row in observations if row['path']==str(RUN/'exports/public-export-manifest.json'))
    _,cpout,cperr=cli('export-manifest-copy1',['docker','cp',CID+':'+GUEST+'public-export-manifest.json',str(RUN/'exports/public-export-manifest.json')]);assert cpout==cperr==b''
    export_rows=[];absent=[]
    for i,row in enumerate(exported['files'],1):
        path=RUN/'exports'/row['relativePath']
        if row['status']=='ABSENT':assert not os.path.lexists(path);absent.append(row['relativePath']);continue
        assert row['status']=='EXISTS';pin=row['current'];assert pin['path']==GUEST+row['relativePath']and pin['EOF']is True
        assert pin['PRE']==pin['OPEN']==pin['POST']==pin['pathPOST']and pin['PRE']['fields']['nlink']=='1'
        raw,observed=read(path,1048576);assert observed['sha256']==pin['sha256']and observed['bytes']==pin['bytes']
        _,cpout,cperr=cli(f'export-file-copy-{i:02}',['docker','cp',CID+':'+GUEST+row['relativePath'],str(path)]);assert cpout==cperr==b'';export_rows.append(observed)
    total=sum(x['bytes']for x in export_rows)+manifest_row['bytes'];assert len(export_rows)==17 and total==49185 and total<=1048576 and sum(x['bytes']for x in export_rows)==exported['existingBytes']
    prior=data(RUN/'export-validation-result.json');fresh=data(RUN/'post-failure-public-export-current-observation1.json');assert prior['status']=='FAIL'and prior['errors']==["RuntimeError('final held-FD/path nine fields')"]and fresh['status']=='PASS'and fresh['bytes']==49185 and fresh['errors']==[]
    assert len(fresh['priorSealDeltas'])==18 and all(r['changedFields']==['ctime_ns']and r['classification']=='UNKNOWN'for r in fresh['priorSealDeltas'])
    partial=data(RUN/'exports/controls/linux-public-repair1/partial-results.json');stderr=read(RUN/'exports/control-run.stderr',65536)[0];child=data(RUN/'exports/control-run.terminal.json');assert partial['controls']==[]and partial['failure']['message']=='SYNTHETIC_SCOPE_CANNOT_BECOME_NATIVE_AUTHORITY'and child['actualExitCode']==1 and child['cleanupErrors']==[]and child['allDescendantsTerminal']is True
    assert child['streamBytes']==[0,len(stderr)]and b'SYNTHETIC_SCOPE_CANNOT_BECOME_NATIVE_AUTHORITY'in stderr
    marker='task04-c8-current-canonical-input-producers/controls/';root=GUEST+'controls';assert marker not in root+'/'
    passcheck('unchanged-synthetic-root-literal-denial-before-first48',{'guestRoot':GUEST,'ownedControlsRoot':root,'requiredLiteral':marker,'containsLiteral':False,'actualControls':0,'actualExitCode':1,'allDescendantsTerminal':True})
    passcheck('17-finite-byte-matches-plus-manifest-not-historical-seal-repair',{'exportFiles':18,'bytes':total,'absentMembers':absent,'originalSeal':'FAIL','lateCtimeDeltas':18,'cause':'UNKNOWN','LinuxIdentityAdopted':False})
    resource=data(RUN/'exports/resource-observations.json');assert resource['scope']=='ACTUAL_PUBLIC_SOURCE_CONTROL_RESOURCE_ONLY'and resource['nativeClaims']is False and type(resource['checks'])is int and resource['checks']==158 and resource['firstFailedCheck']is None
    for value in(resource['first'],resource['last']):
        assert value['maximum']=='1073741824'and value['swapMaximum']=='0'and value['literalReserve']==int(value['maximum'])-int(value['current'])and value['allocationBlockBytes']==4096
        assert value['maintainedAvailableBytesRequired']==1073741824 and value['maintainedAvailableInodesRequired']==8192
    assert resource['first']['initialAdmission']is True and resource['first']['initialAvailableBytesRequired']==1997434880 and resource['first']['initialAvailableInodesRequired']==16384
    assert resource['minimumLiteralReserve']==838782976>=134217728 and resource['minimumAvailableBytes']==862096744448>=1073741824 and resource['minimumAvailableInodes']==59689369>=8192
    assert len(resource['allSnapshotSHA256'])==64 and resource['minimumLiteralReserve']<=min(resource['first']['literalReserve'],resource['last']['literalReserve'])
    passcheck('actual-public-resource-numeric-summary-never-native-qualification',{'checks':158,'minLiteralReserve':resource['minimumLiteralReserve'],'minAvailableBytes':resource['minimumAvailableBytes'],'minAvailableInodes':resource['minimumAvailableInodes'],'snapshotChain':'SUMMARY_ONLY_NO_REPLAY_OF_ALL158_SNAPSHOTS','native':False})
    runtime=data(RUN/'exports/runtime-observations.json');inputs=data(RUN/'exports/input-observations.json');assert len(inputs['files'])==14 and sum(x['bytes']for x in inputs['files'])==10823732
    assert len(runtime['regulars'])==3
    for name,version in [('node-version','v24.15.0'),('npm-version','12.2.0'),('python-version','Python 3.12.15')]:
        raw,_=read(RUN/'exports'/(name+'.stdout'));assert raw.decode().strip()==version;term=data(RUN/'exports'/(name+'.terminal.json'));assert term['actualExitCode']==0 and term['cleanupErrors']==[]and term['allDescendantsTerminal']is True
    for path,fd,pin in fds:assert pin==ident(os.fstat(fd))==ident(os.lstat(path)),('final-current-only',str(path))
except BaseException as error:errors.append(repr(error))
finally:
    for path,fd,pin in fds:os.close(fd)
result={'scope':'INDEPENDENT_FAILED_REPAIR1_ACTUAL_OUTCOME_FORENSIC_ONLY','status':'PASS_FORENSIC_VALIDATION'if not errors else'FAIL_FORENSIC_VALIDATION','functionalVerdict':'REJECT_ACTUAL_PUBLIC_PIPELINE_FAILED','checks':checks,'observations':observations,'errors':errors,'actualControlsCompleted':0,'original48':'FAILED_BEFORE_FIRST_ASSERTION','historicalSeals':'FAIL_CONSERVED_NOT_REFRESHED','currentReadRole':'EVIDENCE_ONLY_NOT_HISTORY_REPAIR','Docker':False,'native':False,'Task03':'HELD','Task04':'OPEN','wholeGoal':'OPEN'}
with(D/'actual-review-check2.json').open('x')as f:f.write(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':result['status'],'checks':len(checks),'finiteReads':len(observations),'errors':errors}));raise SystemExit(bool(errors))
