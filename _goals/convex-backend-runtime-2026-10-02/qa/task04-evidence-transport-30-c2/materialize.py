#!/usr/bin/env python3
"""Verify the complete sealed transport, then exclusively create missing originals."""
import argparse,gzip,hashlib,io,json,os,stat,tarfile
from pathlib import Path
MAP_SHA256='8462ee757b4f68bf281dc645a23c042369cc06c078f9d0f95ab9c2384c5c4d53'
LIMIT=5*1024*1024

def digest(b):return hashlib.sha256(b).hexdigest()
def require(ok,message):
    if not ok:raise ValueError(message)
def safe(path):
    require(isinstance(path,str) and path and '\\' not in path and '\x00' not in path,'unsafe path')
    require(not path.startswith('/') and all(p not in ('','.','..') for p in path.split('/')),'unsafe path')
    return path

def directory(path,create=False):
    """Anchor every component with O_NOFOLLOW directory descriptors, including / ancestors."""
    p=Path(os.path.abspath(path));fd=os.open('/',os.O_RDONLY|os.O_DIRECTORY)
    try:
        for component in p.parts[1:]:
            if create:
                try:os.mkdir(component,0o755,dir_fd=fd)
                except FileExistsError:pass
            new=os.open(component,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
            os.close(fd);fd=new
        return fd
    except BaseException:
        os.close(fd);raise

def read_at(base,path,maxbytes):
    path=safe(path);parent,name=os.path.split(path);fd=directory(base/parent)
    try:f=os.open(name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=fd)
    finally:os.close(fd)
    with os.fdopen(f,'rb') as stream:
        metadata=os.fstat(stream.fileno())
        require(stat.S_ISREG(metadata.st_mode),'nonregular input')
        require(isinstance(maxbytes,int) and maxbytes>=0,'invalid read bound')
        require(metadata.st_size<=maxbytes,'input exceeds trusted byte bound')
        data=stream.read(maxbytes+1)
        require(len(data)<=maxbytes,'input exceeds trusted byte bound')
        return data

class Parts(io.RawIOBase):
    def __init__(self,base,chunks):self.base=base;self.chunks=iter(chunks);self.current=io.BytesIO()
    def readable(self):return True
    def read(self,size=-1):
        require(size>=0,'bounded streaming required');out=bytearray()
        while len(out)<size:
            b=self.current.read(size-len(out))
            if b:out.extend(b);continue
            try:c=next(self.chunks)
            except StopIteration:break
            b=read_at(self.base,c['path'],c['bytes']);require(len(b)==c['bytes'] and digest(b)==c['sha256'],'chunk changed');self.current=io.BytesIO(b)
        return bytes(out)

def entries(base,mapping):
    seen=set()
    with tarfile.open(fileobj=Parts(base,mapping['chunks']),mode='r|gz') as archive:
        for member in archive:
            require(member.name in mapping['contents'] and member.name not in seen,'unknown or duplicate archive entry')
            require(member.isreg() and member.type==tarfile.REGTYPE and not member.pax_headers,'nonregular archive entry')
            require(member.size==mapping['contents'][member.name],'archive length mismatch');seen.add(member.name)
            with archive.extractfile(member) as stream:b=stream.read(member.size+1)
            require(len(b)==member.size and digest(b)==member.name,'archive content mismatch')
            yield member.name,b
    require(seen==set(mapping['contents']),'archive entry set mismatch')

def existing(base,row):
    path,h,size=row
    try:b=read_at(base,path,size)
    except FileNotFoundError:return False
    require(len(b)==size and digest(b)==h,'existing original mismatch: '+path)
    return True

def create(base,path,b):
    parent,name=os.path.split(safe(path));fd=directory(base/parent,True)
    try:
        f=os.open(name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644,dir_fd=fd)
        try:
            view=memoryview(b)
            while view:
                n=os.write(f,view);require(n>0,'short write');view=view[n:]
            os.fsync(f)
        finally:os.close(f)
    finally:os.close(fd)

def verify_set(base,rows):
    seen=set()
    for root,dirs,files in os.walk(base,followlinks=False):
        for name in dirs+files:require(not (Path(root)/name).is_symlink(),'symlink in restored tree')
        for name in files:seen.add((Path(root)/name).relative_to(base).as_posix())
    require(seen=={r[0] for r in rows},'restored original file set mismatch')
    for row in rows:require(existing(base,row),'missing original: '+row[0])

def main():
    p=argparse.ArgumentParser();p.add_argument('--target',required=True,type=Path);p.add_argument('--materialize',action='store_true');a=p.parse_args()
    base=Path(__file__).absolute().parent;directory_fd=directory(base);os.close(directory_fd)
    packed=read_at(base,'transport-map.json.gz',LIMIT);require(len(packed)<=LIMIT and digest(packed)==MAP_SHA256,'transport map changed')
    m=json.loads(gzip.decompress(packed));require(m['format']=='cortex-lossless-content-addressed-targzip-v1','format mismatch')
    rows=m['files'];require(len({r[0] for r in rows})==len(rows),'duplicate allowed paths');byhash={}
    for path,h,size in rows:
        safe(path);require(isinstance(size,int) and size>=0 and h in m['contents'] and m['contents'][h]==size,'invalid allowed file')
        require(len(h)==64 and all(c in '0123456789abcdef' for c in h),'invalid digest');byhash.setdefault(h,[]).append([path,h,size])
    require(set(byhash)==set(m['contents']),'unused archive content')
    archivehash=hashlib.sha256();archivebytes=0;chunkpaths=set()
    for c in m['chunks']:
        safe(c['path']);require(c['path'].startswith('blobs/') and c['path'] not in chunkpaths,'duplicate/invalid chunk path');chunkpaths.add(c['path'])
        require(0<c['bytes']<=LIMIT,'oversize chunk');b=read_at(base,c['path'],c['bytes']);require(len(b)==c['bytes'] and digest(b)==c['sha256'],'chunk mismatch');archivehash.update(b);archivebytes+=len(b)
    require(archivehash.hexdigest()==m['archiveSha256'] and archivebytes==m['archiveBytes'],'archive stream mismatch')
    # Validate every member before creating any original file.
    for h,b in entries(base,m):pass
    target=Path(os.path.abspath(a.target));fd=directory(target,a.materialize);os.close(fd)
    present={r[0] for r in rows if existing(target,r)};created=0
    if a.materialize:
        for h,b in entries(base,m):
            for row in byhash[h]:
                if row[0] in present:continue
                create(target,row[0],b);created+=1
    verify_set(target,rows)
    print(json.dumps({'transportOnly':True,'qualificationAcceptance':False,'filesVerified':len(rows),'created':created,'existingVerified':len(present),'manifestSha256':m['manifestSha256']}))
if __name__=='__main__':main()
