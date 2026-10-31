"""Finite real public synthetic export/stream seams; no Docker/native syscall."""
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tarfile
D=Path(__file__).resolve().parents[1];sys.path.insert(0,str(D/'source'))
from native_export import manifest,PUBLIC
from native_contract import Held
from tar_export import TrackedTarReader,finish_tar_record

rows=[];root=D/'controls/export-fixtures-run1';root.mkdir(mode=0o700)
def case(name,fn):
    try:fn();rows.append({'name':name,'status':'PASS'})
    except BaseException as e:rows.append({'name':name,'status':'FAIL','error':repr(e)})
def deny(fn,expected):
    try:fn()
    except ValueError as e:assert expected in str(e),(expected,str(e));return
    raise AssertionError('EXPECTED_DENIAL_NOT_RAISED')
base=root/'native';base.mkdir();(base/'python-raw').mkdir();(base/'node-raw').mkdir();pub=root/'public';pub.mkdir()
raw=b'PUBLIC_NATIVE_SOURCE_BYTES_ONLY';sha=hashlib.sha256(raw).hexdigest();(base/'python-raw'/sha).write_bytes(raw)
def raw_ok():
    v=manifest(base,pub,pub/'public-export-manifest.json');assert v['existingCount']==1 and v['bytes']==len(raw)
case('actual-bounded-raw-sha-and-nine-export',raw_ok)
def raw_bad():
    p=base/'python-raw'/sha;p.write_bytes(b'CHANGED');deny(lambda:manifest(base,pub,pub/'public-export-manifest.json'),'RAW_EXPORT_CONTENT_SHA');p.write_bytes(raw)
case('actual-raw-content-mismatch-denied',raw_bad)
p=pub/PUBLIC[0];p.write_bytes(b'PUBLIC_RECEIPT');h=Held(str(p),1024);pin=h.fence(full=True);h.close()
data={'scope':'FINITE_PUBLIC_SOURCE_CONTROL_EXPORT_ONLY','files':[{'relativePath':name,'status':'EXISTS','current':pin}if name==PUBLIC[0]else{'relativePath':name,'status':'ABSENT'}for name in PUBLIC],
 'fileCount':23,'existingBytes':len(b'PUBLIC_RECEIPT'),'combinedExportBytesMaxIncludingThisManifest':1048576,'primaryFailure':None,'allDescendantsTerminal':True,'nativeClaims':False,'original122':'HELD','ROOT':'ABSENT'}
mf=pub/'public-export-manifest.json'
def setup(v):mf.write_text(json.dumps(v)+'\n')
def current_public():
    setup(data);v=manifest(base,pub,mf);assert v['existingCount']==3
case('current-public23-complete-member-export',current_public)
def late_change():
    p.write_bytes(b'AFTER');deny(lambda:manifest(base,pub,mf),'ORIGINAL_CURRENT_PUBLIC_EXPORT_PIN_DRIFT')
case('late-public-current-pin-denial',late_change)
def unknown():
    v=dict(data);v['UNKNOWN']=True;setup(v);deny(lambda:manifest(base,pub,mf),'STRICT_PUBLIC23_SCOPE')
case('public-export-unknown-schema-denial',unknown)
def partial():
    v=dict(data);v['files']=data['files'][:-1];setup(v);deny(lambda:manifest(base,pub,mf),'EXACT_PUBLIC23_EXPORT')
case('public-export-partial-membership-denial',partial)
def terminal():
    v=dict(data);v['allDescendantsTerminal']=False;setup(v);deny(lambda:manifest(base,pub,mf),'STRICT_PUBLIC23_SCOPE')
case('nonterminal-export-denial',terminal)
def typed():
    v=dict(data);v['fileCount']=23.0;setup(v);deny(lambda:manifest(base,pub,mf),'STRICT_PUBLIC23_SCOPE')
case('float-export-count-denial',typed)
def tar_bytes(extra=b''):
    out=io.BytesIO()
    with tarfile.open(fileobj=out,mode='w',format=tarfile.GNU_FORMAT)as t:
        info=tarfile.TarInfo('known');info.size=3;t.addfile(info,io.BytesIO(b'ABC'))
    return out.getvalue()+extra
def read_tar(raw):
    with tarfile.open(fileobj=io.BytesIO(raw),mode='r|')as t:
        tracked=TrackedTarReader(t.fileobj);t.fileobj=tracked
        for member in t:
            with t.extractfile(member)as f:assert f.read(4)==b'ABC'
        return finish_tar_record(t,tracked)
case('exact-stream-gnu-terminator',lambda:read_tar(tar_bytes()))
case('stream-trailing-byte-refusal',lambda:deny(lambda:read_tar(tar_bytes(b'X')),'TRAILING_BYTES'))
output={'scope':'PUBLIC_HOST_EXPORT_HELPER_ONLY','count':len(rows),'rows':rows,'nativeClaims':False,'DockerExecuted':False,'original122':'HELD','ROOT':'ABSENT'}
(D/'controls/export-control-results-run1.json').write_text(json.dumps(output)+'\n');print(json.dumps({'count':len(rows),'failures':[r for r in rows if r['status']!='PASS']}))
if any(r['status']!='PASS'for r in rows):sys.exit(1)
