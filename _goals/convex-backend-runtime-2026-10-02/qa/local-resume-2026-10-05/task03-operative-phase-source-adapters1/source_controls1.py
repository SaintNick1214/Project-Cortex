"""Author SOURCE/mock oracles. No Docker, private reads, imports or effects."""
import copy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

def run(adapter,api):
    results=[]
    def test(name,fn):
        try:fn();results.append({'name':name,'PASS':True})
        except BaseException as error:results.append({'name':name,'PASS':False,'error':repr(error)})
    def deny(fn,kind=BaseException):
        try:fn()
        except kind as error:return error
        raise AssertionError('expected denial did not occur')
    def row(path,raw=b'x',index=1,roles=('control',)):
        pin=dict(zip(api.FIELDS,map(str,(1,index,33152,501,20,1,len(raw),1,1))))
        return {'path':path,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                'nine':pin,'roles':list(roles),'nineBasis':'DECLARED_ORIGINAL'}
    class IO:
        O_RDONLY=0;O_NOFOLLOW=1
        def __init__(self,rows,raws,fault=None,position=None):
            self.rows={r['path']:r for r in rows};self.raws=raws;self.fault=fault
            self.position=position;self.opened=[];self.closed=[];self.reads=[];self.fds={}
            self.events=[];self.next_fd=100
        def _rel(self,path):return str(path).removeprefix('/bounded-fixture/')
        def _stat(self,r):return SimpleNamespace(**{'st_'+k:int(v) for k,v in r['nine'].items()})
        def lstat(self,path):
            rel=self._rel(path)
            if rel not in self.rows:return SimpleNamespace(st_mode=16832)
            if self.fault=='maturity' and rel==self.position:
                r=copy.deepcopy(self.rows[rel]);r['nine']['mtime_ns']='999999999999999'
                return self._stat(r)
            if self.fault=='lstat' and rel==self.position:raise OSError('lstat-primary')
            return self._stat(self.rows[rel])
        def open(self,path,_flags):
            rel=self._rel(path)
            if self.fault=='open' and rel==self.position:raise OSError('open-primary')
            fd=self.next_fd;self.next_fd+=1;self.fds[fd]=rel;self.opened.append(fd)
            self.events.append(('open',fd));return fd
        def fstat(self,fd):
            if self.fault=='fstat' and self.fds[fd]==self.position:raise OSError('fstat-primary')
            return self._stat(self.rows[self.fds[fd]])
        def pread(self,fd,size,offset):
            rel=self.fds[fd];self.events.append(('read',fd));self.reads.append(rel)
            if self.fault=='read' and rel==self.position:raise OSError('read-primary')
            if self.fault=='hash' and rel==self.position:return b'Z' if offset==0 else b''
            return self.raws[rel][offset:offset+size]
        def close(self,fd):
            self.closed.append(fd);self.events.append(('close',fd))
            if self.fault=='allclose' or (self.fault=='close' and self.fds[fd]==self.position):
                raise OSError('close-'+self.fds[fd])
    def fixture(fault=None,position=None,ledger=None,raws=None,roles=None,caller_override=None):
        raws=raws or {'a':b'1','b':b'2','c':b'3'}
        rows=[row(k,v,i+1,(roles or {}).get(k,('control',))) for i,(k,v) in enumerate(raws.items())]
        caller=caller_override or api.admission_id(rows[0]);edges=[]
        for r in rows:
            for operation in ('read','hash','parse','control','compile'):
                edges.append({'caller':caller,'target':api.admission_id(r),'operation':operation})
        programs={api.admission_id(r):r['sha256'] for r in rows if 'program' in r['roles']}
        recipe={'futureDATA':[],'bodyUseEdges':edges,'programApprovals':programs}
        view=adapter.SourceView(recipe,tuple(rows),(), 'a'*64,'b'*64,(),object())
        ledger=ledger if ledger is not None else api.Ledger();io=IO(rows,raws,fault,position)
        session=adapter.SourceSession(api,'/bounded-fixture',view,ledger,10,'c'*64,
            lambda v,h,l:adapter.RuntimePermit(object(),v.view_sha256,h,v.phase_sha256),io=io,
            clock=lambda:999000000000000)
        io.next_fd=max([99]+list(ledger.owned_fds))+1
        return session,io,ledger,caller
    def closed_all(session,io,ledger):
        assert sorted(io.opened)==sorted(io.closed), (io.opened,io.closed)
        assert len(io.closed)==len(set(io.closed))
        assert all(r['attempt']==1 for r in session.close_attempts)
        assert not ledger.owned_fds
    def success():
        s,io,l,c=fixture();result=s.run(c,lambda x:adapter.collector_manifest(x,c))
        assert len(result['files'])==3 and result['sourceEligibility'] is False
        assert s.final_checked and l.byte_count==3 and len(l.read_debts)==3
        events=[e[0] for e in io.events];assert events.index('read')==3
        closed_all(s,io,l)
    test('positive_exact_Source_cohort_all_FD_before_body_EOF_hash_nine_final_close',success)
    for fault in ('open','lstat','fstat','maturity','read','hash','close','allclose'):
        for position in ('a','b','c'):
            def run_fault(fault=fault,position=position):
                s,io,l,c=fixture(fault,position)
                error=deny(lambda:s.run(c,lambda x:x.read(c,'a')))
                assert isinstance(error,adapter.Failures)
                closed_all(s,io,l)
                assert l.byte_count==3 # setup/body/close failures never refund
                if fault in ('close','allclose'):assert l.unknown_close
                assert deny(lambda:s.close(),adapter.Denied)
            test(fault+'_'+position+'_all_owned_once_sticky_debt',run_fault)
    for position in ('a','b','c'):
        def registration(position=position):
            s,io,l,c=fixture()
            class BadDict(dict):
                def __setitem__(self,key,value):
                    if key==position:raise MemoryError('registration-primary')
                    return super().__setitem__(key,value)
            s.owned=BadDict();error=deny(lambda:s.run(c,lambda x:None))
            assert 'MemoryError' in str(error);closed_all(s,io,l)
        test('immediate_owner_registration_'+position+'_fallback_once',registration)
        for after in (False,True):
            def shared_registration(position=position,after=after):
                class BadLedger(api.Ledger):
                    def own_fd(self,fd,owner):
                        path=owner.owned[next(reversed(owner.owned))][1]['path']
                        if path==position:
                            if after:super().own_fd(fd,owner)
                            raise MemoryError('ledger-registration-primary')
                        super().own_fd(fd,owner)
                s,io,l,c=fixture(ledger=BadLedger())
                error=deny(lambda:s.run(c,lambda x:None));assert 'MemoryError' in str(error)
                closed_all(s,io,l)
            test('shared_registration_'+position+('_after' if after else '_before')+'_once',shared_registration)
    def combined():
        s,io,l,c=fixture('allclose')
        def primary(_s):raise SystemExit(0)
        def report(_value):raise ValueError('report-primary')
        io.fault='allclose';original=io.pread
        def final_read(fd,size,offset):
            if io.fds[fd]=='b':raise OSError('final-b')
            return original(fd,size,offset)
        io.pread=final_read
        error=deny(lambda:s.run(c,primary,report),adapter.Failures)
        stages=[stage for stage,_ in error.failures]
        assert 'primary' in stages and 'publication' in stages
        assert any(stage.startswith('final') for stage in stages)
        assert sum(stage.startswith('owned_close:') for stage in stages)==3
        assert any(isinstance(e,SystemExit) and e.code==0 for _,e in error.failures)
        assert 'c' in io.reads # failed middle final did not abandon later check
        closed_all(s,io,l)
    test('combined_SystemExit0_final_report_allclose_original_errors_retained',combined)
    for code in (0,7):
        def systemexit(code=code):
            s,io,l,c=fixture()
            def action(_s):raise SystemExit(code)
            error=deny(lambda:s.run(c,action),adapter.Failures)
            assert any(isinstance(e,SystemExit) and e.code==code for _,e in error.failures)
            closed_all(s,io,l)
        test('primary_SystemExit_'+str(code)+'_retained_allclose',systemexit)
    for value in (b'{"x":1,"x":2}',b'{"x":1e309}',b'{"x":NaN}'):
        def parsed(value=value):
            s,io,l,c=fixture(raws={'a':value,'b':b'2','c':b'3'})
            error=deny(lambda:s.run(c,lambda x:adapter.strict_json(x.read(c,'a','parse'))))
            assert 'primary' in [stage for stage,_ in error.failures];closed_all(s,io,l)
        test('held_parse_denial_'+value.decode(),parsed)
    def reportonly():
        s,io,l,c=fixture()
        def publish(_r):raise OSError('publication-alone')
        error=deny(lambda:s.run(c,lambda x:1,publish));assert 'publication' in str(error)
        closed_all(s,io,l)
    test('publication_alone_attempts_every_close',reportonly)
    def hidden():
        s,io,l,c=fixture();s.view.recipe['bodyUseEdges']=[]
        deny(lambda:s.run(c,lambda x:None));assert not io.opened and l.byte_count==3
    test('hidden_body_edge_denial_before_open',hidden)
    def borrowed():
        s,io,l,c=fixture();s.open_all(c);lease=s.borrow(c)
        assert lease.ledger is l and lease.ownerToken is s and lease.source_bytes==3
        assert lease.data_bytes==2097152 and lease.read(lease.lookup('b'))==b'2'
        bad=lease.lookup('b');bad['nine']['ino']='999';deny(lambda:lease.read(bad))
        lease.release();assert len(s.owned)==3 and not io.closed
        deny(lambda:lease.read(lease.rows[0]));s.final(c);s.close();closed_all(s,io,l)
    test('borrow_exact_tuple_no_owner_transfer_no_new_pool',borrowed)
    def compiles():
        s,io,l,c=fixture(raws={'a':b'value=4\n','b':b'2','c':b'3'},roles={'a':('program',)})
        s.open_all(c);code=adapter.root_compile(s,c,'a');assert code.co_filename=='a'
        deny(lambda:adapter.root_compile(s,c,'b'));s.final(c);s.close();closed_all(s,io,l)
    test('Root_compile_only_exact_approved_held_program',compiles)
    def guard_variant(variant):
        s,io,l,c=fixture();s.open_all(c);mf=adapter.collector_manifest(s,c)
        plan={'sourceViewSha256':s.view.view_sha256,'sourceMemberPaths':list(s.rows)}
        approval={'PASS':True}
        if variant=='stale':mf['sourceViewSha256']='d'*64
        if variant=='missing':mf['files'].pop()
        if variant=='extra':mf['files'].append(copy.deepcopy(mf['files'][0]))
        if variant=='wrongnine':mf['files'][0]['PRE9']=dict(mf['files'][0]['PRE9'],ino='999')
        if variant=='planextra':plan['sourceMemberPaths'].append('custody-undeclared')
        raw={'plan':adapter.encode(plan),'MF':adapter.encode(mf),'approval':adapter.encode(approval)}
        controls,c_io,c_l,c_c=fixture(ledger=l,raws=raw,caller_override=c);controls.open_all(c_c);borrow=controls.borrow(c_c)
        fn=lambda:adapter.guard_source_contract(s,c,borrow,'plan','MF','approval',
                    (lambda *_:variant!='selfPASS'))
        if variant=='positive':assert fn()['protectedEffects'] is False
        else:deny(fn)
        controls.final(c_c);controls.close();s.final(c);s.close()
        closed_all(controls,c_io,l);closed_all(s,io,l)
        assert l.byte_count==3+sum(map(len,raw.values()))
    for variant in ('positive','stale','missing','extra','wrongnine','planextra','selfPASS'):
        test('G_'+variant+'_shared_header_body_debt_exact_sources',lambda v=variant:guard_variant(v))
    def aliases():
        s,io,l,c=fixture();other=copy.deepcopy(s.view);other.rows[1]['path']='a'
        deny(lambda:adapter.SourceSession(api,'/bounded-fixture',other,l,10,'c'*64,
            lambda v,h,l:adapter.RuntimePermit(object(),v.view_sha256,h,v.phase_sha256)),adapter.Denied)
        assert not io.opened
    test('duplicate_conflicting_original_tuple_denies_before_open',aliases)
    def changed_admission():
        l=api.Ledger();r=row('same',b'abc');l.admit(r,debt=True)
        changed=copy.deepcopy(r);changed['nine']['ctime_ns']='2';l.admit(changed,debt=True)
        assert l.byte_count==6 and len(l.rows)==2 and len(l.paths)==1
        deny(lambda:l.preflight());deny(lambda:l.refund());deny(lambda:l.clone_for_new_phase())
    test('changed_nine_new_charged_admission_no_reset_refund',changed_admission)
    def caps():
        l=api.Ledger();r=row('big',b'');r['bytes']=16777216;r['nine']['size']=str(r['bytes'])
        for i in range(4):q=copy.deepcopy(r);q['path']=str(i);q['nine']['ino']=str(i+1);l.admit(q)
        assert l.byte_count==67108864;deny(lambda:l.preflight())
        q=copy.deepcopy(r);q['path']='extra';q['bytes']=1;q['nine']['size']='1'
        deny(lambda:l.admit(q));assert l.byte_count==67108865
    test('same64MiB_including_original_reserves_overflow_sticky',caps)
    def borrowed_foreign():
        s,io,l,c=fixture();s.open_all(c);other,otherio,otherl,otherc=fixture();other.open_all(otherc)
        deny(lambda:adapter.guard_source_contract(s,c,other.borrow(otherc),'a','b','c',lambda *_:True))
        other.final(otherc);other.close();s.final(c);s.close();closed_all(s,io,l);closed_all(other,otherio,otherl)
    test('G_foreign_ledger_header_lease_denied',borrowed_foreign)
    def partition_fixture():
        rows=[row('members/'+str(i),b'x',i+1,('candidateCustody',)) for i in range(1907)]
        programs=set(range(32))|set(range(90,95))|set(range(100,113))
        for i in programs:rows[i]['roles']=['program']
        for i in set(range(129))-programs:rows[i]['roles']=['control']
        keys=[api.admission_id(r) for r in rows];caller=keys[0]
        adapters={name:{'state':'INDEPENDENTLY_REVIEWED','program':keys[i],
            'sha256':rows[i]['sha256'],'direct_IO':'DENY_OUTSIDE_HELD_BROKER',
            'assertionsSha256':api.digest(list(api.ASSERTIONS))} for i,name in enumerate(api.ADAPTERS)}
        edges=[{'caller':caller,'target':key,'operation':'read'} for key in keys[:129]]
        recipe={'schema':'task03-prospective-phase-partition-v1','caps':api.CAPS,'counts':api.COUNTS,
            'assertions':list(api.ASSERTIONS),'members':rows,'cohorts':{'currentPrograms':keys[:32],
            'requiredCurrent':keys[:129],'Q6Seeds':keys[90:95],'originalComparands':keys[100:113],
            'frozen':keys,'rootCompiler':keys[:114],'rootCLI':keys[114:119]},'futureDATA':[],
            'unknownRequiredInputs':[],'unresolvedEdges':[],'quarantinedDeclarations':[],
            'conservation':{'sourceReadEvidence':[{'admission':caller,'debtRequired':True,
            'currentReliedOnBodyRead':True}]},'actualReadDebts':[caller],'writers':'STOPPED',
            'stopSha256':'1'*64,'bodyUseEdges':edges,'programApprovals':{keys[i]:rows[i]['sha256'] for i in programs},
            'adapters':adapters,'proposedCustodyOnly':keys[129:]}
        proof={'recipeSha256':api.digest(recipe),'exactCustodyOnly':keys[129:]}
        def witness(r,p):return api.ReviewWitness(api.digest(r['bodyUseEdges']),api.digest(r['adapters']),
            api.digest(r['conservation']),api.digest(r['programApprovals']),'2'*64,object())
        return recipe,proof,witness
    def view_variant(variant):
        recipe,proof,witness=partition_fixture()
        if variant=='unknown':recipe['unknownRequiredInputs']=['unknown-late-Root'];proof['recipeSha256']=api.digest(recipe)
        if variant=='debtremoved':recipe['actualReadDebts']=[];proof['recipeSha256']=api.digest(recipe)
        if variant=='mixed':recipe['members'][129]['roles']=['control'];proof['recipeSha256']=api.digest(recipe)
        if variant=='adapterpending':recipe['adapters']['B3']['state']='PENDING';proof['recipeSha256']=api.digest(recipe)
        if variant=='assertionremoved':recipe['assertions'].pop();proof['recipeSha256']=api.digest(recipe)
        if variant=='countchanged':recipe['counts']=dict(recipe['counts'],actual3828FDs=3827);proof['recipeSha256']=api.digest(recipe)
        if variant=='staleproof':proof['recipeSha256']='3'*64
        boot={}
        for i,(name,raw) in enumerate([('recipe',adapter.encode(recipe)),('proof',adapter.encode(proof)),('phase',b'EXPLICIT_MOCK_PHASE_BODY')]):
            boot[name]=adapter.Bootstrap(row('bootstrap/'+name,raw,3000+i),raw)
        l=api.Ledger()
        for b in boot.values():l.admit(b.row,debt=True)
        if variant=='orphanreaddebt':l.admit(row('unlisted-current-read',b'actual-debt'),debt=True)
        if variant=='unknownclose':l.unknown_close=True
        fn=lambda:adapter.source_view(api,l,boot,None if variant=='ownJSONPASS' else witness,
            (lambda *_:variant!='unheld'))
        if variant=='positive':
            v=fn();assert len(v.rows)==132 and len(v.custody_rows)==1778
            assert not {r['path'] for r in v.rows}&{r['path'] for r in v.custody_rows}
            assert all(k in l.read_debts for k in v.bootstrap_admissions)
        else:deny(fn)
    for variant in ('positive','unknown','debtremoved','mixed','adapterpending','assertionremoved',
                    'countchanged','staleproof','ownJSONPASS','unheld','orphanreaddebt','unknownclose'):
        test('closed_nonuse_'+variant+'_no_custody_body_reads',lambda v=variant:view_variant(v))
    def unknown_runtime():
        l=api.Ledger();l.unknown_close=True;deny(lambda:fixture(ledger=l),adapter.Denied)
    test('unknown_Source_close_denied_before_runtime_verifier',unknown_runtime)
    def fd_cap():
        s,io,l,c=fixture();l.owned_fds={i:object() for i in range(4096)}
        deny(lambda:s.run(c,lambda x:None));assert io.opened==[] and len(l.owned_fds)==4096
    test('shared_simultaneous4096_FD_cap_denies_before_new_open_no_foreign_close',fd_cap)
    for fn in (lambda:adapter.protected_action(),lambda:adapter.strict_json(b'{"x":Infinity}')):
        test('protected_or_nonfinite_denial_'+str(len(results)),lambda fn=fn:deny(fn))
    return {'scope':'AUTHOR_SOURCE_MOCK_ONLY_NOT_INDEPENDENT_AUTHORITY','conditions':results,
            'PASS':sum(r['PASS'] for r in results),'FAIL':sum(not r['PASS'] for r in results),
            'serviceEffects':0,'sourceEligibility':False}
