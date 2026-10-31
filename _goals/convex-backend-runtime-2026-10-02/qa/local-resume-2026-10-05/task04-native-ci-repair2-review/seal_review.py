"""Seal only this new review namespace, with exact typed own dummy exceptions."""
import hashlib
import json
import os
from pathlib import Path
import stat

ROOT=Path(__file__).parent
REPO=ROOT.parents[4]
TARGET=ROOT/'reviewer-manifest.json'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def data(fd):
    os.lseek(fd,0,0);digest=hashlib.sha256();count=0
    while raw:=os.read(fd,1048576):digest.update(raw);count+=len(raw)
    return count,digest.hexdigest()

assert REPO==Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
assert not (REPO/'.github/workflows/task04-c8-native-infrastructure.yml').exists()
held=[];files=[];dirs=[];aliases=[];groups={}
with open(TARGET,'xb+') as output:
    os.chmod(TARGET,0o600)
    try:
        for current,subdirs,names in os.walk(ROOT,followlinks=False):
            p=Path(current);fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
            row={'path':str(p.relative_to(REPO)),'PRE':ident(os.fstat(fd)),'members':sorted(os.listdir(fd))}
            row['POST']=ident(os.fstat(fd));row['pathPOST']=ident(os.lstat(p))
            assert row['PRE']==row['POST']==row['pathPOST'];held.append(('directory',fd,row));dirs.append(row)
            for name in sorted(set(names)|{n for n in subdirs if (p/n).is_symlink()}):
                path=p/name
                if path==TARGET:continue
                if path.is_symlink():
                    assert path==ROOT/'host-fixture/bin-alias' and path.resolve(strict=True)==ROOT/'host-fixture/bin'
                    fd=os.open(path,os.O_RDONLY|os.O_SYMLINK)
                    assert stat.S_ISLNK(os.fstat(fd).st_mode)
                    row={'path':str(path.relative_to(REPO)),'targetHex':os.fsencode(os.readlink(path)).hex(),'PRE':ident(os.fstat(fd)),'POST':ident(os.fstat(fd)),'pathPOST':ident(os.lstat(path)),'scope':'EXACT_OWNED_HOST_DUMMY_ALIAS_NOT_LINUX_RUNTIME'}
                    assert row['PRE']==row['POST']==row['pathPOST'];aliases.append(row);held.append(('alias',fd,row));continue
                fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);st=os.fstat(fd)
                hard=path in [ROOT/'host-fixture/hard-original',ROOT/'host-fixture/hard-link']
                assert stat.S_ISREG(st.st_mode) and st.st_nlink==(2 if hard else 1)
                if hard:groups.setdefault((st.st_dev,st.st_ino),[]).append(str(path.relative_to(REPO)))
                before=ident(st);count,sha=data(fd)
                row={'path':str(path.relative_to(REPO)),'bytes':count,'sha256':sha,'PRE':before,'POST':ident(os.fstat(fd)),'pathPOST':ident(os.lstat(path)),'EOF':True,'kind':'exact-owned-host-dummy-hardlink' if hard else 'regular-single-link-review-artifact'}
                assert before==row['POST']==row['pathPOST'] and count==st.st_size
                files.append(row);held.append(('file',fd,row))
        assert len(aliases)==1 and len(groups)==1 and len(next(iter(groups.values())))==2
        for kind,fd,row in held:
            assert ident(os.fstat(fd))==ident(os.lstat(REPO/row['path']))==row['PRE']
            if kind=='file':assert data(fd)==(row['bytes'],row['sha256'])
            elif kind=='directory':assert sorted(os.listdir(fd))==row['members']
            else:assert os.fsencode(os.readlink(REPO/row['path'])).hex()==row['targetHex']
            assert ident(os.fstat(fd))==row['PRE']
        result={'scope':'SEALED_INDEPENDENT_HOST_ONLY_SOURCE_REPAIR2_REVIEW_NOT_NATIVE_RUNTIME_BINDING','verdict':'PASS','selfExcluded':str(TARGET.relative_to(REPO)),'files':files,'directories':dirs,'ownedDummyAliases':aliases,'ownedDummyHardlinkGroups':list(groups.values()),'producerSourcePacketSHA256':'5209a4b98db687118fdf7cb9723d10f9b56f13811b3659a67aff827b02dcac66','producerSourceManifestSHA256':'3cdd4fb86dbf99067861a0d130230d9130da93a1d7b1abee9236faa834b754bd','workflowAbsentDuringReview':True,'sourceFullBytesEOFAll9':True,'heldFinalRereadEqual':True,'nativeRuntime':'HELD','Task04':'INCOMPLETE','ROOT':'ABSENT'}
    finally:
        for _,fd,_ in held:os.close(fd)
    raw=(json.dumps(result,indent=2)+'\n').encode();output.write(raw);output.flush();os.fsync(output.fileno())
    before=ident(os.fstat(output.fileno()));output.seek(0)
    assert output.read()==raw and ident(os.fstat(output.fileno()))==ident(os.lstat(TARGET))==before
    print(json.dumps({'path':str(TARGET),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'regularFiles':len(files),'directories':len(dirs),'dummyAliases':len(aliases),'pairedHardlinkGroups':len(groups),'PRE':before,'POST':ident(os.fstat(output.fileno())),'pathPOST':ident(os.lstat(TARGET))}))
