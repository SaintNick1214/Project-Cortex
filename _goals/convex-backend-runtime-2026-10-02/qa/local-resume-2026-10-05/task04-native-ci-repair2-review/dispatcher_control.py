"""Actual ci-run call failure/retention seam with host-created owned child only."""
import ast
import hashlib
import json
import os
import sys
import time
from types import SimpleNamespace
from review_checks import R,W,save,convert

bounded={'__name__':'reviewed_bounded_dispatcher'}
exec(compile(ast.parse((W/'bounded_process.py').read_bytes()),str(W/'bounded_process.py'),'exec'),bounded)
ns={'bounded_command':bounded['bounded_command'],'CollectionFailure':bounded['CollectionFailure'],
    'hashlib':hashlib,'json':json,'os':os,'time':time,'SimpleNamespace':SimpleNamespace,
    'CALL_COUNT':0,'CALL_BYTES':0,'JOB_DEADLINE':None,'CLEANUP_MODE':False,'CALL_DIR':R/'dispatcher-command-receipts'}
ns['CALL_DIR'].mkdir()
tree=ast.parse((W/'ci-run.py').read_bytes())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['call','record_command','new_receipt']],type_ignores=[]),'<actual dispatcher body>','exec'),ns)
try:
    ns['call']([sys.executable,'-c','import os,time;os.write(1,b"abcdefghijklmnop");time.sleep(8)'],maximum=13,timeout=1)
except bounded['CollectionFailure'] as e:
    assert str(e)=='COMMAND_STDOUT_OVERFLOW'
    assert e.receipt['stdout']==b'abcdefghijklm' and e.receipt['terminal'] and not e.receipt['closeErrors']
    row=json.loads((ns['CALL_DIR']/'command-00000.json').read_bytes())
    raw=(ns['CALL_DIR']/'command-00000.stdout').read_bytes()
    assert raw==b'abcdefghijklm' and row['stdout']['bytes']==13 and row['stdout']['sha256']==hashlib.sha256(raw).hexdigest()
    assert row['terminal'] and row['exit'] is not None and row['authorityMode']=='BOOTSTRAP_CREATED_POPEN_HANDLE_ONLY_NOT_TASK04'
    check={'name':'actual_dispatcher_failed_bound_preserves_raw_output_and_terminal','scope':'ACTUAL_HOST_CI_CALL_SOURCE_PUBLIC_DUMMY_NOT_DOCKER_OR_NATIVE_LINUX','outcome':'ASSERTIONS_PASSED','observation':row}
else:raise AssertionError('dispatcher admitted overflow')
old=(R/'independent-controls.json').read_bytes()
(R/'independent-controls-initial9-preserved.json').write_bytes(old)
d=json.loads(old);assert d['count']==len(d['checks'])==9
d['checks'].append(check);d['count']=10
(R/'independent-controls.json').write_text(json.dumps(d,indent=2)+'\n')
save('dispatcher-control-result.json',check)
print(json.dumps({'checks':10,'status':'ASSERTIONS_PASSED','nativeRuntime':'HELD'}))
