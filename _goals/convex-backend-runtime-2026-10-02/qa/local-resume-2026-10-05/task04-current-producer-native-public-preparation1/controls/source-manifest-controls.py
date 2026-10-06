"""Small actual public files/FDs; current manifest schema and no-follow outcomes."""
import copy
import hashlib
import json
import os
from pathlib import Path
import sys
D=Path(__file__).resolve().parents[1];sys.path.insert(0,str(D/'source'))
from source_manifest import open_manifest,fence_directories
from native_contract import Held
ROOT=D/'controls/source-manifest-fixtures-run1';ROOT.mkdir()
rows=[]

def fixture(name,mutate=None,extra=None):
    root=ROOT/name;root.mkdir();data=b'PUBLIC_SOURCE_ONLY\n';(root/'one.py').write_bytes(data)
    value={'schema':'NATIVE_PUBLIC_SOURCE_MANIFEST_V1','scope':'SOURCE_ONLY_PROPOSAL_NOT_RELEASE',
           'files':[{'path':'one.py','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}],
           'fileCount':1,'sourceBytes':len(data),'historicalCustody':'NOT_ADOPTED'}
    if mutate:mutate(value)
    if extra:extra(root)
    with open(root/'source-manifest.json','xb')as out:out.write((json.dumps(value)+'\n').encode());out.flush();os.fsync(out.fileno())
    return root

def check(name,body):
    try:body();rows.append({'name':name,'status':'PASS'})
    except BaseException as error:rows.append({'name':name,'status':'FAIL','error':repr(error)})

def deny(name,mutate=None,extra=None,token=''):
    root=fixture(name,mutate,extra)
    try:open_manifest(root)
    except ValueError as error:assert token in str(error)
    else:raise AssertionError('UNSAFE_MANIFEST_ACCEPTED')

def healthy():
    root=fixture('healthy');value,held,dirs=open_manifest(root)
    assert held.fd is not None and held.fence(full=True)['EOF']is True
    source=Held(str(root/'one.py'),100,value['files'][0]);assert source.fence(full=True)['sha256']==value['files'][0]['sha256']
    source.close();fence_directories(dirs)
    fd=held.fd;assert held.close()['closed']is True
    try:os.fstat(fd)
    except OSError:pass
    else:raise AssertionError('ACTUAL_MANIFEST_FD_NOT_CLOSED')

check('closed-manifest-held-before-use-complete-EOF-nine-close',healthy)
check('duplicate-row-denied',lambda:deny('duplicate',lambda v:(v['files'].append(copy.deepcopy(v['files'][0])),v.update(fileCount=2,sourceBytes=v['sourceBytes']*2)),token='UNIQUENESS'))
check('unknown-field-denied',lambda:deny('unknown',lambda v:v.update(extra=True),token='STRICT_HELD'))
check('float-count-denied',lambda:deny('float-count',lambda v:v.update(fileCount=1.0),token='STRICT_HELD'))
check('float-total-denied',lambda:deny('float-total',lambda v:v.update(sourceBytes=float(v['sourceBytes'])),token='STRICT_HELD'))
check('inconsistent-total-denied',lambda:deny('total',lambda v:v.update(sourceBytes=v['sourceBytes']+1),token='TOTAL'))
check('partial-row-denied',lambda:deny('partial',lambda v:v['files'][0].pop('sha256'),token='STRICT_SOURCE'))
check('circular-self-pin-denied',lambda:deny('circular',lambda v:v['files'][0].update(path='source-manifest.json'),token='SELF_CIRCULAR'))
check('literal-path-alias-denied',lambda:deny('path-alias',lambda v:v['files'][0].update(path='./one.py'),token='PATH_ALIAS'))
check('unknown-directory-symlink-explicitly-denied',lambda:deny('dir-symlink',extra=lambda root:os.symlink('.',root/'UNKNOWN_ALIAS'),token='EXPLICIT_SOURCE_SYMLINK_MEMBER'))
check('declared-regular-symlink-explicitly-denied',lambda:deny('file-symlink',extra=lambda root:((root/'one.py').unlink(),os.symlink('source-manifest.json',root/'one.py')),token='EXPLICIT_SOURCE_SYMLINK_MEMBER'))
check('unlisted-regular-member-denied',lambda:deny('unlisted',extra=lambda root:(root/'UNKNOWN').write_bytes(b'unknown'),token='FILE_MEMBERSHIP'))

def late_drift():
    root=fixture('late-manifest-drift');_,held,_=open_manifest(root)
    try:
        with open(root/'source-manifest.json','ab')as out:out.write(b' ');out.flush();os.fsync(out.fileno())
        try:held.fence(full=True)
        except ValueError as error:assert 'NINE_DRIFT' in str(error)
        else:raise AssertionError('FAILED_PIN_REFRESHED')
    finally:held.close()

def late_member():
    root=fixture('late-directory-member');_,held,dirs=open_manifest(root)
    try:
        (root/'FOREIGN_NEW_MEMBER').write_bytes(b'PUBLIC_NEGATIVE')
        try:fence_directories(dirs)
        except ValueError as error:assert 'DIRECTORY_MEMBERSHIP' in str(error)
        else:raise AssertionError('LATE_MEMBERSHIP_ACCEPTED')
    finally:held.close()

check('manifest-late-current-nine-drift-rejected-original-pin',late_drift)
check('directory-late-member-rejected-original-current-pin',late_member)
value={'scope':'PUBLIC_HOST_SMALL_SOURCE_MANIFEST_CONTROLS_ONLY','count':len(rows),'rows':rows,
       'DockerExecuted':False,'nativeQualification':False,'fixtureWritersClosedBeforeEachFirstAssessment':True}
(D/'controls/source-manifest-results-run1.json').write_text(json.dumps(value)+'\n');print(json.dumps(value))
assert all(row['status']=='PASS'for row in rows)
