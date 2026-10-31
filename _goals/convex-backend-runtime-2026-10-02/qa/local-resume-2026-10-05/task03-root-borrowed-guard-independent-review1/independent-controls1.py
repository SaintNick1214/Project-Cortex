"""Independent G bridge controls. Virtual IO only; no external authority or service effects."""
import ast, copy, hashlib, json
from pathlib import Path
from types import SimpleNamespace

def run(A,P,G,author_raw,old_raw,new_raw):
    results=[]; diagnostics=[]
    def test(name,fn,scope='INDEPENDENT_G'):
        try:
            evidence=fn()
            results.append({'name':name,'PASS':True,'scope':scope,'evidence':evidence})
        except BaseException as e:
            results.append({'name':name,'PASS':False,'scope':scope,'errorType':type(e).__name__,'error':str(e)})
    def must_deny(fn):
        try:fn()
        except BaseException as e:return e
        raise AssertionError('required denial absent')
    # Exact held author fixture helpers reused; author test/return nodes excluded.
    parsed=ast.parse(author_raw)
    outer=next(n for n in parsed.body if isinstance(n,ast.FunctionDef) and n.name=='run')
    names={'encode','row','IO','fixture'}
    helpers=[copy.deepcopy(n) for n in outer.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name in names]
    assert {n.name for n in helpers}==names
    fn=ast.FunctionDef(name='make_fixture',args=copy.deepcopy(outer.args),
        body=helpers+[ast.Return(value=ast.Call(func=ast.Name(id='fixture',ctx=ast.Load()),args=[],keywords=[]))],
        decorator_list=[])
    ns={'ast':ast,'copy':copy,'hashlib':hashlib,'json':json,'Path':Path,'SimpleNamespace':SimpleNamespace}
    exec(compile(ast.fix_missing_locations(ast.Module(body=[fn],type_ignores=[])),'held-author-fixture-helper-AST','exec'),ns)
    def fixture():return ns['make_fixture'](A,P,G,old_raw,new_raw)
    def exercise(fn):
        s,b,l,c,v,clean,program,approval=fixture()
        try:return fn(s,b,l,c,v,program,approval)
        finally:clean()
    def lease(b,l,c,verify=lambda *_:True):return G.RootBorrowedGuardLease(b,A,l,c,verify)
    def preserve():
        old=ast.parse(old_raw);new=ast.parse(new_raw)
        nm={n.name:n for n in new.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
        checks=[]
        for n in old.body:
            if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name not in ('source_read','qualify_sources'):
                assert ast.dump(n,include_attributes=False)==ast.dump(nm[n.name],include_attributes=False),n.name
                checks.append(n.name)
        oldq=next(n for n in old.body if isinstance(n,ast.FunctionDef) and n.name=='qualify_sources')
        a=[ast.dump(n,include_attributes=False) for n in ast.walk(oldq) if isinstance(n,ast.Assert)]
        b=[ast.dump(n,include_attributes=False) for n in ast.walk(nm['qualify_sources']) if isinstance(n,ast.Assert)]
        assert all(b.count(v)>=a.count(v) for v in set(a))
        oldas=[ast.dump(n,include_attributes=False) for n in old.body if isinstance(n,(ast.Assign,ast.Import,ast.ImportFrom))]
        newas=[ast.dump(n,include_attributes=False) for n in new.body if isinstance(n,(ast.Assign,ast.Import,ast.ImportFrom))]
        assert oldas==newas
        return {'unchangedDefinitions':checks,'originalQualifierAssertCount':len(a),'constantImportAssignmentsEqual':True}
    test('original_semantic_assertion_constant_and_unrelated_definition_conservation',preserve)
    def positive(s,b,l,c,v,p,ap):
        q=lease(b,l,c);res=G.qualify_sources(q)
        assert res[0]==ap
        before=len(v.closes);counter=l.byte_count
        for row in b.rows:
            projection=q.acquire(G.R/row['path'],row['nine'])
            assert 'fd' not in projection and 'fd' not in projection['member']
        q.release();assert len(v.closes)==before and l.byte_count==counter and not s.closed and len(s.owned)==6
        e=must_deny(lambda:q.read(G.R/p));assert not v.closes
        return {'completeOriginalQualifier':True,'SourceOpens':len(v.fds),'borrowReleaseCloses':0,'rootOwned':len(s.owned),'denial':type(e).__name__}
    test('complete_guard_positive_no_descriptor_export_or_owner_transfer',lambda:exercise(positive))
    for which in ('unknown','owner_failure','borrow_closed','owner_closed','cap_bytes','cap_fds'):
        def case(s,b,l,c,v,p,ap,w=which):
            q=lease(b,l,c);calls=0
            if w=='unknown':l.unknown_close=True
            if w=='owner_failure':s._failure('independent_existing_primary',SystemExit(7))
            if w=='borrow_closed':b.closed=True
            if w=='owner_closed':s.closed=True
            if w=='cap_bytes':l.byte_count=67108864-2097152+1
            if w=='cap_fds':
                saved=dict(l.owned_fds);l.owned_fds.update({10000+i:object() for i in range(4096)})
            try:
                e=must_deny(lambda:q.read(G.R/p));assert not any(x[0]=='read' for x in v.events)
                return {'denial':type(e).__name__,'bodyReads':0}
            finally:
                if w=='borrow_closed':b.closed=False
                if w=='owner_closed':s.closed=False
                if w=='cap_fds':l.owned_fds.clear();l.owned_fds.update(saved)
        test('post_constructor_'+which+'_denies_before_body',lambda:exercise(case))
    for index in (0,2,5):
        def metadata(s,b,l,c,v,p,ap,i=index):
            q=lease(b,l,c);target=b.rows[i]['path'];fd=next(f for f,path in v.fds.items() if path==target)
            original=v.fstat;fired=[]
            def fault(f):
                val=original(f)
                if f==fd and not fired:
                    fired.append(f);val.st_ctime_ns+=1
                return val
            v.fstat=fault
            e=must_deny(lambda:q.read(G.R/target))
            v.fstat=original
            prior=len(v.events)
            later=must_deny(lambda:q.read(G.R/p))
            assert len(v.events)==prior,'metadata failure allowed subsequent Source body IO'
            assert s.failures,'metadata failure not retained in parent lifetime'
            return {'firstError':type(e).__name__,'laterError':type(later).__name__,'failedFD':fd,'sticky':True}
        test('first_middle_last_metadata_failure_is_sticky_'+str(index),lambda:exercise(metadata))
    for index in (0,2,5):
        def bodybad(s,b,l,c,v,p,ap,i=index):
            q=lease(b,l,c);target=b.rows[i]['path'];v.fault=target
            first=must_deny(lambda:q.read(G.R/target));v.fault=None;prior=len(v.events)
            second=must_deny(lambda:q.read(G.R/p))
            assert s.failures and len(v.events)==prior
            return {'firstError':type(first).__name__,'secondError':type(second).__name__,'sticky':True}
        test('first_middle_last_body_hash_failure_sticky_'+str(index),lambda:exercise(bodybad))
    for value in (False,1,None):
        def authority(s,b,l,c,v,p,ap,val=value):
            calls=[];e=must_deny(lambda:lease(b,l,c,lambda *_:(calls.append(1) or val)))
            assert calls==[1] and not any(x[0]=='read' for x in v.events)
            return {'denial':type(e).__name__,'calls':1,'bodyReads':0}
        test('external_authority_requires_exact_true_'+repr(value),lambda:exercise(authority))
    def callback_dirty(s,b,l,c,v,p,ap):
        calls=[]
        def verify(*_):calls.append(1);l.unknown_close=True;return True
        q=lease(b,l,c,verify)
        assert calls==[1]
        must_deny(lambda:q.read(G.R/p));assert not any(x[0]=='read' for x in v.events)
        return {'afterCallbackReadDenied':True}
    test('external_callback_dirty_ledger_cannot_enable_body',lambda:exercise(callback_dirty))
    def callback_throws(s,b,l,c,v,p,ap):
        original=SystemExit(9)
        def verify(*_):raise original
        got=must_deny(lambda:lease(b,l,c,verify))
        assert got is original and not any(x[0]=='read' for x in v.events)
        return {'originalBaseExceptionRetained':True,'bodyReads':0}
    test('external_callback_SystemExit_preserved_without_body',lambda:exercise(callback_throws))
    # Isolated guard-local release DATA cap: owner/borrow type and private state remain real.
    # Replace only the borrow read method for one encoded shallow body; independent cap guard is reached.
    def cap_sticky(s,b,l,c,v,p,ap):
        q=lease(b,l,c);target=str((G.P/'runtime/coordinator-status.json').relative_to(G.R))
        r=copy.deepcopy(b.by_path[p]);r['path']=target;r['bytes']=32769
        payload=b'X'*32769;r['sha256']=hashlib.sha256(payload).hexdigest();r['nine']['size']='32769'
        # Rebuild a real parent fixture with the additional declared record via its already held fixture data.
        # The scoped local-control seam stubs acquire/check_owner only, exercising exact G.read bytecode.
        saved_acquire=q.acquire;saved_check=q.check_owner;saved_read=b.read
        q.acquire=lambda *_args,**_kw:{'member':r,'bytes':r['bytes'],'sha256':r['sha256']}
        b.read=lambda *_args,**_kw:payload;q.check_owner=lambda:None
        first=must_deny(lambda:q.read(G.R/target))
        q.acquire=saved_acquire;q.check_owner=saved_check;b.read=saved_read
        prior=len(v.events)
        second=must_deny(lambda:q.read(G.R/p))
        assert s.failures and len(v.events)==prior,'release-size failure escaped sticky parent lifetime'
        return {'firstError':type(first).__name__,'laterError':type(second).__name__,'sticky':True,'scopedReadMethodFault':True}
    test('guard_local_release_DATA_limit_failure_stays_sticky',lambda:exercise(cap_sticky))
    for index in (0,2,5):
        def closebad(s,b,l,c,v,p,ap,i=index):
            q=lease(b,l,c);q.release()
            target=sorted(v.fds)[i];orig=v.close;attempts=[]
            def close(fd):
                attempts.append(fd);orig(fd)
                if fd==target:raise OSError('independent_unknown_close_'+str(fd))
            v.close=close
            e=must_deny(s.close)
            assert set(attempts)==set(v.fds) and len(attempts)==6 and len(set(attempts))==6
            assert l.unknown_close and not l.owned_fds
            must_deny(q.check_owner)
            return {'allRootClosesAttemptedOnce':attempts,'unknownCloseSticky':True,'errorType':type(e).__name__}
        test('first_middle_last_Root_close_failure_never_transfers_or_retries_'+str(index),lambda:exercise(closebad))
    return {'scope':'INDEPENDENT_ROOT_G_CODE_HOST_ONLY','conditions':results,
        'discovered':len(results),'executed':len(results),'passed':sum(r['PASS'] for r in results),
        'failed':sum(not r['PASS'] for r in results),'skipped':0,
        'authorFixtureOnlyASTReuse':['encode','row','IO','fixture'],'SourceEligibility':False,'effects':0}
