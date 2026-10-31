"""New operational Source-fault/immutable-binding controls; virtual IO only."""
import copy
import hashlib
import signal
import time
from types import SimpleNamespace

def run(adapter,api,progress=None):
    outcomes=[]
    def test(name,fn):
        began=time.monotonic()
        try:
            detail=fn() or {};outcomes.append(dict(name=name,PASS=True,detail=detail,elapsed=time.monotonic()-began))
        except BaseException as error:
            outcomes.append(dict(name=name,PASS=False,error=repr(error),elapsed=time.monotonic()-began))
        if progress:progress(outcomes[-1])
    def deny(fn):
        try:fn()
        except BaseException as error:return error
        raise AssertionError('expected denial')
    def row(path,raw,index,program=False):
        return dict(path=path,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),nine=dict(zip(api.FIELDS,map(str,(1,index,33152,501,20,1,len(raw),1,1)))),roles=['program' if program else 'control'],nineBasis='DECLARED_ORIGINAL')
    class IO:
        O_RDONLY=0;O_NOFOLLOW=1
        def __init__(self,rows,raws):
            self.rows={r['path']:copy.deepcopy(r)for r in rows};self.raws=raws
            self.fds={};self.opened=[];self.closed=[];self.reads=[];self.events=[]
            self.fault=None;self.hook=None;self.fd=100
        def rel(self,path):return str(path).removeprefix('/bounded-fixture/')
        def event(self,kind,key):
            self.events.append((kind,key))
            if self.hook:self.hook(kind,key)
            if self.fault==kind:
                self.fault=None;raise OSError('owned-'+kind+'-error')
        def stat(self,row):return SimpleNamespace(**{'st_'+key:int(value)for key,value in row['nine'].items()})
        def lstat(self,path):
            self.event('lstat',str(path));rel=self.rel(path)
            return self.stat(self.rows[rel])if rel in self.rows else SimpleNamespace(st_mode=16832)
        def open(self,path,_flags):
            self.event('open',str(path));fd=self.fd;self.fd+=1;self.fds[fd]=self.rel(path);self.opened.append(fd);return fd
        def fstat(self,fd):self.event('fstat',fd);return self.stat(self.rows[self.fds[fd]])
        def pread(self,fd,size,offset):
            self.event('pread',(fd,offset));self.reads.append(self.fds[fd]);return self.raws[self.fds[fd]][offset:offset+size]
        def close(self,fd):
            self.closed.append(fd);self.event('close',fd)
    def fixture(count=3,large=False,raws=None):
        raws=raws or {('member/'+str(i)if large else chr(97+i)):b'value=1\n'for i in range(count)}
        rows=[row(path,raw,i+1,True)for i,(path,raw)in enumerate(raws.items())]
        caller=api.admission_id(rows[0]);edges=[dict(caller=caller,target=api.admission_id(r),operation=op)for r in rows for op in ('read','hash','control','compile')]
        members=rows+[row('custody/'+str(i),b'x',i+10000)for i in range(1907-len(rows))]if large else rows
        recipe=dict(members=members,counts=copy.deepcopy(api.COUNTS),assertions=list(api.ASSERTIONS),futureDATA=[],bodyUseEdges=edges,programApprovals={api.admission_id(r):r['sha256']for r in rows})
        view=adapter.SourceView(recipe,tuple(rows),tuple(members[count:])if large else (),'a'*64,'b'*64,(),object())
        ledger=api.Ledger();io=IO(rows,raws)
        s=adapter.SourceSession(api,'/bounded-fixture',view,ledger,10,'c'*64,lambda v,h,l:adapter.RuntimePermit(object(),v.view_sha256,h,v.phase_sha256),io=io,clock=lambda:999000000000000)
        return s,io,ledger,caller
    def cleanup(s,io,ledger):
        if not s.closed:deny(s.close)if s.failures else s.close()
        assert io.opened==io.closed and len(io.closed)==len(set(io.closed))
        assert not any(owner is s for owner in ledger.owned_fds.values()) and all(r['attempt']==1 for r in s.close_attempts)
    for method in ('pread','lstat','fstat'):
        for caught in (False,True):
            def operational(method=method,caught=caught):
                s,io,l,c=fixture();published=[];later=[]
                def action(owner):
                    io.fault=method
                    if caught:
                        error=deny(lambda:owner.read(c,'a'));assert isinstance(error,OSError)
                        before=len(io.events)
                        later.append(deny(lambda:adapter.root_compile(owner,c,'b')))
                        assert len(io.events)==before and 'prior_Source_failure' in str(later[-1])
                        return 'caught-operation'
                    return owner.read(c,'a')
                error=deny(lambda:s.run(c,action,lambda value:published.append(value)))
                assert isinstance(error,adapter.Failures)and not published
                assert any(isinstance(e,OSError)and 'owned-'+method in str(e)for _,e in error.failures)
                assert s.final_checked and {'a','b','c'}<=set(io.reads)
                cleanup(s,io,l);return {'onceCloses':len(io.closed),'stickyOperationalError':True,'published':False}
            test('P4_'+method+('_caught'if caught else '_uncaught')+'_no_compile_or_publication_all_final_checks',operational)
    for caught in (False,True):
        def compilation(caught=caught):
            s,io,l,c=fixture(raws={'a':b'not valid !\n','b':b'value=1\n','c':b'value=2\n'});published=[]
            def action(owner):
                if caught:
                    assert isinstance(deny(lambda:adapter.root_compile(owner,c,'a')),SyntaxError)
                    before=len(io.events);deny(lambda:adapter.root_compile(owner,c,'b'));assert len(io.events)==before
                    return 'caught'
                return adapter.root_compile(owner,c,'a')
            error=deny(lambda:s.run(c,action,lambda v:published.append(v)))
            assert isinstance(error,adapter.Failures)and not published and s.final_checked
            assert any(isinstance(e,SyntaxError)for _,e in error.failures);cleanup(s,io,l)
        test('owned_compile_SyntaxError_'+('caught'if caught else 'uncaught')+'_sticky_no_later_compile',compilation)
    def open_error():
        s,io,l,c=fixture();io.fault='open';called=[]
        error=deny(lambda:s.run(c,lambda owner:called.append(1)))
        assert isinstance(error,adapter.Failures)and not called and not io.opened;cleanup(s,io,l)
    test('owned_open_error_sticky_before_action',open_error)
    for kind in ('row','view','recipe','edge','program','row_dict_bypass','nine_dict_bypass','ledger_role','debt_removed','ledger_removed','row_map_replaced','version_reset'):
        def changed(kind=kind):
            s,io,l,c=fixture();s.open_all(c);s.read(c,'a');before=len(io.events)
            if kind=='row':s.rows['a']['nine']['ctime_ns']='2'
            if kind=='view':s.view.rows[0]['nine']['ctime_ns']='2'
            if kind=='recipe':s.view.recipe['futureDATA'].append({'path':'new'})
            if kind=='edge':s.view.recipe['bodyUseEdges'][0]['operation']='parse'
            if kind=='program':s.view.recipe['programApprovals'].clear()
            if kind=='row_dict_bypass':dict.__setitem__(s.rows['a'],'roles',['unexpected'])
            if kind=='nine_dict_bypass':dict.__setitem__(s.rows['a']['nine'],'ctime_ns','2')
            if kind=='ledger_role':next(iter(l.rows.values()))['roles']=['unexpected']
            if kind=='debt_removed':l.read_debts.clear()
            if kind=='ledger_removed':l.rows.pop(next(iter(l.rows)))
            if kind=='row_map_replaced':s.rows=copy.deepcopy(s.rows)
            if kind=='version_reset':
                s.rows['a']['nine']['ctime_ns']='2'
                assert isinstance(deny(lambda:setattr(s._journal,'_version',0)),adapter.Denied)
            deny(lambda:adapter.root_compile(s,c,'a'));assert len(io.events)==before and s._failed
            cleanup(s,io,l)
        test('immutable_ownership_monotonic_'+kind+'_denies_before_IO_compile',changed)
    def callback_error():
        s,io,l,c=fixture();s.open_all(c);mf=adapter.collector_manifest(s,c)
        plan={'sourceViewSha256':s.view.view_sha256,'sourceMemberPaths':list(s.rows)}
        raw={'plan':adapter.encode(plan),'MF':adapter.encode(mf),'approval':adapter.encode({'PASS':True})}
        rows=[row(k,v,i+500)for i,(k,v)in enumerate(raw.items())]
        edges=[dict(caller=c,target=api.admission_id(r),operation=op)for r in rows for op in ('read','hash','control')]
        view=adapter.SourceView(dict(futureDATA=[],bodyUseEdges=edges,programApprovals={}),tuple(rows),(),'d'*64,'b'*64,(),object())
        cio=IO(rows,raw);cio.fd=1000
        cs=adapter.SourceSession(api,'/bounded-fixture',view,l,10,'c'*64,lambda v,h,l:adapter.RuntimePermit(object(),v.view_sha256,h,v.phase_sha256),io=cio,clock=lambda:999000000000000);cs.open_all(c)
        def callback(*_):raise OSError('approval-callback-owned-error')
        assert isinstance(deny(lambda:adapter.guard_source_contract(s,c,cs.borrow(c),'plan','MF','approval',callback)),OSError)
        before=len(io.events)+len(cio.events);deny(lambda:adapter.root_compile(s,c,'a'))
        assert before==len(io.events)+len(cio.events)and s._failed and cs._failed
        cs.final(c);s.final(c);cleanup(cs,cio,l);cleanup(s,io,l)
    test('G_actual_qualified_callback_error_poison_both_owners_not_safe_validation',callback_error)
    def negative_validation():
        s,io,l,c=fixture();s.open_all(c);lease=s.borrow(c);bad=lease.lookup('a');bad['nine']['ino']='999'
        before=len(io.events);deny(lambda:lease.read(bad));assert len(io.events)==before
        lease.release();deny(lambda:lease.read(lease.rows[0]));assert not s._failed
        s.final(c);s.close();cleanup(s,io,l)
    test('original_safe_rejected_borrow_validation_healthy_final_cleanup',negative_validation)
    for action_name in ('collector','compile-borrow'):
        def large(action_name=action_name):
            s,io,l,c=fixture(129,True);published=[];started=time.monotonic()
            old=signal.getsignal(signal.SIGALRM)
            def timeout(*_):raise TimeoutError('SOURCE_MOCK_120s_1907_shape_deadline')
            signal.signal(signal.SIGALRM,timeout);signal.setitimer(signal.ITIMER_REAL,120)
            try:
                def action(owner):
                    if action_name=='collector':return adapter.collector_manifest(owner,c)
                    code=adapter.root_compile(owner,c,'member/0');lease=owner.borrow(c)
                    assert code.co_filename=='member/0'and lease.read(lease.lookup('member/128'))==b'value=1\n';lease.release()
                    return 'compiled-borrowed'
                result=s.run(c,action,lambda value:published.append(value))
            finally:
                signal.setitimer(signal.ITIMER_REAL,0);signal.signal(signal.SIGALRM,old)
                cleanup(s,io,l)
            assert len(published)==1 and s.final_checked and len(io.opened)==129
            assert s.seal_hash_computations==1 and len(s.view.recipe['members'])==1907
            assert len(s.view.custody_rows)==1778 and not any(path.startswith('custody/')for path in io.reads)
            return {'recipeMembers':1907,'SourceMembers':129,'actualCustodySubjectsNotExecuted':1914,'fullOwnedBindingHashComputations':s.seal_hash_computations,'ownedBindingEncodedBytes':s.seal_bytes,'boundaryChecks':s.boundary_checks,'SourceIOEvents':len(io.events),'ownedFDPeak':l.peak_owned_fds,'onceCloses':len(io.closed),'deadlineSeconds':120,'elapsed':time.monotonic()-started,'originalActualDeadlinesUnchanged':True}
        test('bounded_concrete1907_shape_'+action_name+'_one_seal_fresh_ledger_IO_final_cleanup',large)
    return dict(scope='AUTHOR_SOURCE_MOCK_N3_OPERATIONAL_AND_PERFORMANCE_ONLY',conditions=outcomes,PASS=sum(r['PASS']for r in outcomes),FAIL=sum(not r['PASS']for r in outcomes),effects=0,sourceEligibility=False)
