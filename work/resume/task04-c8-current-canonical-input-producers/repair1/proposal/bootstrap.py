"""Proposed isolated public controls only; no Docker action occurs in this file.

The parent owns activation. Inputs are only the reviewed source closure, a pinned
TypeScript parser source file and original command JSON used as reference data.
No original candidate imports, subjects, archives, packages or services are read.
"""
import hashlib
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import sys
import time

ROOT = Path('/var/tmp/task04-c8-producer-repair1')
OUTPUT = ROOT / 'controls/linux-public-repair1'
EXPORT_ALLOWLIST = ('public-control-receipt.json','bootstrap-failure.json','input-observations.json','runtime-observations.json',
    'control-run.stdout','control-run.stderr','control-run.terminal.json','node-version.stdout','node-version.stderr','node-version.terminal.json',
    'npm-version.stdout','npm-version.stderr','npm-version.terminal.json','python-version.stdout','python-version.stderr','python-version.terminal.json','resource-observations.json',
    'controls/linux-public-repair1/results.json','controls/linux-public-repair1/partial-results.json',
    'controls/linux-public-repair1/healthy/wiring-actual.stdout','controls/linux-public-repair1/healthy/wiring-actual.stdout.stderr',
    'controls/linux-public-repair1/healthy/consumer-adverse.stdout','controls/linux-public-repair1/healthy/consumer-adverse.stdout.stderr')
EXPORT_BYTES_MAX = 1048576
PUBLIC_INODE_ADMISSION = 8192
PUBLIC_DISK_ADMISSION = 1073741824
PUBLIC_WRITE_BYTE_CEILING = 923691060
PUBLIC_WRITE_INODE_CEILING = 8192
OWNED_PROCESS_EVENTS = []
ROOT_CREATED_BY_THIS_INVOCATION = False
RESOURCE_STATE = None
RESOURCE_OUTPUT_PIN = None
FIELDS = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
H = lambda data: hashlib.sha256(data).hexdigest()


def identity(value):
    return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{key:str(getattr(value,'st_'+key))for key in FIELDS}}


def record_resource(value, violations):
    """Durable bounded numeric observations on success AND failure; own output only."""
    global RESOURCE_STATE, RESOURCE_OUTPUT_PIN
    if not ROOT_CREATED_BY_THIS_INVOCATION:raise ValueError('NO_RESOURCE_WRITE_TO_PREEXISTING_ROOT')
    state=dict(RESOURCE_STATE or {'schema':'PUBLIC_RESOURCE_OBSERVATIONS_V1','scope':'ACTUAL_PUBLIC_SOURCE_CONTROL_RESOURCE_ONLY','checks':0,'first':value,
        'minimumLiteralReserve':value['literalReserve'],'minimumAvailableBytes':value['availableBytes'],'minimumAvailableInodes':value['availableInodes'],
        'allSnapshotSHA256':'','firstFailedCheck':None,'nativeClaims':False})
    state['checks']+=1;state['last']=value
    for field,current in [('minimumLiteralReserve','literalReserve'),('minimumAvailableBytes','availableBytes'),('minimumAvailableInodes','availableInodes')]:state[field]=min(state[field],value[current])
    state['allSnapshotSHA256']=H(state['allSnapshotSHA256'].encode()+json.dumps(value,sort_keys=True,separators=(',',':')).encode())
    if violations and state['firstFailedCheck'] is None:state['firstFailedCheck']={'check':state['checks'],'violations':violations,'snapshot':value}
    raw=(json.dumps(state,sort_keys=True,separators=(',',':'))+'\n').encode()
    if len(raw)>16384:raise ValueError('FINITE_RESOURCE_RECEIPT_BOUND')
    path=ROOT/'resource-observations.json'
    if RESOURCE_OUTPUT_PIN is None:fd=os.open(path,os.O_RDWR|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    else:
        if identity(os.lstat(path))!=RESOURCE_OUTPUT_PIN:raise ValueError('FOREIGN_RESOURCE_OUTPUT_REPLACEMENT')
        fd=os.open(path,os.O_RDWR|os.O_NOFOLLOW)
    try:
        opened=os.fstat(fd)
        if opened.st_nlink!=1 or path.resolve()!=path or (RESOURCE_OUTPUT_PIN is not None and identity(opened)!=RESOURCE_OUTPUT_PIN):raise ValueError('OWN_RESOURCE_OUTPUT_OPEN_IDENTITY')
        if RESOURCE_STATE is not None:
            prior=(json.dumps(RESOURCE_STATE,sort_keys=True,separators=(',',':'))+'\n').encode();observed=os.read(fd,16385)
            if observed!=prior:raise ValueError('FOREIGN_RESOURCE_OUTPUT_BYTES')
        os.lseek(fd,0,os.SEEK_SET);os.ftruncate(fd,0)
        remaining=memoryview(raw)
        while remaining:
            count=os.write(fd,remaining)
            if count<=0:raise ValueError('RESOURCE_RECEIPT_WRITE_RETURN')
            remaining=remaining[count:]
        os.fsync(fd);os.lseek(fd,0,os.SEEK_SET)
        if os.read(fd,16385)!=raw:raise ValueError('RESOURCE_RECEIPT_FULL_EOF_CONTENT')
        post=os.fstat(fd);final=os.lstat(path)
        if identity(post)!=identity(final):raise ValueError('RESOURCE_RECEIPT_FINAL_NINE')
        RESOURCE_STATE,RESOURCE_OUTPUT_PIN=state,identity(post)
    finally:os.close(fd)


def resource(initial=False):
    maximum = Path('/sys/fs/cgroup/memory.max').read_text().strip()
    current = Path('/sys/fs/cgroup/memory.current').read_text().strip()
    swap = Path('/sys/fs/cgroup/memory.swap.max').read_text().strip()
    fs = os.statvfs(ROOT)
    value = {'maximum':maximum,'current':current,'swapMaximum':swap,
             'literalReserve':int(maximum)-int(current),'availableBytes':fs.f_bavail*fs.f_frsize,
             'availableInodes':fs.f_favail,'allocationBlockBytes':fs.f_frsize,
             'maintainedAvailableBytesRequired':PUBLIC_DISK_ADMISSION,'maintainedAvailableInodesRequired':PUBLIC_INODE_ADMISSION,
             'initialAdmission':initial}
    violations=[]
    if maximum != '1073741824' or swap != '0' or value['literalReserve'] < 134217728:
        violations.append('PUBLIC_CONTROL_LITERAL_RESOURCE_HOLD')
    if value['availableBytes'] < PUBLIC_DISK_ADMISSION or value['availableInodes'] < PUBLIC_INODE_ADMISSION:
        violations.append('PUBLIC_CONTROL_FINITE_DISK_INODE_HOLD')
    if initial:
        initial_bytes=((PUBLIC_WRITE_BYTE_CEILING+PUBLIC_DISK_ADMISSION+fs.f_frsize-1)//fs.f_frsize)*fs.f_frsize
        value.update(initialAvailableBytesRequired=initial_bytes,initialAvailableInodesRequired=PUBLIC_WRITE_INODE_CEILING+PUBLIC_INODE_ADMISSION)
        if value['availableBytes']<initial_bytes or value['availableInodes']<value['initialAvailableInodesRequired']:
            violations.append('PUBLIC_CONTROL_INITIAL_WRITE_PLUS_MAINTAINED_RESERVE_HOLD')
    record_resource(value,violations)
    if violations:raise ValueError(violations[0]+':'+repr(value))
    return value


def copy_content(record):
    source, target = Path(record['source']), ROOT / record['destination']
    if target.exists() or target.is_symlink() or '..' in Path(record['destination']).parts:
        raise ValueError('NEW_OWNED_INPUT_ONLY')
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    before = os.lstat(source)
    if not source.is_file() or before.st_nlink != 1 or source.resolve() != source:
        raise ValueError('REGULAR_LITERAL_REVIEWED_INPUT')
    total, digest = 0, hashlib.sha256()
    fd = os.open(source, os.O_RDONLY|os.O_NOFOLLOW)
    try:
        opened=os.fstat(fd)
        if identity(before) != identity(opened): raise ValueError('COPY_OPEN_DRIFT')
        with open(target, 'xb') as output:
            os.chmod(target, 0o600)
            while block := os.read(fd, 65536):
                total += len(block)
                if total > record['bytes']: raise ValueError('COPY_INPUT_BOUND')
                digest.update(block); output.write(block)
            output.flush(); os.fsync(output.fileno())
        post=os.fstat(fd);path_post=os.lstat(source)
        if identity(before) != identity(post) or identity(before) != identity(path_post):
            raise ValueError('COPY_FULL_EOF_NINE_DRIFT')
    finally: os.close(fd)
    if total != record['bytes'] or digest.hexdigest() != record['sha256']:
        raise ValueError('REVIEWED_SOURCE_CONTENT_MISMATCH')
    return {'source':str(source),'destination':str(target),'bytes':total,'sha256':digest.hexdigest(),
            'PRE':identity(before),'OPEN':identity(opened),'POST':identity(post),'pathPOST':identity(path_post),'EOF':True,
            'scope':'NEW_PUBLIC_CONTROL_INPUT_CONTENT_NOT_HISTORICAL_CUSTODY'}


def process(pid):
    text=Path('/proc',str(pid),'stat').read_text();fields=text[text.rfind(')')+2:].split()
    return {'pid':pid,'startTime':fields[19],'ppid':fields[1],'pgid':fields[2],'sid':fields[3],
            'rawArgvHex':Path('/proc',str(pid),'cmdline').read_bytes().hex()}


def descendants():
    rows=[]
    for p in Path('/proc').iterdir():
        if p.name.isdecimal() and int(p.name)!=1:
            try:rows.append(process(int(p.name)))
            except FileNotFoundError:continue
    return rows


def reap():
    while True:
        try:pid,status=os.waitpid(-1,os.WNOHANG)
        except ChildProcessError:return
        if pid==0:return
        OWNED_PROCESS_EVENTS.append({'event':'PID1_REAP','pid':pid,'waitStatus':status})


def call(name,argv,environment,deadline=300,maximum=262144):
    # Public bootstrap group ownership is separate from untouched native pidfd gates.
    paths=[ROOT/(name+'.stdout'),ROOT/(name+'.stderr')]
    outputs=[open(p,'xb')for p in paths];child=None;failure=None;counts=[0,0];known={};poller=None
    def observe():
        for row in descendants():
            if str(row['pgid'])!=str(child.pid):raise ValueError('UNKNOWN_PUBLIC_DESCENDANT:'+repr(row))
            key=(row['pid'],row['startTime'])
            if key not in known:known[key]=row;OWNED_PROCESS_EVENTS.append({'event':'OWNED_GROUP_OBSERVED',**row})
    try:
        if os.getpid()!=1 or descendants():raise ValueError('EXCLUSIVE_OWNED_PID_NAMESPACE_REQUIRED')
        child=subprocess.Popen(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,env=environment)
        observe();poller=selectors.DefaultSelector()
        for i,stream in enumerate((child.stdout,child.stderr)):
            os.set_blocking(stream.fileno(),False);poller.register(stream,selectors.EVENT_READ,i)
        expires=time.monotonic()+deadline
        while poller.get_map():
            if time.monotonic()>=expires:raise TimeoutError('PUBLIC_CONTROL_DEADLINE')
            resource();observe()
            for key,_ in poller.select(.05):
                block=os.read(key.fileobj.fileno(),65536)
                if not block:poller.unregister(key.fileobj);key.fileobj.close();continue
                i=key.data;counts[i]+=len(block);remaining=max(0,maximum-outputs[i].tell());outputs[i].write(block[:remaining])
                if counts[i]>maximum:raise ValueError('PUBLIC_CONTROL_STREAM_BOUND')
        code=child.wait(timeout=5)
        reap()
        if descendants():raise ValueError('NONTERMINAL_PUBLIC_DESCENDANTS_AFTER_LEADER')
        if code:raise ValueError('PUBLIC_CONTROL_NONZERO:'+str(code))
        return {'argv':argv,'exitCode':code,'streamBytes':counts,'deadlineSeconds':deadline,
                'rawPaths':list(map(str,paths)),'nativePidfdQualification':'NOT_CLAIMED','descendantsTerminal':True}
    except BaseException as error:failure=repr(error);raise
    finally:
        cleanup=[]
        if child is not None:
            alive=descendants()
            if alive:
                eligible=all(str(row['pgid'])==str(child.pid) and (row['pid'],row['startTime'])in known for row in alive)
                if eligible:
                    try:os.killpg(child.pid,signal.SIGKILL)
                    except ProcessLookupError:pass
                else:cleanup.append('UNKNOWN_GROUP_OWNERSHIP_NO_NUMERIC_KILL:'+repr(alive))
            try:child.wait(timeout=5)
            except BaseException as error:cleanup.append(repr(error))
            expires=time.monotonic()+2
            while descendants() and time.monotonic()<expires:reap();time.sleep(.01)
            reap()
            if descendants():cleanup.append('NONTERMINAL_OWNED_PID_NAMESPACE')
        if poller is not None:poller.close()
        for output in outputs:output.flush();os.fsync(output.fileno());output.close()
        for stream in (()if child is None else(child.stdout,child.stderr)):
            if stream and not stream.closed:stream.close()
        (ROOT/(name+'.terminal.json')).write_text(json.dumps({'argv':argv,'failure':failure,'cleanupErrors':cleanup,
            'spawned':child is not None,'actualExitCode':None if child is None else child.returncode,'streamBytes':counts,
            'rawPaths':list(map(str,paths)),'ownedProcessEvidence':OWNED_PROCESS_EVENTS,
            'allDescendantsTerminal':not descendants(),'scope':'PUBLIC_BOOTSTRAP_ONLY_NOT_NATIVE_LIFECYCLE'})+'\n')
        if cleanup and failure is None:raise ValueError('PUBLIC_DESCENDANT_CLEANUP_HOLD:'+repr(cleanup))


def current_regular(path,maximum,collect=False):
    before=os.lstat(path)
    if not Path(path).is_file()or before.st_nlink!=1 or Path(path).resolve()!=Path(path):raise ValueError('REGULAR_SINGLE_LINK_LITERAL_EXPORT')
    if before.st_size>maximum:raise ValueError('FINITE_READ_BOUND')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);total=0;digest=hashlib.sha256();chunks=[]
    try:
        opened=os.fstat(fd)
        while block:=os.read(fd,65536):
            total+=len(block)
            if total>maximum:raise ValueError('FINITE_READ_BOUND_DURING_EOF')
            digest.update(block)
            if collect:chunks.append(block)
        post=os.fstat(fd)
    finally:os.close(fd)
    final=os.lstat(path)
    if identity(before)!=identity(opened)or identity(before)!=identity(post)or identity(before)!=identity(final)or total!=before.st_size:
        raise ValueError('FULL_EOF_CURRENT_NINE_DRIFT')
    row={'path':str(path),'bytes':total,'sha256':digest.hexdigest(),'PRE':identity(before),'OPEN':identity(opened),
            'POST':identity(post),'pathPOST':identity(final),'EOF':True}
    return (row,b''.join(chunks)) if collect else row


def export_manifest(primary):
    rows=[];total=0
    for name in EXPORT_ALLOWLIST:
        p=ROOT/name
        if not p.exists()and not p.is_symlink():rows.append({'relativePath':name,'status':'ABSENT'});continue
        row=current_regular(p,EXPORT_BYTES_MAX-total);total+=row['bytes'];rows.append({'relativePath':name,'status':'EXISTS','current':row})
    value={'scope':'FINITE_PUBLIC_SOURCE_CONTROL_EXPORT_ONLY','files':rows,'fileCount':len(rows),
           'existingBytes':total,'combinedExportBytesMaxIncludingThisManifest':EXPORT_BYTES_MAX,'primaryFailure':primary,
           'allDescendantsTerminal':not descendants(),'nativeClaims':False,'original122':'HELD','ROOT':'ABSENT'}
    raw=(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
    if total+len(raw)>EXPORT_BYTES_MAX:raise ValueError('COMBINED_PUBLIC_EXPORT_BOUND')
    p=ROOT/'public-export-manifest.json'
    with open(p,'xb')as f:f.write(raw);f.flush();os.fsync(f.fileno())
    for row in rows:
        if row['status']=='EXISTS'and identity(os.lstat(row['current']['path']))!=row['current']['PRE']:raise ValueError('FINAL_EXPORT_NINE_DRIFT')
    return current_regular(p,65536)


def validate_manifest(manifest):
    if type(manifest) is not dict:raise ValueError('STRICT_MANIFEST_ROOT_SCHEMA')
    expected_root={'scope','files','fileCount','inputBytes','historicalCustody','DockerExecuted','priorProposal'}
    if set(manifest)!=expected_root:raise ValueError('STRICT_MANIFEST_ROOT_SCHEMA')
    expected={('/reviewed-source/'+name,'source/'+name)for name in ('ast_parser.mjs','build_reference_contract.py','canonical_entry.py','consumer_schema.mjs','consumer_wiring.mjs','literal-destination-map.json','native_boundary.py','producers.py','reference-contract.json','reference-input-observations.json','strict_io.py')}
    expected|={('/reviewed-control.py','controls/run_controls.py'),('/reviewed-typescript.js','public-parser/typescript.js'),('/reviewed-command.json','source/reference-command.json')}
    if type(manifest['files']) is not list or len(manifest['files'])!=14:raise ValueError('EXACT_MANIFEST_LITERAL_MEMBERSHIP')
    for row in manifest['files']:
        if type(row) is not dict or set(row)!={'source','destination','bytes','sha256','hostSource'} or type(row['bytes'])is not int or not 0<=row['bytes']<=16777216 or any(type(row[k]) is not str for k in ('source','destination','sha256','hostSource')) or len(row['sha256'])!=64 or any(c not in '0123456789abcdef'for c in row['sha256']):raise ValueError('STRICT_MANIFEST_RECORD')
    if type(manifest['fileCount']) is not int or type(manifest['inputBytes']) is not int or manifest['fileCount']!=14 or manifest['inputBytes']!=sum(x['bytes']for x in manifest['files'])or manifest['historicalCustody']!='NOT_ADOPTED'or manifest['DockerExecuted']is not False:raise ValueError('EXACT_MANIFEST_DEMAND_AND_SCOPE')
    if manifest['scope']!='PROPOSED_PUBLIC_SYNTHETIC_CONTROLS_ONLY' or len(manifest['files'])!=14:
        raise ValueError('FINITE_REVIEWED_CONTROL_INPUTS')
    if {(x['source'],x['destination'])for x in manifest['files']}!=expected:raise ValueError('EXACT_MANIFEST_LITERAL_MEMBERSHIP')
    return manifest


def main():
    global ROOT_CREATED_BY_THIS_INVOCATION
    os.umask(0o077)
    if sys.platform!='linux' or ROOT.exists() or ROOT.is_symlink() or len(sys.argv)!=1:
        raise ValueError('DISTINCT_ISOLATED_PUBLIC_CONTROL_NAMESPACE_REQUIRED')
    def pairs(items):
        result={}
        for key,value in items:
            if key in result:raise ValueError('DUPLICATE_MANIFEST_KEY')
            result[key]=value
        return result
    manifest_proof,manifest_raw=current_regular(Path('/reviewed-manifest.json'),65536,collect=True)
    manifest=json.loads(manifest_raw,object_pairs_hook=pairs)
    validate_manifest(manifest)
    ROOT.mkdir(mode=0o700)
    ROOT_CREATED_BY_THIS_INVOCATION = True
    for name in ('home','tmp','infra'): (ROOT/name).mkdir(mode=0o700)
    pre=resource(initial=True);copied=[copy_content(row)for row in manifest['files']]
    if identity(os.lstat('/reviewed-manifest.json'))!=manifest_proof['PRE']:raise ValueError('MANIFEST_NINE_CHANGED')
    (ROOT/'input-observations.json').write_text(json.dumps({'scope':'FRESH_PUBLIC_CONTENT_BASELINE_NOT_HISTORICAL_IDENTITY','manifest':manifest_proof,'files':copied})+'\n')
    env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':str(ROOT/'home'),'TMPDIR':str(ROOT/'tmp'),
         'PYTHONDONTWRITEBYTECODE':'1','C8_PUBLIC_CONTROL_SETUP':'FRESH_PUBLIC_LINUX',
         'C8_PUBLIC_CONTROL_NODE':'/usr/local/bin/node',
         'C8_PUBLIC_CONTROL_TS_PARSER':str(ROOT/'public-parser/typescript.js'),
         'C8_PUBLIC_CONTROL_COMMAND_REFERENCE':str(ROOT/'source/reference-command.json'),
         'npm_config_update_notifier':'false','npm_config_cache':str(ROOT/'infra/npm-cache')}
    version=call('node-version',['/usr/local/bin/node','--version'],env,30,1024)
    if (ROOT/'node-version.stdout').read_text().strip()!='v24.15.0': raise ValueError('NODE_VERSION_BINDING')
    npm=Path('/usr/local/bin/npm');npm_before=os.lstat(npm);npm_target=os.readlink(npm);npm_canonical=str(npm.resolve())
    npm_version=call('npm-version',['/usr/local/bin/node',npm_canonical,'--version'],env,30,1024)
    python_version=call('python-version',['/usr/local/bin/python3.12','--version'],env,30,1024)
    if (ROOT/'npm-version.stdout').read_text().strip()!='12.2.0'or (ROOT/'python-version.stdout').read_text().strip()!='Python 3.12.15':raise ValueError('FRESH_PUBLIC_TOOLCHAIN_VERSION')
    if identity(os.lstat(npm))!=identity(npm_before)or os.readlink(npm)!=npm_target:raise ValueError('NPM_LITERAL_ALIAS_DRIFT')
    runtime=[current_regular(Path(path),268435456)for path in ['/usr/local/bin/node','/usr/local/bin/python3.12',npm_canonical]]
    (ROOT/'runtime-observations.json').write_text(json.dumps({'scope':'PUBLIC_TOOLCHAIN_ONLY_NOT_NATIVE_QUALIFICATION','regulars':runtime,'npmLiteralAlias':{'path':str(npm),'target':npm_target,'PRE':identity(npm_before),'pathPOST':identity(os.lstat(npm))}})+'\n')
    result=call('control-run',['/usr/local/bin/python3.12','-B',str(ROOT/'controls/run_controls.py'),'linux-public-repair1'],env)
    post=resource()
    (ROOT/'public-control-receipt.json').write_text(json.dumps({'scope':'PUBLIC_SYNTHETIC_PRODUCER_SOURCE_CONTROLS_ONLY',
        'environment':env,'inputs':copied,'resourcesPRE':pre,'resourcesPOST':post,'version':version,'npmVersion':npm_version,'pythonVersion':python_version,'run':result,
        'nativeQualification':False,'subjects':False,'ROOT':'ABSENT','original122':'HELD','enablingAttestation':False})+'\n')
    print(json.dumps({'scope':'PUBLIC_SYNTHETIC_PRODUCER_SOURCE_CONTROLS_ONLY','receipt':str(ROOT/'public-control-receipt.json'),
                      'results':str(OUTPUT/'results.json'),'original122':'HELD','ROOT':'ABSENT'}))


def entrypoint():
    primary=None
    try:main()
    except BaseException as error:
        primary=repr(error)
        if ROOT_CREATED_BY_THIS_INVOCATION:
            (ROOT/'bootstrap-failure.json').write_text(json.dumps({'scope':'FAILED_PUBLIC_SOURCE_CONTROLS_ONLY','failure':primary,'nativeClaims':False,'ROOT':'ABSENT','original122':'HELD'})+'\n')
        raise
    finally:
        if ROOT_CREATED_BY_THIS_INVOCATION:
            proof=export_manifest(primary)
            print(json.dumps({'scope':'FINITE_PUBLIC_EXPORT_ONLY','manifest':proof,'original122':'HELD','ROOT':'ABSENT'}))


if __name__=='__main__':entrypoint()
