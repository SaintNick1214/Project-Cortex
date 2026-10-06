"""Read-only finite Git-byte backing audit; not runtime/custody restoration."""
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import time

FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s): return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def exact(stream,size):
    result=bytearray()
    while len(result)<size:
        block=stream.read(min(1048576,size-len(result)))
        if not block: raise ValueError('GIT_BLOB_TRUNCATED')
        result.extend(block)
    return bytes(result)

def main():
    repo=Path(sys.argv[1]).resolve(strict=True)
    contract=Path(sys.argv[2]).resolve(strict=True)
    output=Path(sys.argv[3])
    if output.exists(): raise ValueError('DISTINCT_GIT_AUDIT_NO_REFRESH')
    began=time.monotonic()
    definitions=json.loads(contract.read_text())
    parts=[{**p,'route':r['name']} for r in definitions['routes'] for p in r['parts']]
    if len(parts)!=361 or len({p['path'] for p in parts})!=361: raise ValueError('EXACT_SIX361_ROUTE_PARTS')
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
    root_tree=subprocess.check_output(['git','rev-parse',commit+'^{tree}'],cwd=repo,text=True).strip()
    tree=subprocess.check_output(['git','ls-tree','-r','--full-tree','-z',commit,'--',*[p['path'] for p in parts]],cwd=repo)
    objects={}
    for row in tree.split(b'\0'):
        if not row: continue
        header,path=row.split(b'\t',1); mode,kind,oid=header.decode().split()
        if kind!='blob' or mode not in ('100644','100755'): raise ValueError('REGULAR_GIT_ROUTE_BLOB_REQUIRED')
        objects[os.fsdecode(path)]=oid
    if set(objects)!={p['path'] for p in parts}: raise ValueError('UNTRACKED_OR_MISSING_DECLARED_ROUTE_PART')
    remote_commit=json.loads(subprocess.check_output(['gh','api','repos/SaintNick1214/Project-Cortex/git/commits/'+commit],cwd=repo))
    if remote_commit['sha']!=commit or remote_commit['tree']['sha']!=root_tree: raise ValueError('REMOTE_COMMIT_TREE_IDENTITY')
    reader=subprocess.Popen(['git','cat-file','--batch'],cwd=repo,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    rows=[]
    try:
        for p in parts:
            path=repo/p['path']; before=os.lstat(path)
            if path.resolve()!=path or not stat.S_ISREG(before.st_mode) or before.st_nlink!=1: raise ValueError('REGULAR_CURRENT_PATH_REQUIRED')
            fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
            try:
                pre=identity(os.fstat(fd)); sha=hashlib.sha256(); git=hashlib.sha1(('blob '+str(before.st_size)+'\0').encode()); size=0
                while b:=os.read(fd,1048576): sha.update(b); git.update(b); size+=len(b)
                post=identity(os.fstat(fd)); path_post=identity(os.lstat(path))
                if identity(before)!=pre or pre!=post or post!=path_post: raise ValueError('CURRENT_ROUTE_HELD_FD_DRIFT')
            finally: os.close(fd)
            if size!=p['bytes'] or sha.hexdigest()!=p['sha256'] or git.hexdigest()!=objects[p['path']]: raise ValueError('CURRENT_ROUTE_DECLARED_HASH_SIZE_GIT_OID')
            reader.stdin.write((objects[p['path']]+'\n').encode()); reader.stdin.flush()
            header=reader.stdout.readline(256).decode().strip().split()
            if header!=[objects[p['path']],'blob',str(size)]: raise ValueError('GIT_RAW_BLOB_HEADER')
            blob_sha=hashlib.sha256(); blob_oid=hashlib.sha1(('blob '+str(size)+'\0').encode()); remaining=size
            while remaining:
                b=exact(reader.stdout,min(1048576,remaining)); remaining-=len(b); blob_sha.update(b); blob_oid.update(b)
            if exact(reader.stdout,1)!=b'\n' or blob_sha.hexdigest()!=p['sha256'] or blob_oid.hexdigest()!=objects[p['path']]: raise ValueError('GIT_BLOB_RAW_BYTES_EOF_DIGEST')
            rows.append({'route':p['route'],'path':p['path'],'bytes':size,'sha256':sha.hexdigest(),'gitBlobOID':objects[p['path']],'gitBlobRawSHA256':blob_sha.hexdigest(),'PRE':pre,'POST':post,'pathPOST':path_post,'scope':'CURRENT_CONTENT_ONLY_NOT_OLD_CUSTODY'})
        reader.stdin.close()
        if reader.stdout.read(1): raise ValueError('GIT_BATCH_TRAILING')
        code=reader.wait(timeout=30); errors=reader.stderr.read(1048577)
        if code or len(errors)>1048576: raise ValueError('GIT_BATCH_TERMINAL_ERROR')
    finally:
        if reader.poll() is None: reader.kill(); reader.wait(timeout=5)
        for stream in (reader.stdin,reader.stdout,reader.stderr):
            if stream and not stream.closed: stream.close()
    result={'scope':'CURRENT_GIT_AND_REMOTE_COMMIT_BYTE_REPRODUCIBILITY_NOT_PHYSICAL_CUSTODY','commit':commit,'rootTreeOID':root_tree,'remoteCommitTreeEqual':True,'parts':rows,'routes':6,'partCount':len(rows),'encodedBytes':sum(p['bytes'] for p in rows),'missingRequiredRouteContent':0,'C7HistoricalGaps':'UNCHANGED_4224_AND11','elapsedSeconds':time.monotonic()-began,'subjectExecuted':False}
    with open(output,'xb') as f: os.chmod(output,0o600); f.write((json.dumps(result,indent=2)+'\n').encode()); f.flush(); os.fsync(f.fileno())
    print(json.dumps({k:v for k,v in result.items() if k!='parts'}))

if __name__=='__main__': main()
