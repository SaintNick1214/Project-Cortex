"""Pure remote schema with explicit synthetic native path; no native assertion."""
import copy
import hashlib
import json
from pathlib import Path
import sys
D=Path(__file__).resolve().parents[1];sys.path.insert(0,str(D/'source'))
from native_contract import Held
from native_export import FIXED,MAX_BYTES,validate_manifest
root=D/'controls/remote-export-fixture-run1';root.mkdir();data=b'PUBLIC_REMOTE_SCHEMA_CONTROL\n'
file=root/'regular';file.write_bytes(data);h=Held(str(file),100);current=h.fence(full=True);h.close()
base='/var/tmp/cortex-task04-native-public/'
literal=base+'python-raw/'+hashlib.sha256(data).hexdigest()
current['path']=literal
baseline={'scope':'FINITE_NATIVE_PUBLIC_EXPORT_ONLY','files':[{'path':base+n,'status':'ABSENT'}for n in FIXED]+[{'path':literal,'status':'EXISTS','current':current}],
          'fileCount':len(FIXED)+1,'existingCount':1,'bytes':len(data),'maxBytes':MAX_BYTES,
          'nativeFunctionalAcceptance':False,'original122':'HELD','ROOT':'ABSENT','runtimeBindingsExpireAtJobEnd':True}
rows=[]

def check(name,mutate=None,positive=False):
    v=copy.deepcopy(baseline)
    try:
        if mutate:mutate(v)
        if positive:assert validate_manifest(v)==v
        else:
            try:validate_manifest(v)
            except ValueError:pass
            else:raise AssertionError('UNSAFE_REMOTE_EXPORT_ACCEPTED')
        rows.append({'name':name,'status':'PASS'})
    except BaseException as error:rows.append({'name':name,'status':'FAIL','error':repr(error)})

check('complete-fixed-plus-current-raw-positive',positive=True)
check('duplicate-literal-row-denied',lambda v:(v['files'].append(copy.deepcopy(v['files'][0])),v.update(fileCount=v['fileCount']+1)))
check('unknown-outer-field-denied',lambda v:v.update(unknown=True))
check('float-file-count-denied',lambda v:v.update(fileCount=float(v['fileCount'])))
check('boolean-total-denied',lambda v:v.update(bytes=True))
check('missing-fixed-member-denied',lambda v:(v['files'].pop(0),v.update(fileCount=v['fileCount']-1)))
check('unknown-path-denied',lambda v:v['files'][0].update(path=base+'UNKNOWN'))
check('partial-current-denied',lambda v:v['files'][-1]['current'].pop('EOF'))
check('unknown-current-field-denied',lambda v:v['files'][-1]['current'].update(extra=True))
check('float-current-bytes-denied',lambda v:v['files'][-1]['current'].update(bytes=float(len(data))))
check('partial-nine-field-denied',lambda v:v['files'][-1]['current']['PRE']['fields'].pop('gid'))
check('late-path-current-pin-drift-denied',lambda v:v['files'][-1]['current']['pathFINAL']['fields'].update(ino='999999'))
check('raw-SHA-name-mismatch-denied',lambda v:v['files'][-1]['current'].update(sha256='0'*64))
check('inconsistent-byte-total-denied',lambda v:v.update(bytes=len(data)+1))
check('incomplete-public-manifest-cohort-denied',lambda v:(v['files'].append({'path':'/var/tmp/task04-c8-current-canonical-input-producers/public-export-manifest.json','status':'ABSENT'}),v.update(fileCount=v['fileCount']+1)))
value={'scope':'PUBLIC_HOST_REMOTE_SCHEMA_ONLY_EXPLICIT_SYNTHETIC_CANONICAL_PATH','count':len(rows),'rows':rows,
       'DockerExecuted':False,'nativeQualification':False,'actualFixtureEOFAndNineObserved':True,'nativePathIsSynthetic':True}
(D/'controls/remote-export-results-run1.json').write_text(json.dumps(value)+'\n');print(json.dumps(value))
assert all(row['status']=='PASS'for row in rows)
