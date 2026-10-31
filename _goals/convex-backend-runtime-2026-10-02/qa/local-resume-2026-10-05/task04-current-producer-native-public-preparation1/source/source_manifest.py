"""One held manifest BEFORE parse; complete no-follow literal membership."""
import os
from pathlib import Path, PurePosixPath
import re
import stat
from native_contract import Held,identity,strict


def membership(root):
    files=[];directories=[]
    def visit(directory):
        before=identity(os.lstat(directory))
        names=sorted(os.listdir(directory))
        for name in names:
            path=directory/name;value=os.lstat(path)
            if stat.S_ISLNK(value.st_mode):raise ValueError('EXPLICIT_SOURCE_SYMLINK_MEMBER:'+str(path))
            if stat.S_ISDIR(value.st_mode):visit(path)
            elif stat.S_ISREG(value.st_mode):files.append(path.relative_to(root).as_posix())
            else:raise ValueError('UNKNOWN_SOURCE_FILE_KIND:'+str(path))
        if identity(os.lstat(directory))!=before or sorted(os.listdir(directory))!=names:
            raise ValueError('SOURCE_DIRECTORY_SCAN_DRIFT')
        directories.append({'path':str(directory),'identity':before,'members':names})
    if not root.is_absolute() or str(root.resolve())!=str(root) or not stat.S_ISDIR(os.lstat(root).st_mode):
        raise ValueError('LITERAL_SOURCE_ROOT')
    visit(root)
    return sorted(files),directories


def open_manifest(root):
    held=Held(str(root/'source-manifest.json'),65536)
    try:
        os.lseek(held.fd,0,os.SEEK_SET);raw=os.read(held.fd,65537)
        if len(raw)!=held.size:raise ValueError('MANIFEST_FULL_EOF_REQUIRED')
        value=strict(raw);held.fence(full=True)
        if type(value)is not dict or set(value)!={'schema','scope','files','fileCount','sourceBytes','historicalCustody'} or value['schema']!='NATIVE_PUBLIC_SOURCE_MANIFEST_V1' or value['scope']!='SOURCE_ONLY_PROPOSAL_NOT_RELEASE' or value['historicalCustody']!='NOT_ADOPTED' or type(value['files'])is not list or type(value['fileCount'])is not int or type(value['sourceBytes'])is not int or value['fileCount']<1 or value['sourceBytes']<0:
            raise ValueError('STRICT_HELD_SOURCE_MANIFEST')
        names=[];total=0
        for row in value['files']:
            if type(row)is not dict or set(row)!={'path','bytes','sha256'} or type(row['path'])is not str or type(row['bytes'])is not int or row['bytes']<0 or row['bytes']>16777216 or type(row['sha256'])is not str or not re.fullmatch('[0-9a-f]{64}',row['sha256']):
                raise ValueError('STRICT_SOURCE_MANIFEST_ROW')
            path=row['path']
            if path=='source-manifest.json' or not path or PurePosixPath(path).is_absolute() or str(PurePosixPath(path))!=path or '..'in PurePosixPath(path).parts or '\\'in path:
                raise ValueError('NO_SELF_CIRCULAR_OR_PATH_ALIAS')
            names.append(path);total+=row['bytes']
        if len(set(names))!=len(names) or names!=sorted(names) or value['fileCount']!=len(names) or value['sourceBytes']!=total:
            raise ValueError('EXACT_SOURCE_ROW_UNIQUENESS_AND_TOTAL')
        actual,directories=membership(root)
        if actual!=sorted(names+['source-manifest.json']):raise ValueError('EXACT_SOURCE_FILE_MEMBERSHIP')
        held.fence(full=True)
        return value,held,directories
    except BaseException:
        held.close();raise


def fence_directories(rows):
    for row in rows:
        if identity(os.lstat(row['path']))!=row['identity'] or sorted(os.listdir(row['path']))!=row['members']:
            raise ValueError('CURRENT_SOURCE_DIRECTORY_MEMBERSHIP_NINE_DRIFT')
