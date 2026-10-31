"""Evaluate copy denials before ANY native syscall/child; no effect substitution PASS."""
import json
from pathlib import Path
import sys
D=Path(__file__).resolve().parents[1];sys.path.insert(0,str(D/'source'))
from copy_file import copy_file
root=D/'controls/copy-boundary-fixture-run1';root.mkdir();target=root/'existing';target.write_bytes(b'PRESERVE_PUBLIC')
cases=[('invalid-id','bad','/var/tmp/file',root/'fresh',1,'EXACT_FINITE'),
 ('relative-path','a'*64,'relative',root/'fresh',1,'EXACT_FINITE'),
 ('parent-path','a'*64,'/var/tmp/../unknown',root/'fresh',1,'EXACT_FINITE'),
 ('float-bound','a'*64,'/var/tmp/file',root/'fresh',1.0,'EXACT_FINITE'),
 ('boolean-bound','a'*64,'/var/tmp/file',root/'fresh',True,'EXACT_FINITE'),
 ('oversize-bound','a'*64,'/var/tmp/file',root/'fresh',536870913,'EXACT_FINITE'),
 ('negative-bound','a'*64,'/var/tmp/file',root/'fresh',-1,'EXACT_FINITE'),
 ('preexisting-target','a'*64,'/var/tmp/file',target,1,'NEW_COPY_TARGET')]
rows=[]
for name,cid,path,out,cap,expected in cases:
 try:
  try:copy_file(cid,path,out,cap)
  except ValueError as e:assert expected in str(e)
  else:raise AssertionError('DENIAL_MISSING')
  assert target.read_bytes()==b'PRESERVE_PUBLIC'and not(root/'fresh').exists();rows.append({'name':name,'status':'PASS'})
 except BaseException as e:rows.append({'name':name,'status':'FAIL','error':repr(e)})
value={'scope':'PUBLIC_HOST_PRE_DISPATCH_DENIALS_ONLY','count':len(rows),'rows':rows,'nativeSyscallsExecuted':0,'DockerExecuted':False}
(D/'controls/copy-boundary-results-run1.json').write_text(json.dumps(value)+'\n');print(json.dumps(value));assert all(r['status']=='PASS'for r in rows)
