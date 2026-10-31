"""Finite SOURCE/MOCK controls. No Docker, target, private or network effects."""
import copy
import os
import stat
import struct
import types


def run(sources,carry,wire,proof):
    modules={}
    def load(name,dependencies):
        module=types.ModuleType('source_mock_'+name)
        module.__dict__.update(dependencies)
        exec(compile(sources[name],name,'exec',dont_inherit=True),module.__dict__)
        modules[name]=module;return module
    C=load('C',{}); T=load('T',{'C':C}); Q=load('Q',{'C':C}); L=load('L',{'C':C})
    B=load('B',{}); S=load('S',{'C':C,'T':T}); D=load('D',{'C':C,'T':T,'S':S,'L':L,'M':None})
    results=[]
    def case(name,body):
        try:
            body();results.append({'name':name,'status':'PASS'})
        except BaseException as error:
            results.append({'name':name,'status':'FAIL','error':repr(error)})
    def denied(body,fragment=None):
        try:body()
        except BaseException as error:
            if fragment is not None and fragment not in str(error):raise AssertionError((fragment,repr(error)))
            return
        raise AssertionError('EXPECTED_DENIAL')
    def equal(actual,expected):
        if actual!=expected:raise AssertionError((actual,expected))

    class FS:
        def __init__(self,bodies,owner=(0,0),fault=None):
            self.data=dict(bodies);self.owner=owner;self.fd={};self.opened=[];self.closed=[];self.read_calls=[]
            self.fault=fault;self.events={};self.next=7000;self.phase='open';self.positions={}
            self.inodes={p:8000+i for i,p in enumerate(self.data)}
        def hit(self,kind):
            self.events[kind]=self.events.get(kind,0)+1
            if self.fault and self.fault[0]==kind and self.events[kind] in self.fault[1]:
                raise MemoryError('CONTROL_'+kind) if kind=='register' else OSError('CONTROL_'+kind)
        def value(self,path):
            return types.SimpleNamespace(st_dev=4,st_ino=self.inodes[path],st_mode=stat.S_IFREG|0o600,
                st_uid=self.owner[0],st_gid=self.owner[1],st_nlink=1,st_size=len(self.data[path]),st_mtime_ns=1,st_ctime_ns=1)
        def validate_path(self,path):
            if type(path)is not str or not path.startswith('/'):raise ValueError('CONTROL_ABSOLUTE_PATH')
        def lstat(self,path):self.hit('lstat');return self.value(str(path))
        def fstat(self,fd):self.hit('fstat');return self.value(self.fd[fd])
        def open(self,path,flags=None):
            self.hit('open');self.next+=1;fd=self.next;self.fd[fd]=str(path);self.positions[fd]=0;self.opened.append(fd);return fd
        def register(self,entry,fd):self.hit('register');entry['fd']=fd
        def read(self,fd,size):
            self.hit('read');self.read_calls.append(self.fd[fd]);start=self.positions[fd]
            raw=self.data[self.fd[fd]][start:start+size];self.positions[fd]+=len(raw);return raw
        def close(self,fd):
            if fd not in self.fd:raise AssertionError('FOREIGN_OR_RETRIED_CLOSE')
            self.closed.append(fd);self.fd.pop(fd);self.hit('close')
        def now_ns(self):return 240000000001
        def exists(self,path):return str(path) in self.data
        def open_write(self,path,flags):
            path=str(path)
            if flags & os.O_EXCL and path in self.data:raise FileExistsError(path)
            if path not in self.data:self.data[path]=b'';self.inodes[path]=9000+len(self.data)
            return self.open(path)
        def seek(self,fd,offset):self.positions[fd]=offset
        def write(self,fd,view):
            self.hit('write');path=self.fd[fd];start=self.positions[fd];raw=bytes(view)
            if self.fault and self.fault[0]=='short':raw=raw[:max(1,len(raw)//2)]
            self.data[path]=self.data[path][:start]+raw+self.data[path][start+len(raw):]
            self.positions[fd]+=len(raw);return len(raw)
        def sync(self,fd):self.hit('sync')
        def replace(self,source,destination):
            self.hit('replace');source=str(source);destination=str(destination)
            self.data[destination]=self.data.pop(source);self.inodes[destination]=self.inodes.pop(source)

    bodies={'/a':b'one','/b':b'two','/c':b'three'}
    rows=[{'path':p,'bytes':len(v),'sha256':C.digest(v)} for p,v in bodies.items()]
    def cohort_control(fault=None,primary=False):
        fs=FS(bodies,fault=fault);ledger=C.Ledger();co=C.Cohort(rows,ledger,fs=fs);error=None
        try:
            co.open_all();co.read_all()
            if primary:raise ValueError('ORIGINAL_PRIMARY')
        except BaseException as value:error=value
        close=co.final_and_close(error)
        equal(len(fs.closed),len(fs.opened));equal(len(set(fs.closed)),len(fs.closed));equal(fs.fd,{})
        equal(close['ledger']['liveOwnedSourceFDs'],0)
        if fault or primary:
            if not close['closeErrors']:raise AssertionError('PRIMARY_OR_CLOSE_NOT_STICKY')
        else:
            equal(close['closeErrors'],[]);equal(len(close['members']),3)
            for row in close['members']:
                equal(row['OPEN9'],row['PRE9']);equal(row['POST9'],row['PRE9']);equal(row['FINAL9'],row['PRE9'])
        if fault and fault[0]=='close':denied(lambda:ledger.admit('/later',C.nine(FS({'/later':b''}).value('/later')),C.digest(b''),0,'SOURCE'),'STICKY')
    case('cohort-complete-positive',lambda:cohort_control())
    for event in ('open','register','fstat','read','lstat','close'):
        for positions in ((1,),(2,),(3,),(1,2,3)):
            for primary in (False,True):
                case('cohort-%s-%s-primary%s'%(event,positions,primary),lambda e=event,p=positions,r=primary:cohort_control((e,p),r))
    def maturity():
        fs=FS(bodies);fs.now_ns=lambda:60000000000
        ledger=C.Ledger();co=C.Cohort(rows,ledger,fs=fs)
        denied(co.open_all,'MATURITY');equal(co.final_and_close()['closeAttempts'],[])
    case('source60-boundary-denied',maturity)
    case('strict-duplicate-json',lambda:denied(lambda:C.strict(b'{"a":1,"a":2}'),'DUPLICATE'))
    case('strict-nonfinite-json',lambda:denied(lambda:C.strict(b'{"a":1e999}'),'NONFINITE'))
    for value in (True,-1,16777217):case('typed-file-cap-'+str(value),lambda v=value:denied(lambda:C.integer(v,0,C.MAX_FILE,'FILE_CAP'),'FILE_CAP'))

    synthetic=copy.deepcopy(carry);payloads={}
    for row in synthetic['members']:
        data=bytes([row['index']%251])*row['bytes'];payloads[row['index']]=data;row['sha256']=C.digest(data)
    fakewire=copy.deepcopy(wire)
    for row in fakewire['members']:row['sha256']=synthetic['members'][row['index']]['sha256']
    packets=T.frames(synthetic,payloads)
    case('full2628874-nine-binary-frames',lambda:(equal(len(packets),9),equal(sum(Q.parse_packet(p)[0]['bytes'] for p in packets),2628874),equal(max(map(len,packets))<=327692,True)))
    for index,p in enumerate(packets):
        case('frame-positive-'+str(index),lambda raw=p:Q.parse_packet(raw))
        case('frame-trailing-'+str(index),lambda raw=p:denied(lambda:Q.parse_packet(raw+b'x'),'SIZE_HASH'))
        case('frame-truncated-'+str(index),lambda raw=p:denied(lambda:Q.parse_packet(raw[:-1]),'SIZE_HASH'))
    case('stdin-max-plus1',lambda:denied(lambda:Q.parse_packet(b'x'*327693),'STDIN_CAP'))
    case('header-max-plus1',lambda:denied(lambda:Q.parse_packet(struct.pack('>Q',27685)+b'x'),'HEADER_CAP'))
    case('payload-max-plus1',lambda:denied(lambda:T.packet(0,[[0,0,300001]],b'x'*300001),'BINARY_FRAME'))

    def write_complete(fault=None):
        fs=FS({},fault=fault);ledger=C.Ledger();namespace='linux:'+C.OPERATION+':'
        outputs=[];error=None
        try:
            for packet in packets:
                outputs.append(Q.write_batch(fakewire,packet,ledger=ledger,namespace=namespace,io=fs))
        except BaseException as value:error=value
        equal(len(fs.closed),len(fs.opened));equal(fs.fd,{})
        if fault and fault[0] not in ('short',):
            if error is None:raise AssertionError('EXPECTED_WRITE_FAILURE')
        else:
            if error:raise error
            for row in fakewire['members']:equal(fs.data[row['linuxPath']],payloads[row['index']])
            equal(sum(o['complete'] for out in outputs for o in out['copies']),135)
            for out in outputs:
                for observation in out['copies']:
                    if not observation['complete']:
                        equal(observation['sourceAdmitted'],False);equal(observation['fullEOF'],False);equal(observation['bytes'],None);equal(observation['sha256'],None)
            equal(len({k[0] for k in ledger.admissions if k[0].startswith(namespace+'/source-epoch/inputs/')}),135)
    case('actual-write-and-read-controls-full-nine-batches',write_complete)
    case('short-positive-writes-full-remainder',lambda:write_complete(('short',())))
    for event in ('write','sync','close','replace'):
        for position in (1,2,3):case('writer-'+event+'-'+str(position),lambda e=event,p=position:write_complete((e,(p,))))

    def ledger_roundtrip():
        ledger=C.Ledger();fs=FS({'/z':b'x'})
        for i in range(4096):
            row=C.nine(fs.value('/z'));row['ino']=str(10000+i)
            ledger.admit('/full-source-path/%04d'%i,row,C.digest(b'x'),1,'SOURCE')
        exported=ledger.export();raw=C.encoded(exported['body'])
        if len(raw)<=327692:raise AssertionError('MISSING_REAL_LARGE_FILE_CHANNEL_CASE')
        inherited=C.Ledger.inherit(exported['body'],exported['sha256'])
        equal(inherited.snapshot()['uniquePaths'],4096);equal(inherited.bytes,4096)
        denied(lambda:inherited.admit('/new',row,C.digest(b'x'),1,'SOURCE'),'PATH_CAP')
        wrong=copy.deepcopy(exported['body']);wrong['members'].append(wrong['members'][0])
        denied(lambda:C.Ledger.inherit(wrong,C.digest(C.encoded(wrong))),'DUPLICATE')
        wrong=copy.deepcopy(exported['body']);wrong['summary']['bytes']-=1
        denied(lambda:C.Ledger.inherit(wrong,C.digest(C.encoded(wrong))),'FABRICATED')
        return {'fullLedgerEncodedBytes':len(raw),'sha256':C.digest(raw)}
    case('complete4096-row-ledger-file-over-stdin-roundtrip',ledger_roundtrip)
    def cumulative_bytes():
        ledger=C.Ledger();pin=C.nine(FS({'/x':b''}).value('/x'));pin['size']=str(C.MAX_FILE)
        for i in range(4):
            pin['ino']=str(100+i);ledger.admit('/max/'+str(i),dict(pin),C.digest(b''),C.MAX_FILE,'SOURCE')
        equal(ledger.bytes,67108864)
        pin['size']='1';denied(lambda:ledger.admit('/exceeds',pin,C.digest(b''),1,'SOURCE'),'BYTE_CAP')
    case('64MiB-exact-and-plus1',cumulative_bytes)
    def complete_bootstrap(fault=None,mutate=None,clock=None,clock_positive=False):
        root_ledger=C.Ledger();pin=C.nine(FS({'/x':b'x'}).value('/x'))
        for i in range(3000):
            pin['ino']=str(20000+i);root_ledger.admit('/root/source/%04d'%i,dict(pin),C.digest(b'x'),1,'SOURCE')
        base=root_ledger.export();base_raw=C.encoded(base['body'])
        namespace='linux:'+C.OPERATION+':'
        boot_bodies={'/source-epoch/source_contract.py':sources['C'],'/source-epoch/linux_source_qualifier.py':sources['Q'],
                     '/source-epoch/wire-manifest.json':C.encoded(fakewire),'/source-epoch/base-ledger.json':base_raw}
        boot_rows=[{'name':name,'path':path,'bytes':len(boot_bodies[path]),'sha256':C.digest(boot_bodies[path])}
            for name,path in [('C','/source-epoch/source_contract.py'),('Q','/source-epoch/linux_source_qualifier.py'),
                             ('wire','/source-epoch/wire-manifest.json'),('base','/source-epoch/base-ledger.json')]]
        stop_raw=C.encoded({'writers':'STOPPED','remainingWrites':[],'operation':C.OPERATION,'stoppedUnixNs':'2','wireSha256':C.digest(C.encoded(fakewire))})
        data=dict(boot_bodies)
        data.update({r['linuxPath']:payloads[r['index']] for r in fakewire['members']})
        data['/source-epoch/source-stop.json']=stop_raw
        fs=FS(data,fault=fault)
        controls={'linuxIdentityNamespace':namespace,'controlRows':[{'path':'/source-epoch/source-stop.json',
            'ledgerPath':namespace+'/source-epoch/source-stop.json','bytes':len(stop_raw),'sha256':C.digest(stop_raw)}]}
        contract={'operation':C.OPERATION,'sourceRows':boot_rows,'baseLedgerSha256':base['sha256'],
            'amendments':[],'amendmentsSha256':C.digest(C.encoded([])),'linuxIdentityNamespace':namespace,
            'wireSha256':C.digest(C.encoded(fakewire)),'rootLiveFDs':0,'rootPeakFDs':0}
        if mutate:mutate(contract)
        error=None;result=None
        try:result=B.execute(contract,'qualify',C.encoded(controls),fs=fs,now=fs.now_ns,qualification_fs=fs,clock=clock)
        except BaseException as value:error=value
        equal(len(fs.closed),len(fs.opened));equal(len(set(fs.closed)),len(fs.closed));equal(fs.fd,{})
        if fault or mutate or (clock and not clock_positive):
            if error is None:raise AssertionError('BOOTSTRAP_EXPECTED_DENIAL')
            if fault or clock:
                if not isinstance(error,B.BootstrapFailure):raise AssertionError(('FAILED_ACCOUNTING_ENVELOPE_REQUIRED',repr(error)))
                expected={namespace+row['path']:{'linuxPath':row['path'],'bytes':row['bytes'],'sha256':row['sha256'],'kind':'NEW_LINUX_BOOTSTRAP_SOURCE'} for row in boot_rows}
                expected.update({namespace+row['linuxPath']:{'linuxPath':row['linuxPath'],'bytes':row['bytes'],'sha256':row['sha256'],'kind':'NEW_LINUX_COPY_FULL_EOF'} for row in fakewire['members']})
                expected[namespace+'/source-epoch/source-stop.json']={'linuxPath':'/source-epoch/source-stop.json','bytes':len(stop_raw),'sha256':C.digest(stop_raw),'kind':'SOURCE'}
                charged=T.charge_failed_attempts(root_ledger,base,[],error.envelope,namespace,expected)
                equal(charged['stickyFailure'],True)
                equal(root_ledger.snapshot()['admissions'],3000+len(error.envelope['newAdmissions']))
            return
        if error:raise error
        if len(C.encoded(result))>262144:raise AssertionError('ACTUAL_FULL_RESULT_PIPE_CAP')
        equal(result['physicalSourceCohort']['closeErrors'],[]);equal(len(result['physicalSourceCohort']['members']),136)
        equal(len(result['bootstrapCloseOnce']),4)
        equal(len(result['newAdmissions']),140)
        equal(result['completeNewLedgerSummary']['uniquePaths'],3140)
        merged=T.merge_suffix(root_ledger,base,[],result)
        equal(len(merged),140);equal(root_ledger.snapshot()['uniquePaths'],3140)
        return result,base,root_ledger
    case('actual-held-bootstrap-full135-and-large3000-parent-ledger',complete_bootstrap)
    for event in ('open','fstat','read','close'):
        for index in (1,2,4,5,70,140):
            case('bootstrap-lifetime-%s-%d'%(event,index),lambda e=event,i=index:complete_bootstrap((e,(i,))))
    for key in ('baseLedgerSha256','amendmentsSha256','wireSha256'):
        case('bootstrap-current-hash-'+key,lambda k=key:complete_bootstrap(mutate=lambda c:c.update({k:'0'*64})))
    class DeadlineClock:
        def __init__(self,cut):self.calls=0;self.cut=cut
        def monotonic(self):self.calls+=1;return 48 if self.calls>=self.cut else 0
    for cut in (2,3,6,10,17,25):
        case('bootstrap-whole-deadline-owned-close-and-charge-'+str(cut),lambda n=cut:complete_bootstrap(clock=DeadlineClock(n)))
    def terminal_deadline(offset):
        probe=DeadlineClock(10**9);complete_bootstrap(clock=probe,clock_positive=True)
        complete_bootstrap(clock=DeadlineClock(probe.calls-offset))
    for offset in (0,1,2):case('bootstrap-reached-final-deadline-boundary-'+str(offset),lambda n=offset:terminal_deadline(n))
    for root_live in (4093,True):
        case('bootstrap-shared-root-FDs-before-first-open-'+str(root_live),lambda n=root_live:complete_bootstrap(mutate=lambda c:c.update({'rootLiveFDs':n})))
    def ledger_suffix_fault(change):
        value,base,parent=complete_bootstrap();changed=copy.deepcopy(value);change(changed)
        denied(lambda:T.merge_suffix(C.Ledger.inherit(base['body'],base['sha256']),base,[],changed))
    case('returned-ledger-omitted-row',lambda:ledger_suffix_fault(lambda v:v['newAdmissions'].pop()))
    case('returned-ledger-duplicate-row',lambda:ledger_suffix_fault(lambda v:v['newAdmissions'].append(v['newAdmissions'][0])))
    case('returned-ledger-fabricated-body',lambda:ledger_suffix_fault(lambda v:v['newAdmissions'][0].update({'sha256':'0'*64})))
    case('returned-ledger-fabricated-summary',lambda:ledger_suffix_fault(lambda v:v['completeNewLedgerSummary'].update({'bytes':1})))
    case('returned-ledger-foreign-parent-row',lambda:ledger_suffix_fault(lambda v:v['newAdmissions'][0].update({'path':'/foreign/mac'})))
    case('returned-ledger-reset-base',lambda:ledger_suffix_fault(lambda v:v.update({'baseLedgerSha256':'0'*64})))
    case('returned-ledger-stale-amendment-state',lambda:ledger_suffix_fault(lambda v:v.update({'amendmentsSha256':'0'*64})))
    def new_linux_row_denial(change):
        namespace='linux:'+C.OPERATION+':'
        pin=C.nine(FS({'/x':b'x'}).value('/x'));row={'path':namespace+'/source-epoch/inputs/0000.bin','PRE9':pin,'bytes':1,'sha256':C.digest(b'x'),'kind':'NEW_LINUX_COPY_FULL_EOF'}
        expected={row['path']:{'linuxPath':'/source-epoch/inputs/0000.bin','bytes':1,'sha256':row['sha256'],'kind':row['kind']}}
        change(row);denied(lambda:T.validate_new_linux_rows([row],[],namespace,expected))
    for field,value in (('path','linux:'+C.OPERATION+':/source-epoch/inputs/../foreign'),('sha256','0'*64),('bytes',2),('kind','HISTORY_ONLY')):
        case('new-Linux-fabricated-'+field,lambda k=field,v=value:new_linux_row_denial(lambda r:r.update({k:v})))
    for field in ('uid','gid','nlink','mode','size','mtime_ns','ctime_ns','dev','ino'):
        case('all-nine-typed-'+field,lambda key=field:denied(lambda:C.valid_nine(dict(C.nine(FS({'/x':b''}).value('/x')),**{key:True})),'NINE_STRING'))

    def shared_fd_limit():
        ledger=C.Ledger();ledger.inherited_live=4095;ledger.own(7,'one');equal(ledger.peak,4096)
        denied(ledger.can_open,'PREDISPATCH');ledger.detach(7)
    case('same-parent-child-source4096-FD-ceiling',shared_fd_limit)
    expected={'Memory':2147483648,'Mounts':[{'RW':False,'Source':'/var/lib/docker/volumes/v/_data'}]}
    case('nested-strict-fixture-positive',lambda:T.verify_fixture(expected,copy.deepcopy(expected)))
    for wrong in ({'Memory':True,'Mounts':expected['Mounts']},{'Memory':2147483648,'Mounts':[{'RW':0,'Source':'/var/lib/docker/volumes/v/_data'}]}, {'Memory':2147483648,'Mounts':[{'RW':False,'Source':'/tmp/foreign'}]}):
        case('nested-fixture-denial-'+str(len(results)),lambda value=wrong:denied(lambda:T.verify_fixture(value,expected),'EXACT'))
    case('nominal47-schedule-bounded',lambda:equal(len(T.schedule()),47))
    # Execute actual cleanup across every reachable command prefix. The mock
    # command owns no processes/resources; production cleanup body is unchanged.
    class CleanupRunner:
        def __init__(self,spent,running,fail_at=None):
            self.budget=C.CommandBudget();self.budget.used=spent;self.release={'imageEnv':['PATH=/usr/bin:/bin']}
            self.running=running;self.fail_at=fail_at;self.calls=[]
        def command(self,label,args,**kwargs):
            self.budget.admit(0,kwargs.get('timeout',30),0);self.calls.append((label,args))
            if len(self.calls)==self.fail_at:raise ValueError('CONTROL_CLEANUP_FAILURE')
            if args[0]=='container' and args[1]=='inspect':
                values=[fixture(name,self.running) for name in args[2:]]
                return {},C.encoded(values),b''
            if args[0]=='volume' and args[1]=='inspect':
                return {},C.encoded([{'Name':name,'Driver':'local','Labels':S.LABELS,'Mountpoint':vol_sources[name],'Options':None} for name in args[2:]]),b''
            if args[0]=='stop':self.running=False
            return {},b'',b''
    vol_sources={name:'/var/lib/docker/volumes/'+name+'/_data' for name in (S.INPUT,S.RESULT)}
    commands={S.WRITER:D.WAIT_WRITER,S.QUALIFIER:['-B','-c','VERIFIED_BOOTSTRAP','contract','qualify']}
    cids={S.WRITER:'a'*64,S.QUALIFIER:'b'*64}
    def fixture(name,running):
        return {'Id':cids[name],'Name':'/'+name,'Image':C.IMAGE,'Platform':'linux',
            'Config':{'Cmd':commands[name],'Entrypoint':['/usr/bin/python3'],'Env':['PATH=/usr/bin:/bin'],'User':'0:0','Labels':S.LABELS,'WorkingDir':'/source-epoch'},
            'HostConfig':{'NetworkMode':'none','Memory':2147483648,'MemorySwap':2147483648,'PidsLimit':128,'ReadonlyRootfs':True,'Privileged':False,'AutoRemove':False,
                'CapDrop':['ALL'],'CapAdd':None,'Binds':None,'Devices':[],'DeviceRequests':None,'PidMode':'','IpcMode':'private','SecurityOpt':['no-new-privileges'],'Init':False,'Mounts':[{'Type':'volume','Source':S.INPUT,'Target':'/source-epoch','ReadOnly':name==S.QUALIFIER,'VolumeOptions':{'NoCopy':True}},
                {'Type':'volume','Source':S.RESULT,'Target':'/qualification-result','ReadOnly':False,'VolumeOptions':{'NoCopy':True}}]},
            'Mounts':[{'Type':'volume','Name':S.INPUT,'Source':vol_sources[S.INPUT],'Destination':'/source-epoch','Driver':'local','RW':name!=S.QUALIFIER,'Propagation':''},
                {'Type':'volume','Name':S.RESULT,'Source':vol_sources[S.RESULT],'Destination':'/qualification-result','Driver':'local','RW':True,'Propagation':''}],
            'State':{'Running':running,'ExitCode':0,'Status':'running' if running else 'exited'}}
    owned={'containers':cids,'volumes':[S.INPUT,S.RESULT],'uncertain':{'container':set(),'volume':set()}}
    def prefix_cleanup(prefix,running,fail_at=None):
        runner=CleanupRunner(prefix,running,fail_at)
        output=D.cleanup(runner,owned,commands,vol_sources)
        if runner.budget.used>48:raise AssertionError('ORIGINAL_48_COMMAND_CEILING')
        if fail_at is None:equal(output['ownedAbsent'],True)
        else:equal(output['unknownSticky'],True)
    for prefix in range(41):
        for running in (True,False):case('actual-cleanup-prefix-%d-running%s'%(prefix,running),lambda p=prefix,r=running:prefix_cleanup(p,r))
    for boundary in range(1,9):case('actual-cleanup-boundary-failure-'+str(boundary),lambda i=boundary:prefix_cleanup(40,True,i))
    case('remaining-original-goal-not-accepted',lambda:(equal(proof['sourceEligibility'],False),equal(carry['sourceEligibility'],False),equal(wire['sourceEligibility'],False)))
    if all(name in sources for name in ('E','M','A')):
        E=load('E',{'C':C})
        def root_header_lifetime(fault=None):
            data={('/S/'+n):raw for n,raw in sources.items() if n in ('C','T','Q','L','B','S','D','E','M','A')}
            data.update({'/S/carry':sources['carryRaw'],'/S/wire':sources['wireRaw'],'/S/proof':sources['proofRaw']})
            sender={'scope':'NEW_ROOT_PROSPECTIVE_FIVE_SENDER_PINS_ONLY','oldCustodyRepaired':False,
                'members':[{'path':r['actualMacPath'],'bytes':r['bytes'],'sha256':r['sha256'],'PRE9':r['historicalMacNine']} for r in carry['members'] if not r['original130']]}
            data['/H/sender']=C.encoded(sender);fs=FS(data,owner=(501,20),fault=fault)
            runtime=[{'name':p[3:],'path':p,'bytes':len(raw),'sha256':C.digest(raw),'PRE9':C.nine(fs.value(p))} for p,raw in data.items() if p.startswith('/S/')]
            manifest={'scope':'TASK03_U4_LINUX_ADAPTER_PROSPECTIVE_SOURCE_CLOSURE_ONLY','operation':C.OPERATION,'writers':'STOPPED',
                'remainingSourceWrites':[],'sourceEligibility':False,'sourceStoppedUnixNs':'2','runtimeSourceInputs':runtime,
                'lateSourceInputSpecs':[{'name':'sender','path':'/H/sender','maximumBytes':65536}]}
            mf_raw=C.encoded(manifest);fs.data['/H/manifest']=mf_raw;fs.inodes['/H/manifest']=9200
            approval={'scope':'TASK03_U4_LINUX_ADAPTER_INDEPENDENT_SOURCE_ONLY','verdict':'PASS','independent':True,
                'sourceManifestSha256':C.digest(mf_raw),'sourceManifestOriginalNine':C.nine(fs.value('/H/manifest')),
                'runtimeSources':{r['path']:r['sha256'] for r in runtime}}
            approval_raw=C.encoded(approval);fs.data['/H/approval']=approval_raw;fs.inodes['/H/approval']=9201
            release={'scope':'ROOT_EXPLICIT_U4_LINUX_SOURCE_FIXTURE_RELEASE_ONLY','operation':C.OPERATION,
                'sourceManifestSha256':C.digest(mf_raw),'sourceApprovalSha256':C.digest(approval_raw),'verdict':'PASS','fixtureEffectsAuthorized':True,
                'maxPaid':1,'targetEffectsAllowed':False,'privateInputsAllowed':False,'macSourceGatesReplaced':False,'imageID':C.IMAGE,
                'dockerPath':'/Applications/Docker.app/Contents/Resources/bin/docker','dockerEndpoint':'unix:///Users/SaintNick/.docker/run/docker.sock',
                'daemonSocketNine':C.nine(fs.value('/H/manifest')),'daemonID':'pure-fixture','imageEnv':['PATH=/usr/bin:/bin'],'senderProspectiveNineSha256':C.digest(data['/H/sender'])}
            fs.data['/H/release']=C.encoded(release);fs.inodes['/H/release']=9202
            rows=[{'name':n,'path':'/H/'+n,'bytes':len(fs.data['/H/'+n]),'sha256':C.digest(fs.data['/H/'+n]),'PRE9':C.nine(fs.value('/H/'+n))} for n in ('manifest','approval','release','sender')]
            error=None
            try:E.run_from_closed_headers(rows,C.Ledger(),'/NO_EFFECT_ALLOWED',C.digest(mf_raw),C.digest(approval_raw),source_fs=fs)
            except BaseException as value:error=value
            if error is None:raise AssertionError('PAID_RELEASE_MUST_DENY_BEFORE_EFFECT')
            equal(len(fs.closed),len(fs.opened));equal(len(set(fs.closed)),len(fs.closed));equal(fs.fd,{})
            if fault is None:
                if 'maxPaid' not in str(error):raise AssertionError(('WRONG_ROOT_SOURCE_GUARD_DENIAL',repr(error)))
                equal(len(fs.opened),4+len(runtime)+1)
        case('actual-root-header-all-code-loading-denied-paid-release',root_header_lifetime)
        for event in ('open','register','fstat','read','close'):
            for positions in ((1,),(4,),(5,),(10,),(18,),(1,4,5,10,18)):
                case('root-header-whole-lifetime-%s-%s'%(event,positions),lambda e=event,p=positions:root_header_lifetime((e,p)))
    driver=None
    if 'R' in sources:
        R=load('R',{});driver=R.run(C,T,Q,B,S,D,L,FS,carry,wire,proof,sources)
        results+=driver['conditions']
    return {'scope':'FINITE_AUTHOR_SOURCE_MOCK_CONTROLS_ONLY','conditions':results,'driverControls':driver,
        'passed':sum(r['status']=='PASS' for r in results),'failed':sum(r['status']=='FAIL' for r in results),
        'realServiceOutcomes':0,'DockerEffects':0,'privateReads':0,'fullTask03':False,'fullGoal':False,
        'fullSyntheticPayloadBytes':2628874,'binaryBatches':len(packets),'maxBinaryFrameBytes':max(map(len,packets)),
        'sourceEligibility':False,'runtimeAuthority':False}
