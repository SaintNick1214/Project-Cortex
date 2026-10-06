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

ROOT = Path('/var/tmp/task04-c8-current-canonical-input-producers')
OUTPUT = ROOT / 'controls/linux-public-run1'
FIELDS = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
H = lambda data: hashlib.sha256(data).hexdigest()


def identity(value):
    return {key: str(getattr(value, 'st_'+key)) for key in FIELDS}


def resource():
    maximum = Path('/sys/fs/cgroup/memory.max').read_text().strip()
    current = Path('/sys/fs/cgroup/memory.current').read_text().strip()
    swap = Path('/sys/fs/cgroup/memory.swap.max').read_text().strip()
    fs = os.statvfs(ROOT)
    value = {'maximum':maximum,'current':current,'swapMaximum':swap,
             'literalReserve':int(maximum)-int(current),'availableBytes':fs.f_bavail*fs.f_frsize,
             'availableInodes':fs.f_favail}
    if maximum != '1073741824' or swap != '0' or value['literalReserve'] < 134217728:
        raise ValueError('PUBLIC_CONTROL_LITERAL_RESOURCE_HOLD:'+repr(value))
    if value['availableBytes'] < 536870912 or value['availableInodes'] < 4096:
        raise ValueError('PUBLIC_CONTROL_FINITE_DISK_INODE_HOLD:'+repr(value))
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
        if identity(before) != identity(os.fstat(fd)): raise ValueError('COPY_OPEN_DRIFT')
        with open(target, 'xb') as output:
            os.chmod(target, 0o600)
            while block := os.read(fd, 65536):
                total += len(block)
                if total > record['bytes']: raise ValueError('COPY_INPUT_BOUND')
                digest.update(block); output.write(block)
            output.flush(); os.fsync(output.fileno())
        if identity(before) != identity(os.fstat(fd)) or identity(before) != identity(os.lstat(source)):
            raise ValueError('COPY_FULL_EOF_NINE_DRIFT')
    finally: os.close(fd)
    if total != record['bytes'] or digest.hexdigest() != record['sha256']:
        raise ValueError('REVIEWED_SOURCE_CONTENT_MISMATCH')
    return {'source':str(source),'destination':str(target),'bytes':total,'sha256':digest.hexdigest(),
            'inputBefore':identity(before),'inputPost':identity(os.lstat(source)),
            'scope':'NEW_PUBLIC_CONTROL_INPUT_CONTENT_NOT_HISTORICAL_CUSTODY'}


def call(argv, environment, deadline=300, maximum=1048576):
    """Infrastructure bootstrap lifecycle only. No claim of native pidfd gates.

    An owned new process group is drained while enforcing per-stream byte bounds.
    Its partial raw outputs and actual terminal wait result are always retained.
    """
    name = 'control-run' if len(argv)>2 else 'node-version'
    paths = [ROOT/(name+'.stdout'), ROOT/(name+'.stderr')]
    outputs = [open(path, 'xb') for path in paths]
    child = None; rows = []; failure = None; counts = [0,0]
    try:
        child = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                 start_new_session=True, env=environment)
        poller=selectors.DefaultSelector()
        for i,stream in enumerate((child.stdout,child.stderr)):
            os.set_blocking(stream.fileno(),False); poller.register(stream,selectors.EVENT_READ,i)
        expires=time.monotonic()+deadline
        while poller.get_map():
            if time.monotonic() >= expires: raise TimeoutError('PUBLIC_CONTROL_DEADLINE')
            resource()
            for key,_ in poller.select(.05):
                block=os.read(key.fileobj.fileno(),65536)
                if not block: poller.unregister(key.fileobj);key.fileobj.close();continue
                i=key.data;counts[i]+=len(block)
                remaining=max(0,maximum-outputs[i].tell());outputs[i].write(block[:remaining])
                if counts[i]>maximum: raise ValueError('PUBLIC_CONTROL_STREAM_BOUND')
        code=child.wait(timeout=5)
        if code: raise ValueError('PUBLIC_CONTROL_NONZERO:'+str(code))
        return {'argv':argv,'exitCode':code,'streamBytes':counts,'deadlineSeconds':deadline,
                'rawPaths':list(map(str,paths)),'nativePidfdQualification':'NOT_CLAIMED'}
    except BaseException as error:
        failure=repr(error);raise
    finally:
        if child is not None and child.poll() is None:
            os.killpg(child.pid,signal.SIGKILL);child.wait(timeout=5)
        for output in outputs: output.flush();os.fsync(output.fileno());output.close()
        for stream in (() if child is None else (child.stdout,child.stderr)):
            if stream and not stream.closed:stream.close()
        (ROOT/(name+'.terminal.json')).write_text(json.dumps({'argv':argv,'failure':failure,
            'spawned':child is not None,'actualExitCode':None if child is None else child.returncode,
            'streamBytes':counts,'rawPaths':list(map(str,paths)),'scope':'PUBLIC_BOOTSTRAP_ONLY_NOT_NATIVE_LIFECYCLE'})+'\n')


def main():
    os.umask(0o077)
    if sys.platform!='linux' or ROOT.exists() or len(sys.argv)!=1:
        raise ValueError('DISTINCT_ISOLATED_PUBLIC_CONTROL_NAMESPACE_REQUIRED')
    ROOT.mkdir(mode=0o700)
    for name in ('home','tmp'): (ROOT/name).mkdir(mode=0o700)
    manifest=json.loads(Path('/reviewed-manifest.json').read_bytes())
    if manifest['scope']!='PROPOSED_PUBLIC_SYNTHETIC_CONTROLS_ONLY' or len(manifest['files'])!=14:
        raise ValueError('FINITE_REVIEWED_CONTROL_INPUTS')
    pre=resource();copied=[copy_content(row)for row in manifest['files']]
    env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':str(ROOT/'home'),'TMPDIR':str(ROOT/'tmp'),
         'PYTHONDONTWRITEBYTECODE':'1','C8_PUBLIC_CONTROL_SETUP':'FRESH_PUBLIC_LINUX',
         'C8_PUBLIC_CONTROL_NODE':'/usr/local/bin/node',
         'C8_PUBLIC_CONTROL_TS_PARSER':str(ROOT/'public-parser/typescript.js'),
         'C8_PUBLIC_CONTROL_COMMAND_REFERENCE':str(ROOT/'source/reference-command.json')}
    version=call(['/usr/local/bin/node','--version'],env,30,1024)
    if (ROOT/'node-version.stdout').read_text().strip()!='v24.15.0': raise ValueError('NODE_VERSION_BINDING')
    result=call(['/usr/local/bin/python3.12','-B',str(ROOT/'controls/run_controls.py'),'linux-public-run1'],env)
    post=resource()
    (ROOT/'public-control-receipt.json').write_text(json.dumps({'scope':'PUBLIC_SYNTHETIC_PRODUCER_SOURCE_CONTROLS_ONLY',
        'environment':env,'inputs':copied,'resourcesPRE':pre,'resourcesPOST':post,'version':version,'run':result,
        'nativeQualification':False,'subjects':False,'ROOT':'ABSENT','original122':'HELD','enablingAttestation':False})+'\n')
    print(json.dumps({'scope':'PUBLIC_SYNTHETIC_PRODUCER_SOURCE_CONTROLS_ONLY','receipt':str(ROOT/'public-control-receipt.json'),
                      'results':str(OUTPUT/'results.json'),'original122':'HELD','ROOT':'ABSENT'}))


if __name__=='__main__': main()
