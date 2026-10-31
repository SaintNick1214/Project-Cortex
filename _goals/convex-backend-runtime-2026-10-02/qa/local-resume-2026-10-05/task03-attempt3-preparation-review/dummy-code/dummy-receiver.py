import hashlib, importlib.util, json, os, sys
from pathlib import Path
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('exact_transport','/prep/private-transport.py');t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
assert hashlib.sha256(Path('/prep/private-transport.py').read_bytes()).hexdigest()=='ecb1eff9a9edf025e2b7eb9108580857ff41da8bb54e8956251b219a5bebc23e'
binding=json.loads(Path('/prep/transport-binding.json').read_bytes());results=[]
def fds():return len(list(Path('/proc/self/fd').iterdir()))
def run(name,source,dest,healthy=False):
    before=fds();source_stat=source.lstat();real_write=t.write_exact;real_ident=t.identity;real_pread=t.os.pread;postreceipt=False;hit=False;changed_inode=None
    def hooked_write(root,fd,filename,data):
        nonlocal postreceipt,hit,changed_inode
        result=real_write(root,fd,filename,data)
        if filename=='private-receive-custody.json':
            postreceipt=True
            if name.startswith('postreceipt-'):hit=True
            if name=='postreceipt-source-replacement':
                replacement=source.parent/'public-replacement';replacement.write_bytes(b'PUBLIC_REPLACEMENT_PRESERVE_UNKNOWN');replacement.chmod(0o600);os.replace(replacement,source/'deploy.env');changed_inode=(source/'deploy.env').lstat().st_ino
            elif name=='postreceipt-source-content-drift':(source/'deploy.env').write_bytes(b'PUBLIC_CHANGED_CONTENT_PRESERVE_UNKNOWN')
            elif name=='postreceipt-destination-replacement':
                replacement=dest.parent/'public-replacement';replacement.write_bytes(b'PUBLIC_DESTINATION_REPLACEMENT');replacement.chmod(0o600);os.replace(replacement,dest/'deploy.env');changed_inode=(dest/'deploy.env').lstat().st_ino
            elif name=='postreceipt-destination-directory-replacement':dest.rename(dest.parent/'retained-private');dest.mkdir(mode=0o700)
        return result
    def hooked_identity(s):
        v=real_ident(s)
        if postreceipt and name.startswith('postreceipt-identity-'):
            field=name.removeprefix('postreceipt-identity-');v[field]=str(int(v[field])+1)
        return v
    def hooked_pread(fd,count,offset):
        if postreceipt and name=='postreceipt-held-read-failure':raise OSError('PUBLIC_DUMMY_INJECTED_READ_FAILURE')
        return real_pread(fd,count,offset)
    t.write_exact=hooked_write;t.identity=hooked_identity;t.os.pread=hooked_pread
    error=None;receipt=None
    try:
        try:receipt=t.copy_private(source,dest,binding)
        except BaseException as e:error=type(e).__name__
    finally:t.write_exact=real_write;t.identity=real_ident;t.os.pread=real_pread
    assert fds()==before,name
    if healthy:
        if error is not None: print(json.dumps({'phase':'healthy-failed','errorClass':error,'sourceObserved':t.identity(source_stat),'destinationObserved':t.identity(dest.lstat()),'destinationListing':sorted(f.name for f in dest.iterdir()),'allDataPublicDummy':True}),flush=True)
        assert error is None and len(receipt['files'])==3
        for row in receipt['files']:
            assert len(row['sourceIdentityDecimal'])==len(row['destinationIdentityDecimal'])==9
            assert all(v.isdecimal() for v in row['sourceIdentityDecimal'].values())
            assert (source/row['path']).read_bytes()==(dest/row['path']).read_bytes()
            assert hashlib.sha256((dest/row['path']).read_bytes()).hexdigest()==row['sha256']
            assert t.identity((dest/row['path']).lstat())==row['destinationIdentityDecimal']
        outputs=4
    else:
        assert error is not None,name
        if name.startswith('postreceipt-'):
            assert hit,name
            rdest=dest.parent/'retained-private' if name=='postreceipt-destination-directory-replacement' else dest
            assert (rdest/'private-receive-custody.json').is_file()
            r=json.loads((rdest/'private-receive-custody.json').read_bytes());assert len(r['files'])==3
            assert r['qualificationAccepted'] is False and r['sourceDescriptorHeld'] is True
            if name=='postreceipt-source-replacement':assert (source/'deploy.env').lstat().st_ino==changed_inode
            if name=='postreceipt-source-content-drift':assert (source/'deploy.env').read_bytes()==b'PUBLIC_CHANGED_CONTENT_PRESERVE_UNKNOWN'
            if name=='postreceipt-destination-replacement':assert (dest/'deploy.env').lstat().st_ino==changed_inode
            outputs=4
        else:
            assert not list(dest.iterdir()),name
            outputs=0
    results.append({'name':name,'status':'PASS','rejected':not healthy,'durableReceiptSeamReached':hit,'outputFilesRetained':outputs,'unknownReplacementNotRemoved':name in ('postreceipt-source-replacement','postreceipt-source-content-drift','postreceipt-destination-replacement','postreceipt-destination-directory-replacement'),'heldDescriptorsClosed':True,'identityFieldInjection':name.startswith('postreceipt-identity-'),'sourceOwnerObserved':source_stat.st_uid,'sourceGroupObserved':source_stat.st_gid,'actualPrivateReads':0})
run('healthy-parent-selected-real-child',Path('/export/selected'),Path('/owned/healthy/private'),True)
for p in sorted(Path('/owned/cases').iterdir()):
    source=p/'alias/source' if p.name=='source-ancestor-alias' else p/'source'
    run(p.name,source,p/'private')
assert len(results)==26 and all(r['status']=='PASS' for r in results)
print(json.dumps({'scope':'INDEPENDENT_PUBLIC_DUMMY_TRANSPORT_ONLY','status':'PASS','cases':len(results),'results':results,'actualUid':os.getuid(),'actualGid':os.getgid(),'bindRoot':{'uid':Path('/export').lstat().st_uid,'gid':Path('/export').lstat().st_gid},'selectedChild':{'uid':Path('/export/selected').lstat().st_uid,'gid':Path('/export/selected').lstat().st_gid,'mode':oct(Path('/export/selected').lstat().st_mode&0o777)},'memoryMaxBytes':Path('/sys/fs/cgroup/memory.max').read_text().strip(),'network':'none','compilerNativeCredentialServiceCalls':0}))
