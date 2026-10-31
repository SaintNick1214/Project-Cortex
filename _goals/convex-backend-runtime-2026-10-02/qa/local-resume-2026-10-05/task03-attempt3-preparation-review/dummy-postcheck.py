import json,os
from pathlib import Path
assert os.getuid()==0
rows=[]
for p in sorted(Path('/owned/cases').iterdir()):
    if p.name.startswith('postreceipt-'):
        d=p/'retained-private' if p.name=='postreceipt-destination-directory-replacement' else p/'private'
        assert sorted(f.name for f in d.iterdir())==['deploy.env','jwt-private.pem','private-receive-custody.json','target.json'],p.name
        if p.name=='postreceipt-destination-directory-replacement':assert not list((p/'private').iterdir())
        files=4
    else:assert not list((p/'private').iterdir());files=0
    rows.append({'name':p.name,'status':'PASS','outputFilesRetained':files})
print(json.dumps({'scope':'INDEPENDENT_PUBLIC_DUMMY_ROOT_POSTCHECK_ONLY','status':'PASS','cases':len(rows),'results':rows,'exportMounted':False,'actualPrivateReads':0,'serviceCalls':0}))
