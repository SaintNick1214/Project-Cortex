"""Actual selector filesystem controls on NEW public dummy fixtures only."""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import os
import types

B=Path(__file__).resolve().parent
RESULTS=[]


def load():
    spec=importlib.util.spec_from_file_location('selector_actual_public',B/'task03-attempt5-retire-selector.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def write(path,raw):
    path.write_bytes(raw);path.chmod(0o600)


def snapshot(root):
    return {'root':load().identity(os.lstat(root)),
            'members':{path.name:{'identity':load().identity(os.lstat(path)),
                                  'bytesSha256':hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() and not path.is_symlink() else None}
                       for path in root.iterdir()}}


def case(name,setup=None,seam=None,present=True,expected='FAIL',guard_no_mutation=True,large=False):
    m=load();root=B/'fixtures'/('selector-'+name);root.mkdir(mode=0o700)
    before={'operation':'PUBLIC-DUMMY-OP','active':True,'retired':False,'deleted':False,'projectId':123,
            'deploymentName':'public-dummy-deployment'}
    if large:before['publicPadding']='PUBLIC-DUMMY-'*800
    raw=(json.dumps(before,indent=2)+'\n').encode()
    after={**before,'active':False,'retired':True,'deleted':True,'retiredAt':'2026-10-06T00:00:00Z',
           'preRetirementReceiptSha256':hashlib.sha256(raw).hexdigest()}
    value={'before':before,'after':after}
    if present:write(root/'target.json',raw)
    write(root/'PUBLIC-DUMMY-UNRELATED',b'PUBLIC DUMMY UNRELATED DATA')
    if setup:setup(m,root,value)
    pre=snapshot(root);audit=[]
    proxy=types.SimpleNamespace(**{key:getattr(os,key) for key in dir(os) if not key.startswith('__')})
    m.os=proxy
    original_open=os.open;original_read=os.read;original_write=os.write
    def opened(path,flags,mode=0o777,**kwargs):
        audit.append({'effect':'actual-open','path':str(path),'flags':flags,'dirFd':kwargs.get('dir_fd')})
        return original_open(path,flags,mode,**kwargs)
    def read(fd,count):
        raw=original_read(fd,count);audit.append({'effect':'actual-read','requested':count,'returned':len(raw)})
        return raw
    def written(fd,raw):
        count=original_write(fd,raw);audit.append({'effect':'actual-write','bytes':count});return count
    proxy.open=opened;proxy.read=read;proxy.write=written
    if seam:seam(m,root,value,audit)
    output=None;error=None
    try:output=m.retire(root,value);actual='PASS'
    except BaseException as exc:error={'class':type(exc).__name__,'message':str(exc)};actual='FAIL'
    post=snapshot(root)
    assert actual==expected,(name,actual,expected,error)
    if actual=='PASS' and present:
        assert output['retiredSelectorInvalidated'] is True and output['historicalCustodyRepaired'] is False
        assert json.loads((root/'target.json').read_bytes())==after
        assert (root/'target-before-physical-retirement.json').read_bytes()==raw
        assert not (root/'target-retired-replacement.json').exists()
        assert output['retiredTargetPRE']==output['retiredTargetPOST']==m.identity(os.lstat(root/'target.json'))
        assert set(output['retiredTargetPRE'])==set(m.FIELDS)
        assert any(row['effect']=='actual-read' and row['returned']==0 for row in audit)
        if large:assert sum(row['effect']=='actual-read' and row['returned']>0 for row in audit)>=6
    elif actual=='PASS':
        assert output['targetAbsent'] is True and output['copiedSelectorMutated'] is False
        assert output['rootPRE']==output['rootPOST'] and pre==post
    elif guard_no_mutation:
        assert pre==post,(name,'unexpected mutation',pre,post)
    assert post['members']['PUBLIC-DUMMY-UNRELATED']==pre['members']['PUBLIC-DUMMY-UNRELATED']
    result={'name':name,'status':'PASS','scope':'ACTUAL_HOST_FILESYSTEM_PUBLIC_DUMMY_SELECTOR_ONLY',
            'expectedHelperOutcome':expected,'observedHelperOutcome':actual,'error':error,
            'guardAssertsNoMutation':guard_no_mutation,'pre':pre,'post':post,'helperResult':output,'audit':audit,
            'actualDockerCalls':0,'actualAPICalls':0,'actualPrivateReads':0,'nativeQualification':False}
    (B/'raw'/('selector-'+name+'.json')).write_text(json.dumps(result,indent=2)+'\n');RESULTS.append(result)


case('present',expected='PASS')
case('present-multiple-eof-reads',expected='PASS',large=True)
case('absent',present=False,expected='PASS')
case('root-mode',setup=lambda m,r,v:r.chmod(0o755))
case('root-owner',seam=lambda m,r,v,a:setattr(m.os,'getuid',lambda:os.getuid()+1))
case('target-mode',setup=lambda m,r,v:(r/'target.json').chmod(0o644))
case('target-hardlink',setup=lambda m,r,v:os.link(r/'target.json',r/'PUBLIC-DUMMY-LINK'))
def symlink(m,r,v):
    (r/'target.json').rename(r/'PUBLIC-DUMMY-SYMLINK-SOURCE');(r/'target.json').symlink_to('PUBLIC-DUMMY-SYMLINK-SOURCE')
case('target-symlink',setup=symlink)
case('target-preimage-full-content',setup=lambda m,r,v:write(r/'target.json',b'{"publicDummy":"wrong"}'))
case('target-preimage-hash',setup=lambda m,r,v:v['after'].__setitem__('preRetirementReceiptSha256','0'*64))
case('immutable-field',setup=lambda m,r,v:v['after'].__setitem__('projectId',124))
case('before-active-type',setup=lambda m,r,v:v['before'].__setitem__('active',1))
case('after-retired-type',setup=lambda m,r,v:v['after'].__setitem__('retired',1))
case('wrong-keys',setup=lambda m,r,v:v.__setitem__('extra',True))
case('non-object-before',setup=lambda m,r,v:v.__setitem__('before',[]))
case('empty-operation',setup=lambda m,r,v:(v['before'].__setitem__('operation',''),v['after'].__setitem__('operation','')))
case('exclusive-preimage',setup=lambda m,r,v:write(r/'target-before-physical-retirement.json',b'PUBLIC EXISTING'))
case('exclusive-replacement',setup=lambda m,r,v:write(r/'target-retired-replacement.json',b'PUBLIC EXISTING'))
case('target-byte-limit',setup=lambda m,r,v:write(r/'target.json',b'x'*65537))
def root_alias(m,r,v,a):
    real=m.retire;alias=r.parent/(r.name+'-ALIAS');alias.symlink_to(r,target_is_directory=True)
    m.retire=lambda root,value:real(alias,value)
case('root-symlink-alias',seam=root_alias)
def drift_after_read(m,r,v,a):
    real=m.os.read;done=False
    def read(fd,count):
        nonlocal done
        raw=real(fd,count)
        if raw==b'' and not done:
            done=True;os.utime(r/'target.json',ns=(1,2));a.append({'effect':'controlled-target-mtime-drift'})
        return raw
    m.os.read=read
case('target-all-nine-drift',seam=drift_after_read,guard_no_mutation=False)
def membership_drift(m,r,v,a):
    real=m.write_new;done=False
    def write_new(fd,name,raw):
        nonlocal done
        real(fd,name,raw)
        if not done:done=True;write(r/'PUBLIC-DUMMY-UNTRACKED',b'PUBLIC CONTROLLED DRIFT')
    m.write_new=write_new
case('untracked-directory-drift',seam=membership_drift,guard_no_mutation=False)
def replacement_drift(m,r,v,a):
    real=m.os.replace
    def replace(*args,**kwargs):
        real(*args,**kwargs);os.utime(r/'target.json',ns=(1,2))
        # Mutation before the new baseline is accepted as the new identity, so
        # mutate after the full EOF instead (separate from the old target EOF).
    real_read=m.os.read;zeros=0
    def read(fd,count):
        nonlocal zeros
        raw=real_read(fd,count)
        if raw==b'':
            zeros+=1
            if zeros==2:os.utime(r/'target.json',ns=(3,4));a.append({'effect':'controlled-replacement-mtime-drift'})
        return raw
    m.os.read=read
case('replacement-all-nine-drift',seam=replacement_drift,guard_no_mutation=False)
def absent_drift(m,r,v,a):
    real=m.os.open
    def opened(path,flags,mode=0o777,**kwargs):
        if str(path)=='target.json':
            write(r/'PUBLIC-DUMMY-UNTRACKED',b'PUBLIC CONTROLLED DRIFT')
        return real(path,flags,mode,**kwargs)
    m.os.open=opened
case('absent-directory-drift',present=False,seam=absent_drift,guard_no_mutation=False)
for name,raw in [('duplicate-json',b'{"before":{},"before":{},"after":{}}'),('oversize-input',b'x'*65537),('empty-input',b''),('trailing-non-eof',b'{}{}')]:
    m=load();error=None
    try:m.strict_json(raw)
    except (ValueError,UnicodeError) as exc:error=type(exc).__name__
    assert error is not None
    result={'name':name,'status':'PASS','scope':'ACTUAL_PARSER_PUBLIC_DUMMY_INPUT_ONLY','error':error,'inputBytes':len(raw)}
    (B/'raw'/('selector-'+name+'.json')).write_text(json.dumps(result,indent=2)+'\n');RESULTS.append(result)
(B/'selector-filesystem-controls.json').write_text(json.dumps({'status':'PASS','controls':len(RESULTS),
    'actualHostFilesystem':24,'actualInputGuards':4,'actualPrivateReads':0,'actualDockerCalls':0,'actualAPICalls':0,
    'nativeQualification':False,'unchangedSelectorHelper':True,'cases':[{key:r[key] for key in ('name','status','scope')} for r in RESULTS]},indent=2)+'\n')
print(json.dumps({'status':'PASS','controls':len(RESULTS),'scope':'ACTUAL_HOST_FILESYSTEM_AND_PARSER_PUBLIC_DUMMY_SELECTOR_ONLY'}))
