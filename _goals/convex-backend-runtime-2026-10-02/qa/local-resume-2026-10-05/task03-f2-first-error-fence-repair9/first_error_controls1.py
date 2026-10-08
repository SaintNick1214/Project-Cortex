"""R9 allocation-free first-error retention controls; SOURCE/mock only."""
import ast,hashlib,stat,types
from pathlib import Path
from contextlib import ExitStack
from unittest.mock import patch

def run(M, original_registration_raw):
    assert hashlib.sha256(original_registration_raw).hexdigest()=='3cc6a504628e1d26410205ced5ffc89b1c798bd4c568f5c8edc16fb7461f69e7'
    t=ast.parse(original_registration_raw)
    rr=next(x for x in t.body if isinstance(x,ast.FunctionDef) and x.name=='run')
    fsnode=next(x for x in rr.body if isinstance(x,ast.ClassDef) and x.name=='FS')
    env=dict(M=M,Path=Path,hashlib=hashlib,stat=stat,types=types)
    exec(compile(ast.Module(body=[fsnode],type_ignores=[]),'held_original_R7_FS','exec'),env)
    FS=env['FS'];results=[]
    receipt={'counts':dict(M.COUNTS),'assertions':list(M.ASSERTIONS),
        'originalProgramsUnchanged':True,'allProgramsIndependentlyApprovedBefore1914':True}
    def one(position,kind,approved):
        fs=FS();ledger=M.Ledger();edges=[{'caller':'c','target':M.admission_id(r),'operation':'read'} for r in fs.rows]
        broker=M.HeldBroker(fs.root,fs.rows,ledger,edges,'c',1)
        machine=M.PhaseMachine(ledger);callbacks=[];attempts=[]
        primary=RuntimeError('original_physical_close_primary')
        secondary=MemoryError('secondary_bookkeeping_allocation_failure')
        target=100+position;early=100
        def physical(fd):
            attempts.append(fd)
            if fd==target:raise primary
            return fs.close(fd)
        with ExitStack() as stack:
            for ctx in (patch.object(M.os,'lstat',side_effect=fs.lstat),
                patch.object(M.os,'open',side_effect=fs.open),patch.object(M.os,'fstat',side_effect=fs.fstat),
                patch.object(M.os,'pread',return_value=b''),patch.object(M.os,'close',side_effect=physical),
                patch.object(Path,'resolve',lambda p:p.absolute())):stack.enter_context(ctx)
            broker.open_all()
            if approved:machine.advance('SOURCE_APPROVED',receipt,lambda *_:True)
            before=machine.phase;release=ledger.release_fd
            if kind in ('release','earlier_release'):
                badfd=early if kind=='earlier_release' else target
                def badrelease(fd,owner,successful):
                    if fd==badfd:raise secondary
                    return release(fd,owner,successful)
                ledger.release_fd=badrelease
            if kind=='receipt':
                class Recorder(list):
                    def append(self,row):
                        if row['path']=='p'+str(position):raise secondary
                        return super().append(row)
                broker.close_attempts=Recorder()
            try:broker.close()
            except M.Denied as denied:
                expected=secondary if kind=='earlier_release' and position>0 else primary
                assert denied.__cause__ is expected and type(expected).__name__ in str(denied)
            else:raise AssertionError('original_close_failure_disappeared')
            assert sorted(attempts)==fs.opened and len(attempts)==len(set(attempts))
            assert sorted(fs.closed)==[fd for fd in fs.opened if fd!=target]
            assert list(sorted(fs.live))==[target] and ledger.unknown_close
            for row in broker.close_attempts:
                if row['path']!='p'+str(position):assert row['error'] is None
            denials=[];nextphase='ACTUAL1914' if approved else 'SOURCE_APPROVED'
            for name,action in (('preflight',ledger.preflight),('binding',ledger.approval_binding),
                ('open',ledger.can_open),('phase',lambda:machine.advance(nextphase,receipt,lambda *x:callbacks.append(x) or True))):
                try:action()
                except M.Denied as err:assert str(err)=='sticky_unknown_SOURCE_close';denials.append(name)
                else:raise AssertionError('broken_cleanup_callback_enabled_'+name)
            assert len(denials)==4 and not callbacks and machine.phase==before
            try:broker.close()
            except M.Denied as err:assert str(err)=='each_FD_once_close_already_closed'
            else:raise AssertionError('close_retried')
            assert len(attempts)==3
        return {'position':position,'kind':kind,'approved':approved,'onceAttempts':attempts,
            'knownSuccessfulCloses':fs.closed,'uncertainPhysicalHandleRetained':[target],
            'firstOriginalErrorCauseRetained':True,'stickyDenials':denials,'laterCallbacks':0,'retry':0}
    for kind in ('physical','release','receipt','earlier_release'):
        for position in (0,1,2):
            for approved in (False,True):
                name=kind+'_'+str(position)+'_'+str(approved)
                try:results.append({'name':name,'status':'PASS','detail':one(position,kind,approved)})
                except BaseException as error:results.append({'name':name,'status':'FAIL','error':repr(error)})
    return {'scope':'R9_SOURCE_MOCK_FIRST_ERROR_RETENTION','results':results,
        'passed':sum(x['status']=='PASS' for x in results),'failed':sum(x['status']=='FAIL' for x in results),
        'SourceEligibility':False,'effects':0}
