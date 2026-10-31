"""All-nine, full-EOF observations of explicitly selected public regular files."""
from pathlib import Path
import hashlib, json, os, stat
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(value):
    return {field:str(getattr(value,'st_'+field)) for field in FIELDS}
def read(path):
    path=Path(path)
    assert path.resolve(strict=True)==path
    before=identity(path.lstat())
    assert stat.S_ISREG(int(before['mode'])) and int(before['nlink'])==1
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        assert identity(os.fstat(fd))==before
        chunks=[]
        while True:
            chunk=os.read(fd,1048576)
            if not chunk:break
            chunks.append(chunk)
        post=identity(os.fstat(fd)); pathpost=identity(path.lstat())
        assert before==post==pathpost
    finally:os.close(fd)
    raw=b''.join(chunks);assert len(raw)==int(before['size'])
    return raw,{'path':str(path),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'identityDecimal':before,'PRE':before,'POST':post,'pathPOST':pathpost,'EOF':True}
def dump_new(path,value):
    path=Path(path)
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        data=(json.dumps(value,indent=2)+'\n').encode();offset=0
        while offset<len(data):
            count=os.write(fd,data[offset:]);assert count>0;offset+=count
        os.fsync(fd)
    finally:os.close(fd)
    fd=os.open(path.parent,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:os.fsync(fd)
    finally:os.close(fd)
