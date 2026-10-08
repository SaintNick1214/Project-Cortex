"""Independent R7 registration and cleanup outcomes; virtual descriptors only."""
import ast,copy,hashlib,stat,types
from pathlib import Path
from contextlib import ExitStack
from unittest.mock import patch

def run(M,old_raw,new_raw,author_raw):
    cases=[]
    class FS:
        def __init__(self):
            self.root=Path('/INDEPENDENT-R7-VIRTUAL-ONLY');self.opened=[];self.closed=[];self.live={}
            self.rows=[]
            for i in range(3):
                n={'dev':1,'ino':i+1,'mode':33188,'uid':1,'gid':1,'nlink':1,'size':0,'mtime_ns':1,'ctime_ns':1}
                self.rows.append({'path':'p'+str(i),'bytes':0,'sha256':hashlib.sha256(b'').hexdigest(),'roles':['control'],'nine':{k:str(n[k])for k in M.FIELDS}})
        def ls(self,p):
            for r in self.rows:
                if str(p)==str(self.root/r['path']):return types.SimpleNamespace(**{'st_'+k:int(v)for k,v in r['nine'].items()})
            return types.SimpleNamespace(st_mode=stat.S_IFDIR|0o700)
        def op(self,p,*_):
            fd=100+len(self.opened);self.opened.append(fd);self.live[fd]=str(p);return fd
        def cl(self,fd):
            self.closed.append(fd);assert fd in self.live,'duplicate_close';del self.live[fd]
        def fs(self,fd):return self.ls(self.live[fd])
    def isolated(fn):
        fs=FS();L=M.Ledger();edges=[{'caller':'independent','target':M.admission_id(r),'operation':'read'}for r in fs.rows]
        B=M.HeldBroker(fs.root,fs.rows,L,edges,'independent',1)
        with ExitStack()as stack:
            for x in (patch.object(M.os,'lstat',side_effect=fs.ls),patch.object(M.os,'open',side_effect=fs.op),
                patch.object(M.os,'fstat',side_effect=fs.fs),patch.object(M.os,'pread',return_value=b''),
                patch.object(M.os,'close',side_effect=fs.cl),patch.object(Path,'resolve',lambda p:p.absolute())):stack.enter_context(x)
            return fn(fs,L,B)
    receipt={'counts':dict(M.COUNTS),'assertions':list(M.ASSERTIONS),'originalProgramsUnchanged':True,'allProgramsIndependentlyApprovedBefore1914':True}
    def stage_probe(L,before='SOURCE'):
        machine=M.PhaseMachine(L);callbacks=[];error=None
        if before!='SOURCE':
            machine.phase='SOURCE_APPROVED';machine.approved_source_binding=L.approval_binding()
        try:
            for stage in machine.ORDER[machine.ORDER.index(machine.phase)+1:]:
                machine.advance(stage,copy.deepcopy(receipt),lambda *_:callbacks.append(stage)or True)
        except BaseException as e:error={'type':type(e).__name__,'message':str(e)}
        return {'phase':machine.phase,'error':error,'callbacks':callbacks}
    def record(name,fn):
        try:
            ok,evidence=fn();cases.append({'name':name,'PASS':bool(ok),'evidence':evidence})
        except BaseException as e:cases.append({'name':name,'PASS':False,'reviewerSetupException':{'type':type(e).__name__,'message':str(e)}})
    def conservation():
        a=ast.parse(old_raw);b=ast.parse(new_raw)
        old={n.name:n for n in a.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
        new={n.name:n for n in b.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
        exact=[]
        for k,n in old.items():
            if k!='HeldBroker':
                assert ast.dump(n,include_attributes=False)==ast.dump(new[k],include_attributes=False),k
                exact.append(k)
        am={n.name:n for n in old['HeldBroker'].body if isinstance(n,ast.FunctionDef)}
        bm={n.name:n for n in new['HeldBroker'].body if isinstance(n,ast.FunctionDef)}
        assert set(am)==set(bm)
        for k in am:
            if k not in ('__init__','open_all','close'):assert ast.dump(am[k],include_attributes=False)==ast.dump(bm[k],include_attributes=False),k
        oldassign=[ast.dump(n,include_attributes=False)for n in a.body if isinstance(n,(ast.Assign,ast.Import,ast.ImportFrom))]
        newassign=[ast.dump(n,include_attributes=False)for n in b.body if isinstance(n,(ast.Assign,ast.Import,ast.ImportFrom))]
        assert oldassign==newassign
        return True,{'unchangedTopDefinitions':exact,'onlyHeldMethodsChanged':['__init__','open_all','close'],'originalAssignmentsImportsExact':True}
    record('R6_to_R7_exact_unrelated_definitions_caps_counts_assertions_conservation',conservation)
    for index in (0,1,2):
        def registration(fs,L,B,i=index):
            class Fail(dict):
                def __setitem__(self,key,value):
                    if value[0]==100+i:raise MemoryError('independent_same_original_registration_gap')
                    return super().__setitem__(key,value)
            B.held=Fail();primary=None;cleanup=None
            try:B.open_all()
            except BaseException as e:primary={'type':type(e).__name__,'message':str(e)}
            try:B.close()
            except BaseException as e:cleanup={'type':type(e).__name__,'message':str(e)}
            probe=stage_probe(L)
            details={'position':i,'primary':primary,'cleanup':cleanup,'opened':fs.opened,'closeAttempts':fs.closed,
                'remaining':sorted(fs.live),'ledgerOwned':sorted(L.owned_fds),'unknown':L.unknown_close,'probe':probe}
            good=primary and primary['type']=='MemoryError'and fs.closed==fs.opened and not fs.live and len(fs.closed)==len(set(fs.closed))
            return details,good,probe['error']is not None and probe['phase']=='SOURCE'and not probe['callbacks']
        def cleanup(i=index):
            d,g,ready=isolated(lambda f,l,b:registration(f,l,b,i));return bool(g),d
        def readiness(i=index):
            d,g,ready=isolated(lambda f,l,b:registration(f,l,b,i));return bool(ready),d
        record('original_gap_'+str(index)+'_all_once_cleanup',cleanup)
        record('original_gap_'+str(index)+'_no_readiness_or_callbacks',readiness)
    # Failures in cleanup bookkeeping must not abandon later owned handles or enable a failed lifetime.
    for seam in ('close_receipt_append','ledger_release_before','ledger_release_after'):
        for index in (0,1,2):
            for phase in ('SOURCE','SOURCE_APPROVED'):
                def fault(fs,L,B,s=seam,i=index,p=phase):
                    B.open_all();machine=M.PhaseMachine(L)
                    if p=='SOURCE_APPROVED':machine.advance(p,copy.deepcopy(receipt),lambda *_:True)
                    target=100+i
                    if s=='close_receipt_append':
                        class FailingList(list):
                            def append(self,value):
                                if len(fs.closed)-1==i:raise MemoryError('independent_close_receipt_append')
                                return super().append(value)
                        B.close_attempts=FailingList()
                    else:
                        old=L.release_fd
                        def release(fd,owner,successful):
                            if fd==target:
                                if s=='ledger_release_after':old(fd,owner,successful)
                                raise MemoryError('independent_close_ledger_release')
                            return old(fd,owner,successful)
                        L.release_fd=release
                    error=None
                    try:B.close()
                    except BaseException as e:error={'type':type(e).__name__,'message':str(e)}
                    callbacks=[];stage_error=None
                    try:
                        for stage in machine.ORDER[machine.ORDER.index(machine.phase)+1:]:
                            machine.advance(stage,copy.deepcopy(receipt),lambda *_:callbacks.append(stage)or True)
                    except BaseException as e:stage_error={'type':type(e).__name__,'message':str(e)}
                    allclose=fs.closed==fs.opened and len(fs.closed)==len(set(fs.closed))
                    blocked=stage_error is not None and not callbacks and machine.phase==p
                    detail={'seam':s,'position':i,'phaseBefore':p,'cleanupError':error,'allOwnedCloseAttempts':allclose,
                        'opened':fs.opened,'closeAttempts':fs.closed,'remainingVirtualHandles':sorted(fs.live),
                        'remainingLedgerOwners':sorted(L.owned_fds),'ledgerUnknownClose':L.unknown_close,
                        'phaseAfter':machine.phase,'stageError':stage_error,'externalCallbacks':callbacks,
                        'candidateBytesUnchanged':True,'virtualOnly':True}
                    return bool(allclose and blocked and L.unknown_close),detail
                record('cleanup_bookkeeping_'+seam+'_'+str(index)+'_'+phase,lambda:isolated(fault))
    return {'scope':'INDEPENDENT_R7_CODE_HOST_OUTCOMES_ONLY','conditions':cases,'discovered':len(cases),'executed':len(cases),
        'passed':sum(x['PASS']for x in cases),'failed':sum(not x['PASS']for x in cases),'skipped':0,
        'SourceEligibility':False,'effects':0,'virtualHandlesOnly':True}
