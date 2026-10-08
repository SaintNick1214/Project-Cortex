"""Author controls for the concrete U4 successor; no actual Docker/private effects."""
import ast
import copy
import hashlib
import io
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace

def run(successor,entry,adapter,api,original_raw):
    results=[]
    def test(name,fn):
        try:fn();results.append({'name':name,'PASS':True})
        except BaseException as error:results.append({'name':name,'PASS':False,'error':repr(error)})
    def deny(fn):
        try:fn()
        except BaseException as error:return error
        raise AssertionError('required denial absent')
    def row(path,raw=b'x',i=1,roles=('control',)):
        return {'path':path,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
            'nine':dict(zip(api.FIELDS,map(str,(1,i,33152,501,20,1,len(raw),1,1)))),
            'roles':list(roles),'nineBasis':'DECLARED_ORIGINAL'}
    class IO:
        O_RDONLY=0;O_NOFOLLOW=1
        def __init__(self,rows,raws):self.rows={r['path']:copy.deepcopy(r)for r in rows};self.raws=raws;self.fds={};self.opened=[];self.closed=[];self.counter=100
        def rel(self,p):return str(p).removeprefix(str(successor.R)+'/')
        def value(self,r):return SimpleNamespace(**{'st_'+k:int(v)for k,v in r['nine'].items()})
        def lstat(self,p):return self.value(self.rows[self.rel(p)]) if self.rel(p)in self.rows else SimpleNamespace(st_mode=16832)
        def open(self,p,_):fd=self.counter;self.counter+=1;self.opened.append(fd);self.fds[fd]=self.rel(p);return fd
        def fstat(self,fd):return self.value(self.rows[self.fds[fd]])
        def pread(self,fd,n,offset):return self.raws[self.fds[fd]][offset:offset+n]
        def close(self,fd):self.closed.append(fd)
    def fixture(raws=None):
        raws=raws or {'caller.py':b'x=1\n','control.json':b'{"ok":true}','program.py':b'value=4\n'}
        rows=[row(p,r,i+1,('program',)if p.endswith('.py')else('control',))for i,(p,r)in enumerate(raws.items())]
        caller=api.admission_id(rows[0]);edges=[]
        for r in rows:
            for op in ('read','hash','compile','control'):edges.append({'caller':caller,'target':api.admission_id(r),'operation':op})
        recipe={'futureDATA':[],'bodyUseEdges':edges,'programApprovals':{api.admission_id(r):r['sha256']for r in rows if 'program'in r['roles']}}
        view=adapter.SourceView(recipe,tuple(rows),(),'a'*64,'b'*64,(),object());ledger=api.Ledger();io=IO(rows,raws)
        s=adapter.SourceSession(api,str(successor.R),view,ledger,10,'c'*64,
           lambda v,h,l:adapter.RuntimePermit(object(),v.view_sha256,h,v.phase_sha256),io=io,clock=lambda:999000000000000)
        s.open_all(caller);return s,io,ledger,caller
    def finish(s,virtual):
        if not s.closed:s.close()
        assert virtual.opened==virtual.closed and len(virtual.closed)==len(set(virtual.closed))
    def shared_positive():
        s,v,l,c=fixture();port=successor.RootSourcePort(s,c,adapter);baseline=dict(s.owned)
        p=port.capture(successor.R/'control.json','explicit-Root-actual-handoff',s.rows['control.json']['nine'])
        meta,raw=port.qualify(p,{'sha256':s.rows['control.json']['sha256'],'bytes':11},True)
        assert raw==b'{"ok":true}' and meta['fullEOF'] and port.session.ledger is l
        code=port.compile(successor.R/'program.py');assert code.co_filename=='program.py'
        port.release();assert s.owned==baseline and not v.closed
        deny(port.release);deny(lambda:port.qualify(p));finish(s,v)
    test('Root_shared_capture_qualify_approved_compile_view_release_no_new_FD_or_pool',shared_positive)
    for failure in ('missing-context','unapproved-caller','undeclared','escape','wrongnine','wronghash','wrongsize','pinmutation','latecap','stalephysical','premature-dispatch'):
        def invalid(failure=failure):
            s,v,l,c=fixture();port=None;before=len(v.opened)
            if failure=='missing-context':deny(lambda:successor.RootSourcePort(object(),c,adapter));finish(s,v);return
            if failure=='unapproved-caller':deny(lambda:successor.RootSourcePort(s,'f'*64,adapter));finish(s,v);return
            port=successor.RootSourcePort(s,c,adapter)
            fn=lambda:port.capture(successor.R/'control.json','control')
            if failure=='undeclared':fn=lambda:port.capture(successor.R/'absent','control')
            if failure=='escape':fn=lambda:port.capture('/outside/control.json','control')
            if failure=='wrongnine':fn=lambda:port.capture(successor.R/'control.json','control',dict(s.rows['control.json']['nine'],ino='9'))
            if failure in ('wronghash','wrongsize','pinmutation','latecap','stalephysical'):
                p=port.capture(successor.R/'control.json','control');expected={'sha256':s.rows['control.json']['sha256'],'bytes':11}
                if failure=='wronghash':expected['sha256']='f'*64
                if failure=='wrongsize':expected['bytes']=10
                if failure=='pinmutation':p['PRE9']['ctime_ns']='2'
                if failure=='stalephysical':v.rows['control.json']['nine']['ctime_ns']='2'
                if failure=='latecap':
                    remaining=62914621-l.byte_count;i=0
                    while remaining:
                        size=min(remaining,api.CAPS['file']);r=row('late/'+str(i),b'',9000+i);r['bytes']=size;r['nine']['size']=str(size);l.admit(r,debt=True);remaining-=size;i+=1
                fn=lambda:port.qualify(p,expected,True)
            if failure=='premature-dispatch':fn=port.dispatch_boundary
            deny(fn);assert len(v.opened)==before and not v.closed
            port.release();assert not v.closed;finish(s,v)
        test('concrete_Source_port_'+failure+'_denies_no_new_open_no_Root_close',invalid)
    def whole_reachable_failure():
        # This executes the REAL successor outer try/except/finally, using the
        # actual N2 SourceSession and injected Source IO. It fails at the original
        # H scope guard before Common/Docker dispatch, then releases only view.
        s,v,l,c=fixture({'caller.py':b'x=1\n','handoff.json':b'{"scope":"WRONG"}'})
        successor.SOURCE_PORT=None;successor.all_pins=[];successor.failure=None;successor.failure_chain=[];successor.cleanup_errors=[];successor.C=None;successor.results={}
        before=dict(s.owned)
        with redirect_stdout(io.StringIO()):error=deny(lambda:successor.run(s,c,adapter,[str(successor.O/'actual-entry.py'),str(successor.R/'handoff.json')]))
        assert isinstance(error,SystemExit) and error.code==1
        assert successor.failure is not None and successor.SOURCE_PORT.released
        assert s.owned==before and not v.closed and not successor.records
        finish(s,v)
    test('real_successor_outer_handoff_guard_failure_releases_borrow_only_no_dispatch',whole_reachable_failure)
    def entry_missing():
        deny(lambda:entry.run(object(),'f'*64,adapter,[]))
    test('concrete_new_Root_entry_missing_context_denies_before_load_or_effect',entry_missing)
    def entry_bad_binding():
        s,v,l,c=fixture();entry.__file__=str(successor.R/'entry.py')
        deny(lambda:entry.run(s,c,adapter,[]));assert not v.closed;finish(s,v)
    test('concrete_Root_entry_missing_exact_entry_program_mapping_denies_no_FD_effect',entry_bad_binding)
    def partition_fixture():
        members=[row('members/'+str(i),b'x',i+1,('candidateCustody',))for i in range(1907)]
        programs=set(range(32))|set(range(90,95))|set(range(100,113))
        for i in programs:members[i]['roles']=['program']
        for i in set(range(129))-programs:members[i]['roles']=['control']
        keys=[api.admission_id(r)for r in members];caller=keys[0]
        recipe={'schema':'task03-prospective-phase-partition-v1','caps':api.CAPS,'counts':api.COUNTS,
          'assertions':list(api.ASSERTIONS),'members':members,'cohorts':{'currentPrograms':keys[:32],
          'requiredCurrent':keys[:129],'Q6Seeds':keys[90:95],'originalComparands':keys[100:113],
          'frozen':keys,'rootCompiler':keys[:114],'rootCLI':keys[114:119]},'futureDATA':[],
          'bodyUseEdges':[{'caller':caller,'target':key,'operation':op}for key in keys[:129]for op in ('hash','control','read','compile')],
          'programApprovals':{keys[i]:members[i]['sha256']for i in programs}}
        view=adapter.SourceView(recipe,tuple(members[:129]),tuple(members[129:]),'a'*64,'b'*64,(),object())
        ledger=api.Ledger();virtual=IO(members[:129],{r['path']:b'x'for r in members[:129]})
        session=adapter.SourceSession(api,str(successor.R),view,ledger,10,'c'*64,
          lambda v,h,l:adapter.RuntimePermit(object(),v.view_sha256,h,v.phase_sha256),io=virtual,clock=lambda:999000000000000)
        session.open_all(caller);port=successor.RootSourcePort(session,caller,adapter)
        mf={'sourceViewSha256':view.view_sha256,'partitionRecipeSha256':api.digest(recipe),
             'files':[{'path':r['path'],'bytes':r['bytes'],'sha256':r['sha256'],'PRE9':copy.deepcopy(r['nine']),
                      'OPEN9':copy.deepcopy(r['nine']),'POST9':copy.deepcopy(r['nine']),'fullEOF':True}for r in view.rows]}
        h={'sourceViewSha256':view.view_sha256,'partitionRecipeSha256':api.digest(recipe)};approval=copy.deepcopy(h)
        return session,virtual,ledger,caller,port,mf,h,approval
    for variant in ('positive','missing','duplicate','wrong-nine','wrong-hash','view','recipe','approval','program','count','latecap'):
        def partition_case(variant=variant):
            s,v,l,c,port,mf,h,approval=partition_fixture()
            if variant=='missing':mf['files'].pop()
            if variant=='duplicate':mf['files'].append(copy.deepcopy(mf['files'][0]))
            if variant=='wrong-nine':mf['files'][0]['OPEN9']['ctime_ns']='2'
            if variant=='wrong-hash':mf['files'][0]['sha256']='f'*64
            if variant=='view':h['sourceViewSha256']='f'*64
            if variant=='recipe':h['partitionRecipeSha256']='f'*64
            if variant=='approval':approval['sourceViewSha256']='f'*64
            if variant=='program':s.view.recipe['programApprovals'].pop(c)
            if variant=='count':s.view.recipe['cohorts']['currentPrograms'].pop()
            if variant=='latecap':
                size=16777216
                for i in range(3):
                    r=row('late/'+str(i),b'',9000+i);r['bytes']=size;r['nine']['size']=str(size);l.admit(r,debt=True)
                r=row('late/3',b'',9004);r['bytes']=62914621-l.byte_count;r['nine']['size']=str(r['bytes']);l.admit(r,debt=True)
            if variant=='positive':port.bind_source_manifest(h,mf,approval);port.dispatch_boundary();assert port.manifest_bound
            else:deny(lambda:port.bind_source_manifest(h,mf,approval));assert not port.manifest_bound;deny(port.dispatch_boundary)
            before=dict(s.owned);port.release();assert s.owned==before and not v.closed;finish(s,v)
        test('exact_Root_partition_Source_cohort_original_program_counts_'+variant,partition_case)
    def ast_conservation():
        old=ast.parse(original_raw);new=ast.parse(successor._SOURCE_RAW)
        original_try=next(n for n in old.body if isinstance(n,ast.Try))
        actual_run=next(n for n in new.body if isinstance(n,ast.FunctionDef)and n.name=='run')
        new_try=next(n for n in actual_run.body if isinstance(n,ast.Try))
        def phase(nodes):
            start=next(i for i,n in enumerate(nodes)if isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and getattr(n.value.func,'attr',None)=='durable_json' and any(isinstance(v,ast.Constant)and v.value=='source-graph-aggregate-ledger.json'for v in ast.walk(n)))
            end=next(i for i in range(start+1,len(nodes))if isinstance(nodes[i],ast.Assign)and any(isinstance(t,ast.Name)and t.id=='final'for t in nodes[i].targets))
            return nodes[start+1:end]
        assert [ast.dump(n,include_attributes=False)for n in phase(original_try.body)]==[ast.dump(n,include_attributes=False)for n in phase(new_try.body)]
        unchanged=('inspect','recipe','execute','compressed','volume','verify_raw','retain_error')
        oldfunc={n.name:ast.dump(n,include_attributes=False)for n in old.body if isinstance(n,ast.FunctionDef)}
        newfunc={n.name:ast.dump(n,include_attributes=False)for n in new.body if isinstance(n,ast.FunctionDef)}
        assert all(oldfunc[k]==newfunc[k]for k in unchanged)
        assert b'Ledger(' not in successor._SOURCE_RAW and 'os.close' not in ast.unparse(next(n for n in new.body if isinstance(n,ast.FunctionDef)and n.name=='close_owned_inputs'))
    test('AST_original_actual1914_3828_114_161_138_1907_CLI_and_owned_recipe_conservation',ast_conservation)
    return {'scope':'AUTHOR_U3_SOURCE_SEAM_MOCK_STATIC_ONLY','conditions':results,'PASS':sum(r['PASS']for r in results),'FAIL':sum(not r['PASS']for r in results),'effects':0,'sourceEligibility':False}
