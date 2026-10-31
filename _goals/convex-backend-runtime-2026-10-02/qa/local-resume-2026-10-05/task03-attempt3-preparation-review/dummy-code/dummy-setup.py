import json, os
from pathlib import Path
assert os.getuid()==0
root=Path('/owned');assert not list(root.iterdir())
os.chown(root,501,20);os.chmod(root,0o700)
def directory(p):p.mkdir();os.chown(p,501,20);os.chmod(p,0o700)
directory(root/'healthy');directory(root/'healthy/private');directory(root/'cases')
template=json.loads(Path('/review/dummy-template.json').read_text())['files']
names=['source-dir-alias','source-ancestor-alias','destination-alias','foreign-source-group','foreign-file-group','stale-stage-operation','stale-stage-request','target-request-drift','retired-target-selector','duplicate-manifest-rows','oversized-selected-file','postreceipt-source-replacement','postreceipt-source-content-drift','postreceipt-destination-replacement','postreceipt-destination-directory-replacement','postreceipt-held-read-failure']+[f'postreceipt-identity-{k}' for k in ('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')]
for name in names:
    p=root/'cases'/name;directory(p);directory(p/'source');directory(p/'private')
    for key,data in template.items():
        f=p/'source'/key;f.write_bytes(bytes.fromhex(data));os.chown(f,501,20);os.chmod(f,0o600)
    if name=='source-dir-alias':(p/'source').rename(p/'retained-source');(p/'source').symlink_to(p/'retained-source')
    elif name=='source-ancestor-alias':(p/'alias').symlink_to(p)
    elif name=='destination-alias':(p/'private').rename(p/'retained-private');(p/'private').symlink_to(p/'retained-private')
    elif name=='foreign-source-group':os.chown(p/'source',501,21)
    elif name=='foreign-file-group':os.chown(p/'source/deploy.env',501,21)
    elif name in ('stale-stage-operation','stale-stage-request','duplicate-manifest-rows'):
        m=p/'source/transport-stage.json';j=json.loads(m.read_bytes())
        if name=='stale-stage-operation':j['operation']='old-operation'
        elif name=='stale-stage-request':j['requestSha256']='0'*64
        else:j['files']=[j['files'][0]]*3
        m.write_text(json.dumps(j))
    elif name in ('target-request-drift','retired-target-selector'):
        import hashlib
        f=p/'source/target.json';j=json.loads(f.read_bytes())
        if name=='target-request-drift':j['requestSha256']='0'*64
        else:j['deploymentName']='joyous-ostrich-974'
        f.write_text(json.dumps(j));m=p/'source/transport-stage.json';j=json.loads(m.read_bytes())
        next(r for r in j['files'] if r['path']=='target.json')['sha256']=hashlib.sha256(f.read_bytes()).hexdigest();m.write_text(json.dumps(j))
    elif name=='oversized-selected-file':(p/'source/deploy.env').write_bytes(b'PUBLIC_DUMMY'*6000)
print(json.dumps({'status':'PASS','publicDummyCasesPrepared':len(names),'exportMount':False,'actualPrivateReads':0,'serviceCalls':0}))
