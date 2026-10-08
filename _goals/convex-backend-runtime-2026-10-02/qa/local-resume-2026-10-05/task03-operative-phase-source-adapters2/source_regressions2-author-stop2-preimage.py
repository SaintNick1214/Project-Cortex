"""Focused author Source/MOCK regressions; no independent or runtime authority."""
import copy
import hashlib
import os
from pathlib import Path
from types import SimpleNamespace

def run(adapter,api):
    results=[]
    def test(name,fn):
        try:fn();results.append({'name':name,'PASS':True})
        except BaseException as error:results.append({'name':name,'PASS':False,'error':repr(error)})
    def deny(fn):
        try:fn()
        except BaseException as error:return error
        raise AssertionError('expected denial did not occur')
    def row(path,raw=b'x',index=1,roles=('control',)):
        return {'path':path,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                'nine':dict(zip(api.FIELDS,map(str,(1,index,33152,501,20,1,len(raw),1,1)))),
                'roles':list(roles),'nineBasis':'DECLARED_ORIGINAL'}
    class IO:
        O_RDONLY=0;O_NOFOLLOW=1
        def __init__(self,rows,raws):
            self.rows={r['path']:copy.deepcopy(r) for r in rows};self.raws=dict(raws)
            self.events=[];self.fds={};self.opened=[];self.closed=[];self.reads=[]
            self.hook=None;self.symlinks=set();self.close_fault=False;self.counter=100
        def relative(self,path):return str(path).removeprefix('/bounded-fixture/')
        def event(self,kind,key):
            self.events.append((kind,key))
            if self.hook:self.hook(kind,key)
        def stat(self,r):return SimpleNamespace(**{'st_'+k:int(v) for k,v in r['nine'].items()})
        def lstat(self,path):
            p=str(path);self.event('lstat',p)
            if p in self.symlinks:return SimpleNamespace(st_mode=41471)
            rel=self.relative(path)
            return self.stat(self.rows[rel]) if rel in self.rows else SimpleNamespace(st_mode=16832)
        def open(self,path,flags):
            rel=self.relative(path);self.event('open',rel)
            fd=self.counter;self.counter+=1;self.fds[fd]=rel;self.opened.append(fd);return fd
        def fstat(self,fd):self.event('fstat',fd);return self.stat(self.rows[self.fds[fd]])
        def pread(self,fd,size,offset):
            self.event('pread',(fd,offset));self.reads.append(self.fds[fd]);return self.raws[self.fds[fd]][offset:offset+size]
        def close(self,fd):
            self.event('close',fd);self.closed.append(fd)
            if self.close_fault:raise OSError('close-failure-after-once-attempt')
    def fixture(ledger=None,raws=None,program=False,caller=None):
        raws=raws or {'a':b'1','b':b'2','c':b'3'}
        rows=[row(k,v,i+1,('program',) if program and i==0 else ('control',)) for i,(k,v) in enumerate(raws.items())]
        caller=caller or api.admission_id(rows[0]);edges=[]
        for r in rows:
            for op in ('read','hash','compile','control'):edges.append({'caller':caller,'target':api.admission_id(r),'operation':op})
        recipe={'futureDATA':[],'bodyUseEdges':edges,'programApprovals':{api.admission_id(r):r['sha256'] for r in rows if 'program' in r['roles']}}
        view=adapter.SourceView(recipe,tuple(rows),(),'a'*64,'b'*64,(),object())
        ledger=ledger if ledger is not None else api.Ledger();io=IO(rows,raws)
        s=adapter.SourceSession(api,'/bounded-fixture',view,ledger,10,'c'*64,
              lambda v,h,l:adapter.RuntimePermit(object(),v.view_sha256,h,v.phase_sha256),io=io,clock=lambda:999000000000000)
        io.counter=max([99]+list(ledger.owned_fds))+1
        return s,io,ledger,caller
    def grow(ledger,total=62914621):
        remaining=total-ledger.byte_count;index=0
        assert remaining>=0
        while remaining:
            size=min(remaining,api.CAPS['file']);r=row('late/'+str(index),b'',9000+index)
            r['bytes']=size;r['nine']['size']=str(size);ledger.admit(r,debt=True,reason='EXPLICIT_MOCK_PRIOR_ROOT_BODY_READ')
            remaining-=size;index+=1
        assert ledger.byte_count==total
    def close(s,io):
        if not s.closed:deny(s.close) if s.failures or io.close_fault else s.close()
        assert io.opened==io.closed and len(io.closed)==len(set(io.closed))
        assert not s.owned and all(v['attempt']==1 for v in s.close_attempts)
    def late_before_open():
        s,io,l,c=fixture();grow(l);calls=[]
        error=deny(lambda:s.run(c,lambda _:calls.append('action')))
        assert 'reserves_over64M' in str(error) and not io.events and not calls
        close(s,io);assert l.byte_count==62914621 and len(l.read_debts)==4
    test('P1_late_shared_62914621_plus_original7340032_denies_before_any_IO_or_action',late_before_open)
    for position in ('recipe','proof','phase'):
        def bootstrap_growth(position=position):
            ledger=api.Ledger();boot={};calls=[]
            for i,name in enumerate(('recipe','proof','phase')):
                raw=b'{}';r=row('bootstrap/'+name,raw,500+i)
                boot[name]=adapter.Bootstrap(r,raw);ledger.admit(r,debt=True)
            def held(name,*_):
                calls.append(name)
                if name==position:grow(ledger)
                return True
            error=deny(lambda:adapter.source_view(api,ledger,boot,lambda *_:None,held))
            assert 'reserves_over64M' in str(error)
            assert calls==list(('recipe','proof','phase'))[:list(('recipe','proof','phase')).index(position)+1]
            assert ledger.byte_count==62914621 and not ledger.owned_fds
        test('bootstrap_callback_'+position+'_late_shared_growth_stops_next_verification',bootstrap_growth)
    def constructor_callback_growth():
        s,io,ledger,c=fixture();calls=[]
        def runtime(view,digest,current):
            calls.append(1);grow(current)
            return adapter.RuntimePermit(object(),view.view_sha256,digest,view.phase_sha256)
        error=deny(lambda:adapter.SourceSession(api,'/bounded-fixture',s.view,ledger,10,'c'*64,runtime,io=io,clock=lambda:999000000000000))
        assert calls==[1] and 'reserves_over64M' in str(error) and not io.events
        close(s,io)
    test('runtime_verifier_callback_growth_denies_constructor_without_IO',constructor_callback_growth)
    for hook_kind in ('lstat','open','fstat'):
        def growth_during_open(hook_kind=hook_kind):
            s,io,l,c=fixture();calls=[]
            def hook(kind,key):
                if kind==hook_kind:
                    io.hook=None;grow(l)
            io.hook=hook;error=deny(lambda:s.run(c,lambda _:calls.append('action')))
            assert 'reserves_over64M' in str(error) and not calls and not io.reads
            close(s,io);assert l.byte_count==62914621
        test('P1_growth_at_'+hook_kind+'_denies_next_work_all_owned_close',growth_during_open)
    for op in ('read','hash','compile','borrow','collector','run_action'):
        def after_open(op=op):
            s,io,l,c=fixture(raws={'a':b'value=1\n','b':b'2','c':b'3'},program=True);s.open_all(c)
            before=len(io.events);grow(l)
            functions={'read':lambda:s.read(c,'a'),'hash':lambda:s.read(c,'a','hash'),
                       'compile':lambda:adapter.root_compile(s,c,'a'),'borrow':lambda:s.borrow(c),
                       'collector':lambda:adapter.collector_manifest(s,c),'run_action':lambda:s.check_current()}
            error=deny(functions[op]);assert 'reserves_over64M' in str(error)
            assert len(io.events)==before and not io.reads;close(s,io)
        test('P1_late_growth_before_'+op+'_no_new_IO_compile_or_authority',after_open)
    for hook_kind in ('lstat','fstat','pread'):
        def during_read(hook_kind=hook_kind):
            s,io,l,c=fixture();s.open_all(c)
            def hook(kind,key):
                if kind==hook_kind:io.hook=None;grow(l)
            io.hook=hook;error=deny(lambda:s.read(c,'a'));assert 'reserves_over64M' in str(error)
            assert len(io.reads)<=int(hook_kind=='pread');close(s,io)
            assert l.byte_count==62914621 and api.admission_id(s.rows['a']) in l.read_debts
        test('P1_growth_during_'+hook_kind+'_before_body_or_next_read_keeps_debt',during_read)
    for delta in (0,1):
        def exact_boundary(delta=delta):
            s,io,l,c=fixture();grow(l,api.CAPS['bytes']-7340032+delta)
            if delta:
                error=deny(lambda:s.open_all(c));assert 'reserves_over64M' in str(error) and not io.events
            else:
                s.open_all(c);assert s.read(c,'a')==b'1';s.final(c)
            close(s,io);assert l.byte_count+7340032==api.CAPS['bytes']+delta
        test('original_shared64MiB_with_ALL_original_reserves_boundary_'+str(delta),exact_boundary)
    def compile_interposed_growth():
        s,io,l,c=fixture(raws={'a':b'not valid !\n','b':b'2','c':b'3'},program=True);s.open_all(c)
        read=s.read
        def changed_read(*args,**kwargs):
            raw=read(*args,**kwargs);grow(l);return raw
        s.read=changed_read
        error=deny(lambda:adapter.root_compile(s,c,'a'));assert not isinstance(error,SyntaxError) and 'reserves_over64M' in str(error)
        close(s,io)
    test('P1_current_shared_budget_after_held_read_before_actual_compile',compile_interposed_growth)
    def run_callback_growth(stage):
        s,io,l,c=fixture();actions=[];publications=[]
        def action(_):
            actions.append(1)
            if stage=='action':grow(l)
            return 'result'
        def publish(value):
            publications.append(value)
            if stage=='publish':grow(l)
        error=deny(lambda:s.run(c,action,publish));assert 'reserves_over64M' in str(error)
        assert actions==[1] and publications==([] if stage=='action' else ['result']);close(s,io)
    for stage in ('action','publish'):test('shared_growth_from_'+stage+'_callback_stays_failure_allclose',lambda stage=stage:run_callback_growth(stage))
    def guard_fixture():
        s,io,l,c=fixture();s.open_all(c);mf=adapter.collector_manifest(s,c)
        plan={'sourceViewSha256':s.view.view_sha256,'sourceMemberPaths':list(s.rows)}
        raw={'plan':adapter.encode(plan),'MF':adapter.encode(mf),'approval':adapter.encode({'PASS':True})}
        cs,cio,_,_=fixture(ledger=l,raws=raw,caller=c);cs.open_all(c);borrow=cs.borrow(c)
        return s,io,l,c,mf,cs,cio,borrow
    for variant in ('late-before','growth-callback','physical-main-before','physical-control-before','physical-main-after','physical-control-after',
                    'raw-main-after','raw-control-after','owner-rows-before','owner-rows-after','view-rows-before','control-rows-before','sticky-main-before','sticky-control-before',
                    'docs-copy','view-copy','positive'):
        def guard_case(variant=variant):
            s,io,l,c,mf,cs,cio,b=guard_fixture();calls=[]
            if variant=='late-before':grow(l)
            if variant=='physical-main-before':io.rows['a']['nine']['ctime_ns']='2'
            if variant=='physical-control-before':cio.rows['plan']['nine']['ctime_ns']='2'
            if variant=='owner-rows-before':s.rows['a']['nine']['ctime_ns']='2'
            if variant=='view-rows-before':s.view.rows[0]['nine']['ctime_ns']='2'
            if variant=='control-rows-before':cs.rows['plan']['nine']['ctime_ns']='2'
            if variant=='sticky-main-before':s._failure('prior',OSError('prior-source-failure'))
            if variant=='sticky-control-before':cs._failure('prior',OSError('prior-control-failure'))
            def approval(docs,view,ledger):
                calls.append(1)
                if variant=='growth-callback':grow(ledger)
                if variant=='physical-main-after':io.rows['a']['nine']['ctime_ns']='2'
                if variant=='physical-control-after':cio.rows['plan']['nine']['ctime_ns']='2'
                if variant=='raw-main-after':io.raws['a']=b'Z'
                if variant=='raw-control-after':cio.raws['plan']=b'Z'*len(cio.raws['plan'])
                if variant=='owner-rows-after':s.rows['a']['nine']['ctime_ns']='2'
                if variant=='docs-copy':docs['MF']['files'][0]['PRE9']['ctime_ns']='2'
                if variant=='view-copy':view.rows[0]['nine']['ctime_ns']='2'
                return True
            fn=lambda:adapter.guard_source_contract(s,c,b,'plan','MF','approval',approval)
            if variant in ('positive','docs-copy','view-copy'):
                assert fn()['protectedEffects'] is False and calls==[1]
                assert s.rows['a']['nine']['ctime_ns']=='1' and s.view.rows[0]['nine']['ctime_ns']=='1'
            else:
                deny(fn);assert calls==([] if variant.endswith('before') or variant=='late-before' else [1])
            close(cs,cio);close(s,io)
        test('G_actual_Source_and_control_pre_post_callback_'+variant,guard_case)
    def detached_nines():
        s,io,l,c=fixture();s.open_all(c);mf=adapter.collector_manifest(s,c)
        original=copy.deepcopy(s.rows['a']['nine']);r=mf['files'][0]
        assert len({id(r[k]) for k in ('PRE9','OPEN9','POST9')}|{id(s.rows['a']['nine'])})==4
        r['OPEN9']['ctime_ns']='2'
        assert r['PRE9']==r['POST9']==s.rows['a']['nine']==original and io.rows['a']['nine']==original
        plan={'sourceViewSha256':s.view.view_sha256,'sourceMemberPaths':list(s.rows)}
        raw={'plan':adapter.encode(plan),'MF':adapter.encode(mf),'approval':adapter.encode({'PASS':True})}
        cs,cio,_,_=fixture(ledger=l,raws=raw,caller=c);cs.open_all(c);calls=[]
        error=deny(lambda:adapter.guard_source_contract(s,c,cs.borrow(c),'plan','MF','approval',lambda *_:calls.append(1) or True))
        assert 'G_original_Source_tuple' in str(error) and not calls;close(cs,cio);close(s,io)
    test('P3_collector_all_three_nines_detached_owner_and_each_other_G_mutation_denied',detached_nines)
    for path in ('../a','/a','a/../b','a//b','./a','a/','a\\b','a\x00b',''):
        def invalid_path(path=path):
            s,io,l,c=fixture();deny(lambda:s._path(path));assert not io.events;close(s,io)
        test('P2_lexically_rejected_before_IO_'+repr(path),invalid_path)
    def canary():
        s,io,l,c=fixture();old_resolve=Path.resolve;old_lstat=os.lstat;old_stat=os.stat
        def forbidden(*_a,**_k):raise AssertionError('ordinary_path_metadata_outside_injected_IO')
        try:
            Path.resolve=forbidden;os.lstat=forbidden;os.stat=forbidden
            s.open_all(c);assert s.read(c,'a')==b'1';s.final(c)
        finally:Path.resolve=old_resolve;os.lstat=old_lstat;os.stat=old_stat;close(s,io)
        assert io.events[0:3]==[('lstat','/'),('lstat','/bounded-fixture'),('lstat','/bounded-fixture/a')]
    test('P2_all_real_path_metadata_canaries_absent_root_first_injected_IO_positive',canary)
    for symlink in ('/','/bounded-fixture','/bounded-fixture/a'):
        def symlink_case(symlink=symlink):
            s,io,l,c=fixture();io.symlinks.add(symlink);deny(lambda:s.open_all(c));assert not io.opened;close(s,io)
        test('P2_injected_symlink_'+symlink+'_denied_before_open',symlink_case)
    def stale_before_read():
        s,io,l,c=fixture();s.open_all(c);io.rows['a']['nine']['ctime_ns']='2'
        error=deny(lambda:s.read(c,'a'));assert 'identity' in str(error) and not io.reads;close(s,io)
    test('physical_nine_changed_after_open_denied_before_member_body',stale_before_read)
    for corruption in ('paths','debt','row','unknown','FDcap'):
        def corrupt(corruption=corruption):
            s,io,l,c=fixture()
            if corruption=='paths':l.paths.clear()
            if corruption=='debt':l.read_debts.add('f'*64)
            if corruption=='row':next(iter(l.rows.values()))['nine']['ctime_ns']='2'
            if corruption=='unknown':l.unknown_close=True
            if corruption=='FDcap':l.owned_fds={i:object() for i in range(4097)}
            deny(lambda:s.open_all(c));assert not io.events and not io.closed
        test('current_shared_ledger_'+corruption+'_denial_before_IO_no_foreign_close',corrupt)
    def debt_sticky_close():
        s,io,l,c=fixture();s.open_all(c);grow(l);io.close_fault=True
        error=deny(s.close);assert len(io.closed)==3 and len(set(io.closed))==3
        assert len([stage for stage,_ in error.failures if stage.startswith('owned_close')])==3
        assert l.unknown_close and l.byte_count==62914621 and not l.owned_fds
        before=len(io.events);deny(lambda:s.close());assert len(io.events)==before
    test('late_budget_and_allclose_failures_sticky_debt_allattempted_no_retry',debt_sticky_close)
    return {'scope':'AUTHOR_SOURCE_MOCK_REGRESSIONS_ONLY_NOT_AUTHORITY','conditions':results,
            'PASS':sum(r['PASS'] for r in results),'FAIL':sum(not r['PASS'] for r in results),
            'effects':0,'sourceEligibility':False}
