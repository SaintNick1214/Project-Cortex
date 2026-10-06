"""Read and hold public source inputs; never import application or installed CLI code."""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

REPO = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q = REPO / '_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt3-2026-10-05'
FIELDS = ('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
held = {}

def identity(s):
    return {n: str(getattr(s,n)) for n in FIELDS}

def read(path):
    assert path == REPO or REPO in path.parents
    assert path.resolve() == path
    for parent in path.parents:
        assert parent.is_dir() and not parent.is_symlink()
    before = path.lstat()
    assert stat.S_ISREG(before.st_mode) and before.st_nlink == 1
    if path in held:
        fd, saved, content = held[path]
        assert saved == identity(before) == identity(os.fstat(fd))
        return content
    fd = os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        assert identity(before) == identity(os.fstat(fd))
        parts = []
        while True:
            data = os.read(fd,1048576)
            if not data: break
            parts.append(data)
        content = b''.join(parts)
        assert len(content) == before.st_size
        assert identity(before) == identity(os.fstat(fd)) == identity(path.lstat())
        held[path] = (fd,identity(before),content)
        return content
    except BaseException:
        os.close(fd)
        raise

def load(path):
    return json.loads(read(path))

def pin(path,sha,size=None):
    data=read(path)
    assert hashlib.sha256(data).hexdigest()==sha, str(path)
    if size is not None: assert len(data)==size, str(path)

try:
    freeze=load(Q/'candidate-freeze-attempt3.json')
    pin(Q/'candidate-freeze-attempt3.json','2fb8d11a7e6c0bcaf92b2fe8d7ff228a6e554f9241c07c22079e6be8bcc870ef')
    pin(Q/'receipt-manifest-attempt3.json','75ec4e5fbb3afbb9c9a779f4a6a01b28ec2a67b67cdd6b7f641ce9ff9bd913c8')
    for row in freeze['files']: pin(Q/row['path'],row['sha256'],row['bytes'])
    sources=load(Q/'source-inventory.json')
    for row in sources['files']: pin(REPO/row['path'],row['sha256'],row['bytes'])
    tests=load(Q/'source-pre.json')['files']
    assert tests==load(Q/'source-post.json')['files'] and len(tests)==155
    for path,sha in tests.items(): pin(REPO/path,sha)
    copies=load(Q/'managed-fixture-copy-manifest.json')['files']
    for row in copies:
        pin(REPO/row['source'],row['sha256'],row['bytes'])
        pin(Q/row['copy'],row['sha256'],row['bytes'])
    compiler=load(Q/'attempt2/compiler-projection.json')['files']
    for row in compiler:
        pin(REPO/row['source'],row['sha256'],row['bytes'])
        pin(Q/row['copy'],row['sha256'],row['bytes'])
    cli=load(Q/'attempt2/cli-source-pins.json')['files']
    for row in cli: pin(REPO/row['path'],row['sha256'],row['bytes'])
    for row in load(Q/'historical-script-provenance.json')['files']:
        pin(REPO/row['historicalSource'],row['sha256'])
        if row.get('preimage'): pin(Q/row['preimage'],row['sha256'])
    dependencies={}
    for name,version in {'convex':'1.46.0','typescript':'6.0.3','ws':'8.21.0','https-proxy-agent':'7.0.6'}.items():
        assert load(REPO/'node_modules'/name/'package.json')['version']==version
        dependencies[name]=version
    assert len(sources['files'])==161 and len(copies)==138 and len(compiler)==114 and len(cli)==6
    rows=[]
    for path,(fd,before,content) in held.items():
        assert identity(os.fstat(fd))==identity(path.lstat())==before
        rows.append({'path':str(path.relative_to(REPO)),'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest(),'currentIdentityDecimal':before})
    print(json.dumps({'status':'PASS','scope':'CURRENT_PUBLIC_SOURCE_BINDINGS_ONLY','platform':sys.platform,'files':sorted(rows,key=lambda x:x['path']),'distinctHeldFiles':len(rows),'candidateFiles':965,'sourcePins':161,'testPins':155,'managedCopies':138,'compilerProjection':114,'cliPins':6,'dependencies':dependencies,'all9HeldPathContinuity':'PASS','privateByteReads':0,'compilerExecutions':0,'cliDispatches':0,'serviceRequests':0,'qualificationAccepted':False,'fullTask03':'OPEN'}))
    sys.stdout.flush()
    for path,(fd,before,content) in held.items(): assert identity(os.fstat(fd))==identity(path.lstat())==before
finally:
    for fd,_,_ in held.values(): os.close(fd)
