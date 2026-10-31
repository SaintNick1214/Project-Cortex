"""Independent bounded SOURCE controls. Loaded only from held verified bytes.

Candidate AST/functions run with explicit isolated dependencies. No candidate
entry, Docker, service, target, credential or native operation is dispatched.
"""
import ast,copy,hashlib,json,math,os,re,stat,sys,time,types,traceback
from pathlib import Path
J=Path(__file__).resolve().parent
P=J.parent
A=P/'task04-current-producer-native-public-repair3'
B=P/'task04-current-producer-native-public-consumer-repair3'
FIX=J/'owned-fixtures'
ROWS=[]

def chain(error):
    out=[];seen=set()
    while error is not None and id(error) not in seen:
        seen.add(id(error));out.append({'class':type(error).__name__,'text':str(error)})
        error=error.__cause__ or error.__context__
    return out

def record(name,ok,**details):
    ROWS.append({'name':name,'status':'PASS' if ok else 'FAIL',**details})

def isolated(raw,path,skip_imports=False):
    tree=ast.parse(raw,filename=str(path))
    if skip_imports:tree.body=[n for n in tree.body if not isinstance(n,(ast.Import,ast.ImportFrom))]
    ns={'__file__':str(path),'__name__':'independent_source_control','re':re}
    exec(compile(tree,str(path),'exec'),ns)
    return ns,tree

class IO:
    """Real owned fixture FDs with one deliberate syscall-boundary failure."""
    def __init__(self,kind=None,index=None):
        self.kind=kind;self.index=index;self.calls={};self.opens=[];self.attempts=[];self.closed=[]
    def __getattr__(self,key):return getattr(os,key)
    def hit(self,key):
        n=self.calls.get(key,0)+1;self.calls[key]=n
        if self.kind==key and n==self.index:raise OSError('INJECTED_'+key+'_'+str(n))
    def open(self,path,*args):
        self.hit('open');fd=os.open(path,*args);self.opens.append({'fd':fd,'path':str(path)});return fd
    def fstat(self,fd):self.hit('fstat');return os.fstat(fd)
    def read(self,fd,count):self.hit('read');return os.read(fd,count)
    def lstat(self,path):self.hit('lstat');return os.lstat(path)
    def write(self,fd,raw):self.hit('write');return os.write(fd,raw)
    def fsync(self,fd):self.hit('fsync');return os.fsync(fd)
    def close(self,fd):
        self.attempts.append(fd);os.close(fd);self.closed.append(fd);self.hit('close')
    def rescue(self):
        rescued=[]
        for row in self.opens:
            fd=row['fd']
            if fd not in self.attempts:os.close(fd);rescued.append(fd)
        return rescued

def consumer(raw):
    ns,_=isolated(raw,B/'programs/consumer.py');ns['N']=FIX;ns['LEDGER']=ns['InputLedger']();return ns

def open_case(raw,kind,index):
    ns=consumer(raw);io=IO(kind,index);ns['os']=io;paths=[FIX/('input'+str(i)+'.json')for i in range(3)]
    if kind=='maturity':
        original=ns['mature'];counter=[0]
        def mature(pin,now):
            counter[0]+=1
            if counter[0]==index:raise ns['BoundaryFailure']('INJECTED_maturity_'+str(index))
            return original(pin,now)
        ns['mature']=mature
    if kind=='opened':
        original=ns['LEDGER'].opened;counter=[0]
        def opened():
            counter[0]+=1
            if counter[0]==index:raise MemoryError('INJECTED_LEDGER_OPENED_'+str(index))
            return original()
        ns['LEDGER'].opened=opened
    error=None;pending=[]
    try:pending=ns['open_inputs'](paths)
    except BaseException as e:error=e
    if pending:
        try:ns['close_inputs'](pending)
        except BaseException as e:error=e
    expected=[r['fd']for r in io.opens]
    okay=(error is not None if kind else error is None)and sorted(io.attempts)==sorted(expected)and len(io.attempts)==len(set(io.attempts))
    rescued=io.rescue()
    record('C5.open_inputs.'+str(kind)+'.'+str(index),okay,opened=io.opens,closeAttempts=io.attempts,
           rescuedOnlyOwnedNeverAttempted=rescued,errorChain=chain(error),ledgerActive=ns['LEDGER'].active)

def read_case(raw,kind,index):
    ns=consumer(raw);io=IO();ns['os']=io;paths=[FIX/('input'+str(i)+'.json')for i in range(3)]
    pending=ns['open_inputs'](paths);io.kind=kind;io.index=index;io.calls={};error=None
    try:
        for row in pending:ns['read_held'](row,collect=True)
    except BaseException as e:error=e
    finally:
        try:ns['close_scope'](pending)
        except BaseException as e:error=e
    expected=[r['fd']for r in io.opens]
    record('C5.read_held.'+str(kind)+'.'+str(index),error is not None and sorted(io.attempts)==sorted(expected)and len(io.attempts)==len(set(io.attempts)),
           opened=io.opens,closeAttempts=io.attempts,errorChain=chain(error),rescued=io.rescue())

def close_case(raw,index,primary=False,all_fail=False):
    ns=consumer(raw);io=IO();ns['os']=io;pending=ns['open_inputs']([FIX/('input'+str(i)+'.json')for i in range(3)])
    io.kind='close';io.index=index;error=None
    if all_fail:
        def close(fd):
            io.attempts.append(fd);os.close(fd);io.closed.append(fd);raise OSError('INJECTED_ALL_CLOSE_'+str(fd))
        io.close=close
    try:
        try:
            if primary:raise ValueError('PRIMARY_MARKER')
        finally:ns['close_scope'](pending)
    except BaseException as e:error=e
    first=io.attempts[:]
    try:ns['close_inputs'](pending)
    except BaseException as e:error=e
    expected=[r['fd']for r in io.opens];texts=[r['text']for r in chain(error)]
    okay=sorted(io.attempts)==sorted(expected)and io.attempts==first and error is not None and(not primary or any('PRIMARY_MARKER'in t for t in texts))
    record('C5.close_inputs.'+str(index)+('.primary'if primary else'')+('.all'if all_fail else''),okay,
           opened=io.opens,closeAttempts=io.attempts,secondCloseDidNotRetry=io.attempts==first,errorChain=chain(error),rescued=io.rescue())

def consume_case(raw,fault,index=1):
    """Execute actual entire function with DI finite baseline/owned child cohort."""
    ns=consumer(raw);events=[];scope=[{'path':'baseline','heldFD':100}];pending=[{'path':'member'+str(i),'heldFD':101+i}for i in range(3)]
    data={'schema':'DISTINCT_FIRST_CURRENT_MATURE_BASELINE_V2','oldPacketScope':'FAILED','oldFailedCount':119,
          'runtimeAuthority':False,'sourceEligibility':False,'files':[{'path':str(FIX/('input'+str(i)+'.json')),'PRE':{},'bytes':2,'sha256':'0'*64}for i in range(3)]}
    opened=[0];reads=[0];closes=[];error=None
    def open_inputs(paths):
        opened[0]+=1
        if fault=='partial-open'and opened[0]==2:raise ValueError('PARTIAL_OPEN_MARKER')
        return scope if opened[0]==1 else pending
    def read_held(row,*args,**kwargs):
        if row is scope[0]:return dict(row),json.dumps(data).encode()
        reads[0]+=1
        if fault=='read'and reads[0]==index:raise ValueError('READ_MARKER_'+str(index))
        return dict(row),None
    def close_inputs(rows):
        failures=[]
        for row in rows:
            fd=row.pop('heldFD',None)
            if fd is not None:
                closes.append(fd)
                if fault=='close'and fd==100+index:failures.append(fd)
        if failures:raise ValueError('CLOSE_MARKER_'+str(failures))
        return closes[:]
    ns.update(open_inputs=open_inputs,read_held=read_held,close_inputs=close_inputs,
              final_fence=lambda r:None,check_row=lambda *a:None,
              output=lambda *a:events.append('report')or{'okay':True})
    if fault=='parse':ns['strict']=lambda raw:(_ for _ in()).throw(ValueError('PARSE_MARKER'))
    if fault=='report':ns['output']=lambda *a:(_ for _ in()).throw(ValueError('REPORT_MARKER'))
    if fault=='final':ns['final_fence']=lambda r:(_ for _ in()).throw(ValueError('FINAL_MARKER'))
    try:ns['consume_baseline']({'bytes':2,'sha256':'0'*64})
    except BaseException as e:error=e
    expected=[100]if fault in('parse','partial-open')else[100,101,102,103]
    record('C5.consume_baseline.'+fault+'.'+str(index),sorted(closes)==expected and len(closes)==len(set(closes))and(error is not None if fault!='positive'else error is None),
           closeAttempts=closes,errorChain=chain(error),actualWholeFunction=True,fixtureDIOnly=True)

def ci_entry(raw,fault,index=1,body_primary=False):
    tree=ast.parse(raw,filename=str(A/'source/ci-run.py'));entry=next(n for n in tree.body if isinstance(n,ast.If)and ast.unparse(n.test)=="__name__ == '__main__'")
    compiled=compile(ast.Module(body=[entry],type_ignores=[]),str(A/'source/ci-run.py'),'exec')
    attempts=[];fences=[];rescues=[];pub=[];exits=[];fds=[os.open(FIX/('input'+str(i)+'.json'),os.O_RDONLY|os.O_NOFOLLOW)for i in range(3)]
    class H:
        def __init__(self,i,fd):self.i=i;self.fd=fd
        def fence(self,full=False):
            fences.append(self.i)
            if fault=='fence'and self.i==index:raise ValueError('FENCE_MARKER_'+str(index))
        def close(self):
            fd=self.fd;self.fd=None
            if fd is not None:
                attempts.append(self.i);os.close(fd)
                if fault=='close'and self.i==index:raise OSError('CLOSE_MARKER_'+str(index))
    objects=[H(i+1,fd)for i,fd in enumerate(fds)]
    def save(name,value):
        pub.append({'name':name,'value':value})
        if(fault=='cleanup-report'and name=='cleanup-failure.json')or(fault=='stop-report'and name=='writer-stop.json')or(fault=='body-report'and name=='host-failure.json'):
            raise OSError('REPORT_MARKER_'+name)
    def main():
        if body_primary:raise ValueError('PRIMARY_MARKER')
    def cleanup():
        if fault=='cleanup-report':raise ValueError('CLEANUP_MARKER')
    ns={'__name__':'__main__','RUN':FIX,'SOURCE_HELD':objects,'SOURCE_DIRS':[],'time':types.SimpleNamespace(monotonic=lambda:1),
        'phase':lambda *a:None,'remaining':lambda:10,'main':main,'cleanup':cleanup,'save':save,
        'fence_directories':lambda *a:None,'artifact_manifest':lambda:None,
        'sys':types.SimpleNamespace(stderr=sys.stderr,exit=lambda code:exits.append(code))}
    error=None
    try:exec(compiled,ns)
    except BaseException as e:error=e
    for obj in objects:
        if obj.fd is not None:
            fd=obj.fd;obj.fd=None;os.close(fd);rescues.append({'index':obj.i,'fd':fd})
    retained=not body_primary or ns.get('primary')=='ValueError(\'PRIMARY_MARKER\')'or any('PRIMARY_MARKER'in r['text']for r in chain(error))
    record('R3.ci_entry.'+fault+'.'+str(index)+('.primary'if body_primary else''),attempts==[1,2,3]and len(attempts)==len(set(attempts))and retained,
           closeAttempts=attempts,fenceAttempts=fences,rescuedOnlyOwnedNeverAttempted=rescues,errorChain=chain(error),
           primaryAfter=ns.get('primary'),exitCalls=exits,publications=pub,actualWholeMainGuardAST=True,
           exactSourceLine=entry.lineno,fixtureNoDockerEffects=True)

def public_controls(raw,native_export):
    pubtree=ast.parse(native_export);assignment=next(n for n in pubtree.body if isinstance(n,ast.Assign)and any(isinstance(t,ast.Name)and t.id=='PUBLIC'for t in n.targets))
    public=ast.literal_eval(assignment.value)
    ns,_=isolated(raw,A/'source/public_export_contract.py',True);ns.update(FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'),PUBLIC=public)
    data={'scope':'FINITE_PUBLIC_SOURCE_CONTROL_EXPORT_ONLY','files':[{'relativePath':n,'status':'ABSENT'}for n in public],
          'fileCount':23,'existingBytes':0,'combinedExportBytesMaxIncludingThisManifest':1048576,'primaryFailure':None,
          'allDescendantsTerminal':True,'nativeClaims':False,'original122':'HELD','ROOT':'ABSENT'}
    result={'scope':'PUBLIC_SYNTHETIC_SOURCE_CONTROLS_ONLY','controls':[{'name':'control-'+str(i),'status':'PASS'}for i in range(48)],
            'count':48,'nativeClaims':False,'original122':'HELD','ROOT':'ABSENT','whole120':'HELD'}
    variants=[('positive',data,0,result,False)]
    for value in(False,True,0,1,[],{}):
        d=copy.deepcopy(data);d['primaryFailure']=value;variants.append(('primaryFailure.'+repr(value),d,0,result,True))
    for value in(False,True,None,1,-1,256,0.0):variants.append(('processExit.'+repr(value),data,value,result,True))
    d=copy.deepcopy(data);d['primaryFailure']='FAILED';variants.append(('stickyFailure',d,0,result,True))
    variants.append(('missingResult',data,0,None,True))
    for field,value in [('count',True),('count',47),('nativeClaims',True),('whole120','PASS'),('ROOT','PRESENT')]:
        r=copy.deepcopy(result);r[field]=value;variants.append(('result.'+field+'.'+repr(value),data,0,r,True))
    for mode in('duplicate','failed','empty','short','long'):
        r=copy.deepcopy(result)
        if mode=='duplicate':r['controls'][1]['name']=r['controls'][0]['name']
        if mode=='failed':r['controls'][47]['status']='FAIL'
        if mode=='empty':r['controls'][0]['name']=''
        if mode=='short':r['controls'].pop()
        if mode=='long':r['controls'].append({'name':'49','status':'PASS'})
        variants.append(('result.'+mode,data,0,r,True))
    for label,d,e,r,deny in variants:
        error=None;answer=None
        try:answer=ns['validate_public_outcome'](d,e,r)
        except BaseException as err:error=err
        record('R3.public_outcome.'+label,(error is not None)==deny,errorChain=chain(error),answer=answer)
    return ns,data,result

def conservation():
    ref=json.loads(held_source(str(A/'original100-conservation-reference.json')));fail=[]
    for row in ref['rows']:
        raw=held_source(str(A/row['newExactConservationBacking']))
        if (len(raw),hashlib.sha256(raw).hexdigest())!=(row['bytes'],row['sha256']):fail.append(row['originalSource'])
    record('Conservation.original100.exactBytes',len(ref['rows'])==100 and not fail,count=len(ref['rows']),failures=fail,
           historicalCustodyRepaired=False)
    current=json.loads(held_source(str(A/'source/source-manifest.json')))
    old=json.loads(held_source(str(P/'task04-current-producer-native-public-repair1/source/source-manifest.json')))
    om={r['path']:r for r in old['files']};changed=[];unchanged=0
    for row in current['files']:
        raw=held_source(str(A/'source'/row['path']));assert(len(raw),hashlib.sha256(raw).hexdigest())==(row['bytes'],row['sha256'])
        if row==om[row['path']]:unchanged+=1
        else:changed.append(row['path'])
    record('Conservation.R3.onlyTwoChanges',unchanged==110 and changed==['ci-run.py','public_export_contract.py'],
           unchanged=unchanged,changed=changed,whole112Exact=True)
    plans=[(p,r)for p,r in cohort_pins.items()if p.startswith(str(B)+'/data/')and 'plan'in Path(p).name and p.endswith('.json')]
    summaries=[]
    for path,pin in plans:
        plan=json.loads(held_source(path));files=plan.get('files',[])
        if files and isinstance(files,list)and isinstance(files[0],dict)and 'roles'in files[0]:
            stable113=sum('STABLE_OPERATIVE113'in r['roles']for r in files);stable336=sum('STABLE_ORIGINAL336'in r['roles']for r in files)
            old119=[];bad=[]
            for row in files:
                held=cohort_pins[row['path']]['PRE9']
                if row.get('stableLiteral')is not None and row['stableLiteral']!=held:bad.append(row['path'])
                prior=row.get('oldPacketLiteral')
                if prior is not None and prior!=held:old119.append([k for k in held if held[k]!=prior[k]])
            summaries.append({'path':path,'stable113':stable113,'stable336':stable336,'oldMismatches':len(old119),'changedFieldSets':sorted(set(tuple(v)for v in old119)),'stableMismatch':bad})
    record('Conservation.stable113.336.old119',bool(summaries)and all(x['stable113']==113 and x['stable336']==336 and x['oldMismatches']==119 and x['changedFieldSets']==[('ctime_ns',)]and not x['stableMismatch']for x in summaries),plans=summaries)

def main():
    c=held_source(str(B/'programs/consumer.py'));ci=held_source(str(A/'source/ci-run.py'))
    pub=held_source(str(A/'source/public_export_contract.py'));ne=held_source(str(A/'source/native_export.py'))
    conservation()
    open_case(c,None,1)
    for fault in('open','fstat','maturity','opened'):
        for index in(1,2,3):open_case(c,fault,index)
    for fault in('read','fstat','lstat'):
        for index in(1,2,3):read_case(c,fault,index)
    for index in(1,2,3):
        close_case(c,index);close_case(c,index,True)
    close_case(c,1,True,True)
    for fault in('positive','parse','partial-open','report','final'):
        consume_case(c,fault)
    for fault in('read','close'):
        for index in(1,2,3):consume_case(c,fault,index)
    ns=consumer(c)
    for token in(b'{"x":1e309}',b'{"x":-1e309}',b'{"x":NaN}',b'{"x":Infinity}',b'{"x":-Infinity}',b'{"x":1,"x":2}'):
        err=None
        try:ns['strict'](token)
        except BaseException as e:err=e
        record('C5.strict.'+token.decode(),err is not None,errorChain=chain(err))
    record('C5.strict.finitePositive',ns['strict'](b'{"x":1.5}')=={'x':1.5})
    for fault in('positive','close','fence'):
        for index in((1,)if fault=='positive'else(1,2,3)):
            ci_entry(ci,fault,index);ci_entry(ci,fault,index,True)
    for fault in('cleanup-report','stop-report','body-report'):ci_entry(ci,fault,1,True)
    public_controls(pub,ne)
    value={'scope':'INDEPENDENT_ISOLATED_SOURCE_CONTROLS_ONLY','rows':ROWS,'pass':sum(r['status']=='PASS'for r in ROWS),
           'fail':sum(r['status']=='FAIL'for r in ROWS),'ledger':source_ledger(),'candidateProgramsExecuted':False,
           'Docker':False,'private':False,'native':False,'functionalTask04':False,'fixtureFDsAllClosedByHarness':True,
           'actualCandidateFunctionsAndASTOnly':True}
    target=J/'independent-controls1.json';target.write_text(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n')
    return {'pass':value['pass'],'fail':value['fail'],'path':str(target),'failNames':[r['name']for r in ROWS if r['status']=='FAIL']}
