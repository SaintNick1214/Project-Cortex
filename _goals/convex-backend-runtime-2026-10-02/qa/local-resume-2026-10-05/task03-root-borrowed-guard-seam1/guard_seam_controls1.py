"""Root author Source/mock controls; no physical Source or service acceptance."""
import ast, copy, hashlib, json
from pathlib import Path
from types import SimpleNamespace

def run(A, P, G, original_raw, candidate_raw):
    results=[]
    def test(name, fn):
        try: fn(); results.append({'name':name,'PASS':True})
        except BaseException as e: results.append({'name':name,'PASS':False,'error':repr(e)})
    def deny(fn):
        try: fn()
        except BaseException as e: return e
        raise AssertionError('required denial absent')
    def encode(v): return json.dumps(v,separators=(',',':')).encode()
    def row(path, raw, i):
        return {'path':path,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                'nine':dict(zip(P.FIELDS,map(str,(1,i,33152,501,20,1,len(raw),1,1)))),
                'roles':['control'],'nineBasis':'DECLARED_ORIGINAL'}
    class IO:
        O_RDONLY=0; O_NOFOLLOW=1
        def __init__(self, rows, raws):
            self.rows={r['path']:r for r in rows}; self.raws=raws; self.fds={}; self.next=100
            self.events=[]; self.closes=[]; self.fault=None
        def rel(self, path): return str(Path(path).relative_to(G.R))
        def statrow(self, r): return SimpleNamespace(**{'st_'+k:int(v) for k,v in r['nine'].items()})
        def lstat(self, path):
            try: r=self.rows[self.rel(path)]
            except (ValueError,KeyError): return SimpleNamespace(st_mode=16832)
            return self.statrow(r)
        def open(self,path,flags):
            fd=self.next;self.next+=1;self.fds[fd]=self.rel(path);self.events.append(('open',fd));return fd
        def fstat(self,fd): return self.statrow(self.rows[self.fds[fd]])
        def pread(self,fd,size,offset):
            self.events.append(('read',fd));p=self.fds[fd]
            if self.fault==p: return b'BAD' if offset==0 else b''
            return self.raws[p][offset:offset+size]
        def close(self,fd): self.closes.append(fd);self.events.append(('close',fd))
    def fixture():
        prefix=str(G.P.relative_to(G.R));freeze=str((G.Q/'candidate-freeze-attempt6.json').relative_to(G.R))
        program=prefix+'/fixture-program.py';planp=prefix+'/prospective-source-plan.json';stopp=prefix+'/source-writers-stopped.json';mfp=prefix+'/prospective-source-manifest.json';ap=prefix+'/integrated-source-review.json'
        raws={program:b'value=1\n',freeze:b'{}'}
        plan={'scope':'TASK03_ATTEMPT6_REPAIR2_FINITE_SOURCE_PLAN_ONLY','historicalD101OriginalCustody':'FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED','members':[{'path':k,'bytes':len(v),'sha256':hashlib.sha256(v).hexdigest()} for k,v in raws.items()],'sourceGraphBudgetIncludesManifestApprovalAndReleaseData':True,'futureReleaseDataByteReserve':2097152}
        raws[planp]=encode(plan);raws[stopp]=encode({'sourceWriters':'STOPPED','remainingSourceWrites':[],'stoppedUnixNs':'10'})
        initial=[row(k,v,i+1) for i,(k,v) in enumerate(raws.items())]
        mf={'scope':'TASK03_ATTEMPT6_REPAIR2_NEW_PROSPECTIVE_SOURCE_CLOSURE_ONLY','status':'READY_FOR_FRESH_INDEPENDENT_REVIEW','sourceWriters':'STOPPED','historicalD101OriginalCustody':'FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED','capturedUnixNs':'240000000010','sourcePlanSha256':hashlib.sha256(raws[planp]).hexdigest(),'sourceWritersStoppedSha256':hashlib.sha256(raws[stopp]).hexdigest(),'files':[{'path':r['path'],'PRE':r['nine'],'bytes':r['bytes'],'sha256':r['sha256']} for r in initial]}
        raws[mfp]=encode(mf);mfr=row(mfp,raws[mfp],len(initial)+1)
        approval={'scope':'TASK03_ATTEMPT6_CURRENT_BINDING_REPAIR2_SOURCE_ONLY','verdict':'PASS','independent':True,'sourceManifestOriginalNine':mfr['nine'],'sourceManifestSha256':hashlib.sha256(raws[mfp]).hexdigest(),'candidateSha256':hashlib.sha256(raws[freeze]).hexdigest(),'sourcePlanSha256':mf['sourcePlanSha256'],'sources':{r['path']:r['sha256'] for r in initial}}
        raws[ap]=encode(approval);rows=initial+[mfr,row(ap,raws[ap],len(initial)+2)]
        caller=P.admission_id(rows[0]);edges=[{'caller':caller,'target':P.admission_id(r),'operation':op} for r in rows for op in ('read','hash','control','compile','parse')]
        ledger=P.Ledger();io=IO(rows,raws);view=A.SourceView({'futureDATA':[],'bodyUseEdges':edges,'programApprovals':{}},tuple(rows),(),'a'*64,'b'*64,(),object())
        session=A.SourceSession(P,G.R,view,ledger,10,'c'*64,lambda v,h,l:A.RuntimePermit(object(),v.view_sha256,h,v.phase_sha256),io=io,clock=lambda:999000000000000)
        session.open_all(caller);borrow=session.borrow(caller);oldos=G.os;G.os=io
        def cleanup():
            G.os=oldos
            if not session.closed:
                try: session.final(caller)
                except BaseException: pass
                try: session.close()
                except A.Failures:
                    assert session.failures
            assert sorted(io.closes)==sorted(io.fds) and len(io.closes)==len(set(io.closes))
            assert not ledger.owned_fds
        return session,borrow,ledger,caller,io,cleanup,program,approval
    def lease(b,l,c,verify=lambda *_:True): return G.RootBorrowedGuardLease(b,A,l,c,verify)
    def original_preserved():
        old=ast.parse(original_raw);new=ast.parse(candidate_raw);newmap={n.name:n for n in new.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
        for n in old.body:
            if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name not in ('source_read','qualify_sources'):
                assert ast.dump(n,include_attributes=False)==ast.dump(newmap[n.name],include_attributes=False),n.name
        oldq=next(n for n in old.body if isinstance(n,ast.FunctionDef) and n.name=='qualify_sources');newq=newmap['qualify_sources']
        olda=[ast.dump(n,include_attributes=False) for n in ast.walk(oldq) if isinstance(n,ast.Assert)];newa=[ast.dump(n,include_attributes=False) for n in ast.walk(newq) if isinstance(n,ast.Assert)]
        for a in set(olda):assert newa.count(a)>=olda.count(a),'original assertion removed'
    test('original_functions_classes_and_every_qualify_assertion_preserved',original_preserved)
    def positive():
        s,b,l,c,io,clean,program,approval=fixture()
        try:
            q=lease(b,l,c);out=G.qualify_sources(q)
            assert out[0]==approval and out[1]==hashlib.sha256(io.raws[str((G.P/'integrated-source-review.json').relative_to(G.R))]).hexdigest()
            assert len(io.fds)==6 and [e[0] for e in io.events].index('read')==6
            assert all('fd' not in r for r in b.rows) and all('fd' not in q.acquire(G.R/r['path']) for r in b.rows)
            before=l.byte_count;q.release();assert not io.closes and len(s.owned)==6 and l.byte_count==before
            deny(lambda:q.read(G.R/program));assert not io.closes
        finally:clean()
    test('whole_original_guard_qualifier_through_held_borrowed_Source_no_fd_export_no_close_transfer',positive)
    for variant in ('no_verifier','false','integer_true','foreign_ledger','foreign_caller','unknown_close','owner_failure','closed_owner'):
        def case(v=variant):
            s,b,l,c,io,clean,program,approval=fixture();calls=[]
            try:
                verifier=lambda *_:(calls.append(1) or (False if v=='false' else 1 if v=='integer_true' else True))
                if v=='no_verifier':verifier=None
                if v=='unknown_close':l.unknown_close=True
                if v=='owner_failure':s._failure('modeled_existing_failure',OSError('unknown'))
                if v=='closed_owner':b.closed=True
                deny(lambda:lease(b,P.Ledger() if v=='foreign_ledger' else l,'wrong' if v=='foreign_caller' else c,verifier))
                assert not any(e[0]=='read' for e in io.events)
                if v in ('foreign_ledger','foreign_caller','unknown_close','owner_failure','closed_owner'):assert not calls
            finally:clean()
        test('constructor_'+variant+'_denied_before_body_and_unsafe_callback',case)
    for variant in ('map_replaced','tuple_changed','ownership_missing','row_nine_changed','wrong_pin','undeclared_path','released_borrow'):
        def case(v=variant):
            s,b,l,c,io,clean,program,approval=fixture()
            try:
                q=lease(b,l,c)
                if v=='map_replaced':b.by_path=dict(b.by_path)
                if v=='tuple_changed':b.rows=tuple(copy.deepcopy(x) for x in b.rows)
                if v=='ownership_missing':
                    fd=next(iter(l.owned_fds));owner=l.owned_fds.pop(fd)
                    try:deny(lambda:q.read(G.R/program));assert not any(e[0]=='read' for e in io.events)
                    finally:l.owned_fds[fd]=owner
                    return
                if v=='row_nine_changed':b.by_path[program]['nine']['ino']='99'
                if v=='released_borrow':b.release()
                pin=copy.deepcopy(b.by_path[program]['nine'])
                if v=='wrong_pin':pin['ino']='99'
                deny(lambda:q.read(G.R/'undeclared.py' if v=='undeclared_path' else G.R/program,pin))
                assert not any(e[0]=='read' for e in io.events)
            finally:clean()
        test('borrowed_'+variant+'_denied_before_member_body',case)
    def failed_hash():
        s,b,l,c,io,clean,program,approval=fixture()
        try:
            q=lease(b,l,c);io.fault=program;deny(lambda:q.read(G.R/program));assert any(stage=='guard_borrowed_read' for stage,e in s.failures)
            io.fault=None;count=len(io.events);deny(lambda:q.read(G.R/program));assert len(io.events)==count
        finally:clean()
    test('failed_body_hash_is_sticky_before_further_read_and_all_owner_close',failed_hash)
    return results
