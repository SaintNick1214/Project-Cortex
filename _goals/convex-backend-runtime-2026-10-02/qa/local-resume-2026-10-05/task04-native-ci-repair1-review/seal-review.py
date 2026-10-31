"""Exact fresh reviewer artifacts; self seal is transmitted outside this file."""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[4]
TARGET=ROOT/'reviewer-manifest.json'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}

held=[];files=[];directories=[]
try:
    with open(TARGET,'xb+') as out:
        os.chmod(TARGET,0o600)
        for directory,subdirs,names in os.walk(ROOT,followlinks=False):
            path=Path(directory);fd=os.open(path,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
            pre=identity(os.fstat(fd));members=sorted(os.listdir(fd));assert pre==identity(os.fstat(fd))==identity(os.lstat(path))
            row={'path':str(path.relative_to(REPO)),'PRE':pre,'POST':pre,'members':members};directories.append(row);held.append(('directory',fd,row))
            for name in sorted(names):
                p=path/name
                if p==TARGET:continue
                fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);s=os.fstat(fd);pre=identity(s)
                assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
                digest=hashlib.sha256();size=0
                while block:=os.read(fd,1048576):digest.update(block);size+=len(block)
                assert os.read(fd,1)==b'' and size==s.st_size and pre==identity(os.fstat(fd))==identity(os.lstat(p))
                row={'path':str(p.relative_to(REPO)),'bytes':size,'sha256':digest.hexdigest(),'PRE':pre,'POST':pre,'pathPOST':pre,'EOF':True};files.append(row);held.append(('file',fd,row))
        for kind,fd,row in held:
            assert identity(os.fstat(fd))==row['PRE']==identity(os.lstat(REPO/row['path']))
            if kind=='directory':assert sorted(os.listdir(fd))==row['members']
            else:
                os.lseek(fd,0,0);digest=hashlib.sha256();size=0
                while block:=os.read(fd,1048576):digest.update(block);size+=len(block)
                assert size==row['bytes'] and digest.hexdigest()==row['sha256'] and identity(os.fstat(fd))==row['PRE']
        result={'scope':'FRESH_INDEPENDENT_HOST_SOURCE_REVIEW_ARTIFACTS_ONLY','verdict':'REJECT','files':files,'directories':directories,'selfExcluded':str(TARGET.relative_to(REPO)),'nativeRuntime':'HELD_UNEXECUTED','workflowReleased':False,'ROOT':'ABSENT'}
        raw=(json.dumps(result,indent=2)+'\n').encode();out.write(raw);out.flush();os.fsync(out.fileno())
        pre=identity(os.fstat(out.fileno()));out.seek(0);assert out.read()==raw and pre==identity(os.fstat(out.fileno()))==identity(os.lstat(TARGET))
        seal={'path':str(TARGET),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'fileCount':len(files),'directoryCount':len(directories),'PRE':pre,'POST':pre,'pathPOST':pre,'reportSHA256':next(r['sha256'] for r in files if r['path'].endswith('/report.md')),'verdictSHA256':next(r['sha256'] for r in files if r['path'].endswith('/verdict.json'))}
finally:
    for kind,fd,row in held:os.close(fd)
print(json.dumps(seal))
