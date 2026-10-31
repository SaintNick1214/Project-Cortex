"""Fresh G/header and classification controls; virtual authority/headers only."""
import copy,hashlib,json,os,stat,time,types
from pathlib import Path

def run(bodies,paths,review_dir):
    J=Path(review_dir)
    ns={};exec(compile(bodies[str(J/'independent-controls6.py')],str(J/'independent-controls6.py'),'exec',dont_inherit=True),ns)
    result=ns['run'](bodies,paths,review_dir)
    A=ns['module']('independent_facade_adapters7',paths['adapter'],bodies[paths['adapter']])
    P=ns['module']('independent_facade_phase5_injection7',paths['api'],bodies[paths['api']])
    O=ns['module']('independent_facade_fd_observer7',str(J/'reviewer-fd-observer2.py'),bodies[str(J/'reviewer-fd-observer2.py')])
    rows=[]
    for name in ('reviewer-fixture-module1.py','reviewer-fixture-data1.json'):
        raw=bodies[str(J/name)];rows.append({'path':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'nine':O.nine(os.lstat(J/name)),'roles':['program'] if name.endswith('.py') else ['document'],'nineBasis':'DECLARED_ORIGINAL'})
    caller=P.admission_id(rows[0]);adapter_sha=hashlib.sha256(bodies[paths['adapter']]).hexdigest()
    def check(v):
        if not v:raise AssertionError('INDEPENDENT_CHECK_FAILED')
    def denied(fn):
        try:fn()
        except AssertionError:raise
        except BaseException as e:return str(e)
        raise AssertionError('EXPECTED_DENIAL_NOT_OBSERVED')
    def case(name,fn):
        try:result['details'][name]=fn();result['conditions'].append({'name':name,'status':'PASS'})
        except BaseException as e:result['conditions'].append({'name':name,'status':'FAIL','type':type(e).__name__,'error':str(e)})
    def view(items):
        recipe={'futureDATA':[],'bodyUseEdges':[{'caller':caller,'target':P.admission_id(r),'operation':op} for r in items for op in ('read','control','hash','compile')],'programApprovals':{P.admission_id(rows[0]):rows[0]['sha256']}}
        return A.SourceView(recipe,tuple(copy.deepcopy(items)),(),'a'*64,'b'*64,(),object())
    def permit(v,h,l):return A.RuntimePermit(object(),v.view_sha256,h,v.phase_sha256)
    def main(l):
        io=O.Observer([J/r['path'] for r in rows]);stop=max(max(int(r['nine']['mtime_ns']),int(r['nine']['ctime_ns'])) for r in rows)+1
        return A.SourceSession(P,J,view(rows),l,stop,adapter_sha,permit,io=io),io
    class LexicalPath(type(Path())):
        def resolve(self,*a,**k):return self
    class VirtualIO:
        O_RDONLY=os.O_RDONLY;O_NOFOLLOW=os.O_NOFOLLOW
        def __init__(self,items):self.items=items;self.owned={};self.events=[];self.next=50000
        def stat(self,r):return types.SimpleNamespace(**{'st_'+k:int(v) for k,v in r['nine'].items()})
        def lstat(self,path):
            name=str(path);self.events.append(['lstat',name])
            if name=='/independent-virtual-headers':return types.SimpleNamespace(st_mode=stat.S_IFDIR|0o700)
            if name not in self.items:raise AssertionError('UNDECLARED_VIRTUAL_PATH')
            return self.stat(self.items[name][0])
        def open(self,path,flags):
            name=str(path);check(name in self.items);self.next+=1;self.owned[self.next]=name;self.events.append(['open',name,self.next]);return self.next
        def fstat(self,fd):return self.stat(self.items[self.owned[fd]][0])
        def pread(self,fd,n,offset):self.events.append(['pread',self.owned[fd],offset]);return self.items[self.owned[fd]][1][offset:offset+n]
        def close(self,fd):self.events.append(['close',self.owned.pop(fd),fd])
    def guard_case(mode):
        l=P.Ledger();s,actual=main(l);headers=None;borrow=None;callback=[];oldPath=A.Path
        try:
            s.open_all(caller)
            mf=A.collector_manifest(s,caller)
            plan={'sourceViewSha256':s.view.view_sha256,'sourceMemberPaths':[r['path'] for r in rows]}
            if mode=='duplicate':mf['files'][1]=copy.deepcopy(mf['files'][0])
            if mode=='extra':mf['files'].append(copy.deepcopy(mf['files'][0])|{'path':'hidden-module'})
            if mode=='hash':mf['files'][0]['sha256']='0'*64
            if mode=='nine':mf['files'][0]['OPEN9']['ctime_ns']=str(int(mf['files'][0]['OPEN9']['ctime_ns'])+1)
            if mode=='plan':plan['sourceMemberPaths'].append(rows[0]['path'])
            docs={'plan.json':plan,'mf.json':mf,'approval.json':{'claim':'AUTHOR_PASS_IS_NOT_AUTHORITY'}}
            hrows=[];items={}
            for i,(name,doc) in enumerate(docs.items()):
                raw=json.dumps(doc,sort_keys=True,separators=(',',':')).encode();nine=dict(zip(P.FIELDS,map(str,(22,300+i,33152,501,20,1,len(raw),1,1))))
                row={'path':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'nine':nine,'roles':['header'],'nineBasis':'VIRTUAL_REVIEW_ONLY'}
                hrows.append(row);items['/independent-virtual-headers/'+name]=(row,raw)
            hledger=P.Ledger() if mode=='different-ledger' else l
            vio=VirtualIO(items);A.Path=LexicalPath
            headers=A.SourceSession(P,'/independent-virtual-headers',view(hrows),hledger,2,adapter_sha,permit,io=vio)
            headers.open_all(caller);borrow=headers.borrow(caller)
            before=len([e for e in vio.events if e[0]=='pread'])
            def approval(*args):callback.append(1);return False if mode=='stale-approval' else True
            fn=lambda:A.guard_source_contract(s,caller,borrow,'plan.json','mf.json','approval.json',approval)
            if mode=='positive':
                value=fn();check(value['guardSourceOnly'] and not value['protectedEffects']);check(callback==[1])
                check(len(l.read_debts)==5);debt_absent=set(l.read_debts)-set(mf['sourceMembers'])
                detail={'result':value,'allHeadersChargedSameLedger':True,'newHeaderDebtsAbsentFromEarlierMainSourceMembers':len(debt_absent),'scope':'CODE_MOCK_NO_SOURCE_ADOPTION'}
            else:
                error=denied(fn);check(callback==([1] if mode=='stale-approval' else []))
                if mode=='different-ledger':check(len([e for e in vio.events if e[0]=='pread'])==before)
                detail={'denial':error,'approvalCallbacks':callback,'differentLedgerDeniedBeforeHeaderReads':mode=='different-ledger'}
            borrow.release();check(len(vio.owned)==3)
            headers.final(caller);s.final(caller)
            detail.update(virtualEvents=vio.events,actualEvents=actual.events,borrowReleaseDidNotCloseOwner=True,rawFDProjection=False)
            return detail
        finally:
            A.Path=oldPath
            if headers is not None and not headers.closed:headers.close()
            if not s.closed:s.close()
            check(actual.emergency_close_owned()==[]);check(not actual.fds);check(not l.owned_fds)
            if headers is not None:check(not headers.io.owned)
    for mode in ('positive','different-ledger','duplicate','extra','hash','nine','plan','stale-approval'):
        case('G_'+mode+'_fresh_virtual_headers_exact_root_ledger',lambda mode=mode:guard_case(mode))
    # Boundary mock isolates adapter classification/debt from A5's own rejected
    # partition validator. The exact A5 Ledger/admission/digest are still used.
    def classification(mode):
        recipe_raw=b'{"freshIndependentRecipe":true}';proof_raw=b'{"freshIndependentProof":true}';phase_raw=b'VIRTUAL_PHASE_ONLY'
        bootstrap={};l=P.Ledger();base={}
        for i,(name,raw) in enumerate(zip(('recipe','proof','phase'),(recipe_raw,proof_raw,phase_raw))):
            row={'path':name+'.input','bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'nine':dict(zip(P.FIELDS,map(str,(3,600+i,33152,501,20,1,len(raw),1,1)))),'roles':['program' if name=='phase' else 'header']}
            bootstrap[name]=A.Bootstrap(row,raw);l.admit(row,debt=True);base[P.admission_id(row)]=row
        custody={P.admission_id(bootstrap['phase'].row)} if mode=='bootstrap-custody' else set()
        if mode=='hidden-debt':l.admit(copy.deepcopy(rows[0]),debt=True)
        if mode=='uncharged':l.read_debts.remove(P.admission_id(bootstrap['proof'].row))
        if mode=='bad-raw':bootstrap['proof']=A.Bootstrap(bootstrap['proof'].row,b'changed')
        witness=types.SimpleNamespace(review_receipt_sha256='c'*64)
        class BoundaryAPI:
            CAPS=P.CAPS;admission_id=staticmethod(P.admission_id);digest=staticmethod(P.digest)
            validate_contract=staticmethod(lambda recipe:base)
            proof_of_nonuse=staticmethod(lambda recipe,proof,verifier:(custody,witness))
        calls=[]
        verifier=lambda *args:True
        held=lambda name,body,key,ledger:(calls.append(name) or (False if mode=='external-held-denial' else True))
        fn=lambda:A.source_view(BoundaryAPI,l,bootstrap,verifier,held)
        if mode=='positive':
            value=fn();check(len(value.rows)==3);check(set(l.read_debts)==set(value.bootstrap_admissions));return {'allBootstrapDebtsInSource':True,'bodyIO':0,'boundaryMockNotA5Validation':True}
        error=denied(fn);return {'denial':error,'externalHeldCalls':calls,'bodyIO':0,'boundaryMockNotA5Validation':True,'noSourceAuthority':True}
    for mode in ('positive','bootstrap-custody','hidden-debt','uncharged','bad-raw','external-held-denial'):
        case('source_view_'+mode+'_fresh_boundary_classification',lambda mode=mode:classification(mode))
    result['passed']=sum(x['status']=='PASS' for x in result['conditions']);result['failed']=sum(x['status']=='FAIL' for x in result['conditions'])
    return result
