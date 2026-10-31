"""Independent read-only full-byte/all-nine checks. Writes only requested review roots."""
from pathlib import Path
import hashlib, json, os, stat

FIELDS = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):
    return {k:str(getattr(s,'st_'+k)) for k in FIELDS}
def read(path, expected=None):
    path=Path(path)
    assert path.resolve(strict=True)==path
    before=identity(path.lstat())
    assert stat.S_ISREG(int(before['mode'])) and before['nlink']=='1'
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        assert identity(os.fstat(fd))==before
        h=hashlib.sha256(); size=0; blocks=[]
        while True:
            block=os.read(fd,1048576)
            if not block: break
            h.update(block); size+=len(block); blocks.append(block)
        assert before==identity(os.fstat(fd))==identity(path.lstat())
        assert size==int(before['size'])
    finally: os.close(fd)
    row={'path':str(path),'bytes':size,'sha256':h.hexdigest(),'PRE':before,'POST':before,'pathPOST':before,'EOF':True}
    if expected is not None:
        assert size==expected['bytes'] and row['sha256']==expected['sha256'],str(path)
        old=expected.get('identityDecimal')
        if old is not None: assert before==old,('manifest_identity_drift',str(path),before,old)
    return b''.join(blocks),row
def manifest(base, name, count, sha=None, length=None):
    raw,pin=read(Path(base)/name)
    if sha: assert pin['sha256']==sha
    if length: assert pin['bytes']==length
    value=json.loads(raw); records=value['files']
    assert len(records)==count and len({r['path'] for r in records})==count
    proof=[]
    for r in records:
        p=Path(r['path']); assert not p.is_absolute() and '..' not in p.parts
        _,row=read(Path(base)/p,r); proof.append(row)
    return value,pin,proof
def dump(path,value):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    if path.exists():
        assert json.loads(path.read_bytes())==value,('independent_output_already_exists_with_different_value',str(path))
        return
    with path.open('x') as f: json.dump(value,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
