"""Fresh bounded Source/mock and owned local process judgment controls.

No Docker, service, private, network, target or inference dispatch is permitted.
All candidate code comes from externally owned qualified bytes.
"""
import copy
import hashlib
import json
import os
import stat
import sys
import time
import types
from pathlib import Path


def run(held, bodies, own_dir):
    own_dir=Path(own_dir)
    l=own_dir.parent/'task03-u4-linux-prospective-source-qualification1'
    mf=json.loads(bodies[str(l/'closed-adapter-source-manifest.json')])
    named={r['name']:r for r in mf['runtimeSourceInputs']}
    def raw(name):return bodies[named[name]['path']]
    def module(name,deps):
        m=types.ModuleType('independently_held_'+name);m.__file__=named[name]['path'];m.__dict__.update(deps)
        exec(compile(raw(name),m.__file__,'exec',dont_inherit=True),m.__dict__)
        return m
    C=module('C',{});T=module('T',{'C':C});Q=module('Q',{'C':C});L=module('L',{'C':C})
    S=module('S',{'C':C,'T':T});D=module('D',{'C':C,'T':T,'S':S,'L':L,'M':None});E=module('E',{'C':C})
    carry=C.strict(raw('carry'));wire=C.strict(raw('wire'));proof=C.strict(raw('proof'))
    results=[];details={}
    def case(name,f):
        try:result=f();results.append({'name':name,'status':'PASS'});details[name]=result
        except BaseException as e:results.append({'name':name,'status':'FAIL','type':type(e).__name__,'error':str(e)})
    def eq(a,b):
        if a!=b:raise AssertionError((a,b))
    def deny(f,fragment):
        try:f()
        except BaseException as e:
            if fragment not in str(e):raise AssertionError(('wrong denial',fragment,type(e).__name__,str(e)))
            return type(e).__name__+': '+str(e)
        raise AssertionError('Expected denial '+fragment)
    class FS:
        def __init__(self,data=None,owner=(501,20),close_fail=()):
            self.data=dict(data or {});self.owner=owner;self.fds={};self.offset={};self.inodes={p:100+i for i,p in enumerate(self.data)}
            self.opens=[];self.closes=[];self.reads=[];self.next=8000;self.close_fail=set(close_fail)
        def value(self,p):
            p=str(p);return types.SimpleNamespace(st_dev=77,st_ino=self.inodes[p],st_mode=stat.S_IFREG|0o600,st_uid=self.owner[0],st_gid=self.owner[1],st_nlink=1,st_size=len(self.data[p]),st_mtime_ns=1,st_ctime_ns=1)
        def validate_path(self,p):
            if not str(p).startswith('/'):raise ValueError('independent absolute path')
        def lstat(self,p):return self.value(p)
        def fstat(self,fd):return self.value(self.fds[fd])
        def now_ns(self):return 1_000_000_000_000
        def open(self,p):
            self.next+=1;fd=self.next;self.fds[fd]=str(p);self.offset[fd]=0;self.opens.append(fd);return fd
        def register(self,entry,fd):entry['fd']=fd
        def read(self,fd,n):
            self.reads.append(self.fds[fd]);start=self.offset[fd];data=self.data[self.fds[fd]][start:start+n];self.offset[fd]+=len(data);return data
        def close(self,fd):
            if fd not in self.fds:raise AssertionError('foreign or second close')
            self.closes.append(fd);del self.fds[fd]
            if len(self.closes) in self.close_fail:raise OSError('independent close after physical detach')
        def put(self,p,data):self.data[str(p)]=data;self.inodes[str(p)]=1000+len(self.data)
    def simple_row(fs,p):return {'path':p,'bytes':len(fs.data[p]),'sha256':C.digest(fs.data[p]),'expectedNine':C.nine(fs.value(p))}
    def ledger_identity():
        ledger=C.Ledger();fs=FS({'/one':b'abc'});pin=C.nine(fs.value('/one'));sha=C.digest(b'abc')
        eq(ledger.admit('/one',pin,sha,3,'SOURCE'),True);eq(ledger.admit('/one',pin,sha,3,'DOC'),False)
        changed=dict(pin,ctime_ns='2');eq(ledger.admit('/one',changed,sha,3,'DATA'),True)
        eq(ledger.snapshot()['bytes'],6);eq(ledger.snapshot()['uniquePaths'],1);eq(ledger.snapshot()['admissions'],2)
        return ledger.snapshot()
    case('identity-dedup-requires-all-nine-size-and-hash',ledger_identity)
    def cap_control(kind):
        fs=FS({'/one':b'abc'});ledger=C.Ledger()
        if kind=='bytes':ledger.bytes=C.MAX_BYTES
        else:ledger.inherited_live=C.MAX_FILES
        cohort=C.Cohort([simple_row(fs,'/one')],ledger,fs=fs,owner=(501,20))
        result=deny(cohort.open_all,'SOURCE_CUMULATIVE_BYTE_CAP' if kind=='bytes' else 'SOURCE_LIVE_FD_PREDISPATCH_CAP')
        eq(fs.opens,[]);closed=cohort.final_and_close();eq(closed['closeAttempts'],[]);return result
    case('byte-exhaustion-denies-before-open',lambda:cap_control('bytes'))
    case('shared-fd-exhaustion-denies-before-open',lambda:cap_control('fds'))
    def close_control():
        fs=FS({'/one':b'abc','/two':b'def','/three':b'ghi'},close_fail=(1,3));ledger=C.Ledger()
        cohort=C.Cohort([simple_row(fs,p) for p in fs.data],ledger,fs=fs,owner=(501,20))
        cohort.open_all();cohort.read_all();closed=cohort.final_and_close(ValueError('independent primary'))
        eq(len(fs.closes),3);eq(len(set(fs.closes)),3);eq(fs.fds,{});eq(len(closed['closeErrors']),3);eq(ledger.failed_close,True)
        deny(lambda:ledger.admit('/other',C.nine(fs.value('/one')),C.digest(b'abc'),3,'SOURCE'),'STICKY_UNKNOWN_SOURCE_CLOSE')
        return closed
    case('primary-plus-first-last-close-all-attempted-once-sticky',close_control)
    def root_header_denial(mode):
        data={'/independent-runtime/'+name:raw(name) for name in named}
        sender={'scope':'NEW_ROOT_PROSPECTIVE_FIVE_SENDER_PINS_ONLY','oldCustodyRepaired':False,
                'members':[{'path':r['actualMacPath'],'bytes':r['bytes'],'sha256':r['sha256'],'PRE9':r['historicalMacNine']} for r in carry['members'] if not r['original130']]}
        data['/independent-header/sender']=C.encoded(sender);fs=FS(data)
        runtime=[{'name':name,'path':'/independent-runtime/'+name,'bytes':len(raw(name)),'sha256':C.digest(raw(name)),
                  'PRE9':C.nine(fs.value('/independent-runtime/'+name))} for name in named]
        manifest={'scope':'TASK03_U4_LINUX_ADAPTER_PROSPECTIVE_SOURCE_CLOSURE_ONLY','operation':C.OPERATION,'writers':'STOPPED',
                  'remainingSourceWrites':[],'sourceEligibility':False,'sourceStoppedUnixNs':'2','runtimeSourceInputs':runtime,
                  'lateSourceInputSpecs':[{'name':'sender','path':'/independent-header/sender','maximumBytes':65536}]}
        mfraw=C.encoded(manifest);fs.put('/independent-header/manifest',mfraw)
        approval={'scope':'TASK03_U4_LINUX_ADAPTER_INDEPENDENT_SOURCE_ONLY','verdict':'PASS','independent':True,
                  'sourceManifestSha256':C.digest(mfraw),'sourceManifestOriginalNine':C.nine(fs.value('/independent-header/manifest')),
                  'runtimeSources':{r['path']:r['sha256'] for r in runtime}}
        if mode=='approval':approval['independent']=1
        approvalraw=C.encoded(approval);fs.put('/independent-header/approval',approvalraw)
        release={'scope':'ROOT_EXPLICIT_U4_LINUX_SOURCE_FIXTURE_RELEASE_ONLY','operation':C.OPERATION,
          'sourceManifestSha256':C.digest(mfraw),'sourceApprovalSha256':C.digest(approvalraw),'verdict':'PASS','fixtureEffectsAuthorized':True,
          'maxPaid':True,'targetEffectsAllowed':False,'privateInputsAllowed':False,'macSourceGatesReplaced':False,'imageID':C.IMAGE,
          'dockerPath':'/Applications/Docker.app/Contents/Resources/bin/docker','dockerEndpoint':'unix:///Users/SaintNick/.docker/run/docker.sock',
          'daemonSocketNine':C.nine(fs.value('/independent-header/manifest')),'daemonID':'independent-pure-mock',
          'imageEnv':['PATH=/usr/bin:/bin'],'senderProspectiveNineSha256':C.digest(data['/independent-header/sender'])}
        fs.put('/independent-header/release',C.encoded(release))
        rows=[{'name':n,'path':'/independent-header/'+n,'bytes':len(fs.data['/independent-header/'+n]),
               'sha256':C.digest(fs.data['/independent-header/'+n]),'PRE9':C.nine(fs.value('/independent-header/'+n))}
              for n in ('manifest','approval','release','sender')]
        if mode=='physical':rows[0]['PRE9']=dict(rows[0]['PRE9'],ino='999999')
        reason=deny(lambda:E.run_from_closed_headers(rows,C.Ledger(),str(own_dir/'forbidden-effect-directory'),C.digest(mfraw),C.digest(approvalraw),source_fs=fs),
          {'approval':'EXACT_FRESH_INDEPENDENT_ADAPTER_SOURCE_APPROVAL','physical':'ORIGINAL_SOURCE_NINE_CHANGED','release':'release.maxPaid'}[mode])
        eq(fs.fds,{});eq(len(fs.opens),len(fs.closes));eq(len(set(fs.closes)),len(fs.closes))
        eq((own_dir/'forbidden-effect-directory').exists(),False)
        if mode=='approval':eq(len(fs.opens),4)
        if mode=='physical':eq(len(fs.opens),0);eq(fs.reads,[])
        return {'denial':reason,'opens':len(fs.opens),'onceCloses':len(fs.closes),'effectDirectoryCreated':False}
    for mode in ('approval','physical','release'):
        case('exact-root-four-header-'+mode+'-denial-all-owned-close',lambda m=mode:root_header_denial(m))
    def fixture(name,cid,command,running,env):
        specs=[{'Type':'volume','Source':S.INPUT,'Target':'/source-epoch','ReadOnly':name==S.QUALIFIER,'VolumeOptions':{'NoCopy':True}},
               {'Type':'volume','Source':S.RESULT,'Target':'/qualification-result','ReadOnly':False,'VolumeOptions':{'NoCopy':True}}]
        return {'Id':cid,'Name':'/'+name,'Image':C.IMAGE,'Platform':'linux','Config':{'Cmd':command,'Entrypoint':['/usr/bin/python3'],'Env':env,'User':'0:0','Labels':S.LABELS,'WorkingDir':'/source-epoch'},
          'HostConfig':{'NetworkMode':'none','Memory':2147483648,'MemorySwap':2147483648,'PidsLimit':128,'ReadonlyRootfs':True,'Privileged':False,'AutoRemove':False,'CapDrop':['ALL'],'CapAdd':None,'SecurityOpt':['no-new-privileges'],'Init':False,'Mounts':specs,'Binds':None,'Devices':[],'DeviceRequests':None,'PidMode':'','IpcMode':'private'},
          'Mounts':[{'Type':'volume','Name':v,'Source':'/var/lib/docker/volumes/'+v+'/_data','Destination':p,'Driver':'local','RW':rw,'Propagation':''} for v,p,rw in ((S.INPUT,'/source-epoch',True),(S.RESULT,'/qualification-result',True))],
          'State':{'Running':running,'ExitCode':0,'Status':'running' if running else 'exited'}}
    def malformed_sender(mode,expect_pre_effect=False):
        sender={'scope':'NEW_ROOT_PROSPECTIVE_FIVE_SENDER_PINS_ONLY','oldCustodyRepaired':False,'members':[{'path':r['actualMacPath'],'bytes':r['bytes'],'sha256':r['sha256'],'PRE9':r['historicalMacNine']} for r in carry['members'] if not r['original130']]}
        if mode=='scope':sender['scope']='WRONG_SCOPE'
        elif mode=='custody':sender['oldCustodyRepaired']=True
        release={'daemonID':'independent-source-mock','imageEnv':['PATH=/usr/bin:/bin'],'senderProspectiveNineSha256':C.digest(C.encoded(sender))}
        if mode=='binding':release['senderProspectiveNineSha256']='0'*64
        mac=FS();ledger=C.Ledger()
        class Lease:
            def check(self):return None
        class Runner:
            def __init__(self):self.release=release;self.budget=C.CommandBudget();self.receipts=[];self.sticky=[];self.volumes=set();self.containers={};self.mutations=[]
            def command(self,label,args,timeout=30,stdin=None,reserve=0,required=True,cleanup=False):
                self.budget.admit(reserve,timeout,len(stdin or b''));self.receipts.append({'label':label,'number':self.budget.used,'cleanup':cleanup});raw=b''
                if args[0]=='info':raw=C.encoded({'ID':release['daemonID'],'OSType':'linux'})
                elif args[:2]==['image','inspect']:raw=C.encoded([{'Id':C.IMAGE,'Os':'linux','Architecture':'amd64','Config':{'Env':release['imageEnv']}}])
                elif args[0]=='ps':raw=('\n'.join(self.containers)+'\n').encode()
                elif args[:2]==['volume','ls']:raw=('\n'.join(self.volumes)+'\n').encode()
                elif args[:2]==['volume','create']:self.volumes.add(args[-1]);raw=(args[-1]+'\n').encode();self.mutations.append(label)
                elif args[:2]==['volume','inspect']:raw=C.encoded([{'Name':n,'Driver':'local','Labels':S.LABELS,'Mountpoint':'/var/lib/docker/volumes/'+n+'/_data','Options':None} for n in args[2:]])
                elif args[0]=='create':
                    name=args[args.index('--name')+1];cid='a'*64;self.containers[name]={'cid':cid,'command':args[args.index(C.IMAGE)+1:],'running':False};raw=(cid+'\n').encode();self.mutations.append(label)
                elif args[:2]==['container','inspect']:raw=C.encoded([fixture(n,env=release['imageEnv'],**self.containers[n]) for n in args[2:]])
                elif args[0]=='start':
                    for v in self.containers.values():v['running']=True
                    self.mutations.append(label)
                elif args[0] in ('exec','cp'):self.mutations.append(label)
                elif args[0]=='stop':
                    for v in self.containers.values():v['running']=False
                    self.mutations.append(label)
                elif args[0]=='rm':self.containers={};self.mutations.append(label)
                elif args[:2]==['volume','rm']:
                    for n in args[2:]:self.volumes.remove(n)
                    self.mutations.append(label)
                else:raise AssertionError(('independent undeclared mock boundary',args))
                return {'terminal':True,'failureClass':None,'closeErrors':[],'exitCode':0},raw,b''
        runner=Runner()
        class Services:
            def runner(self,*a):return runner
            def write_bridge(self,p,data,ledger):mac.put(p,data)
            def wait(self,lease):lease.check()
            def cohort(self,rows,ledger):return C.Cohort(rows,ledger,fs=mac,owner=(501,20))
        reason=deny(lambda:D.execute(release,Lease(),ledger,carry,wire,proof,{'C':raw('C'),'Q':raw('Q'),'B':raw('B'),'carry':raw('carry'),'wire':raw('wire')},'/independent-pure-mock',sender,source_services=Services()),'NEW_SENDER_PINS_CANNOT_REPAIR_OLD_CUSTODY' if mode in ('scope','custody') else 'EXACT_ROOT_PROSPECTIVE_SENDER_NINE_DATA')
        eq(mac.fds,{});eq(len(mac.closes),len(mac.opens));eq(len(set(mac.closes)),len(mac.closes));eq(runner.containers,{});eq(runner.volumes,set())
        detail={'denial':reason,'commands':runner.receipts,'mutatingMockDispatches':runner.mutations,'sourceCloses':len(mac.closes),'actualEffects':0}
        details['sender-observation-'+mode]=detail
        if expect_pre_effect:eq(runner.mutations,[])
        else:
            eq(runner.receipts[4]['label'],'source-volume-create-input');eq(len([r for r in runner.receipts if not r['cleanup']]),13)
        return detail
    for mode in ('scope','custody','binding'):
        case('independent-counterexample-sender-'+mode+'-records-late-denial',lambda m=mode:malformed_sender(m))
    def fixture_unknown():
        runner=types.SimpleNamespace(release={'imageEnv':['PATH=/usr/bin:/bin']});calls=[]
        runner.command=lambda label,args,**kwargs:(calls.append((label,args)) or ({},b'SUSPICIOUS\n',b''))
        closed=D.cleanup(runner,{'containers':{},'volumes':[],'uncertain':{'container':{S.WRITER},'volume':set()}},{},{})
        eq(any('rm' in x[1] or 'stop' in x[1] for x in calls),False)
        eq(len(calls),1);return {'calls':calls,'result':closed}
    case('unknown-owned-name-never-signaled-or-removed',fixture_unknown)
    def bool_index():
        changed=copy.deepcopy(wire);changed['members'][1]['index']=True
        # This observation checks an actual schema branch; it does not claim an effect.
        Q.validate_wire(changed);return {'booleanIndexAccepted':True,'effect':0}
    case('independent-wire-boolean-index-observation',bool_index)
    def inherited_large():
        ledger=C.Ledger()
        for i in range(280):
            pin={'dev':'1','ino':str(i+1),'mode':'33152','uid':'501','gid':'20','nlink':'1','size':'1','mtime_ns':'1','ctime_ns':'1'}
            ledger.admit('/large-table/'+('x'*1000)+str(i),pin,'0'*64,1,'SOURCE')
        exported=ledger.export();eq(len(C.encoded(exported['body']))>C.STDIN_BYTES,True)
        inherited=C.Ledger.inherit(exported['body'],exported['sha256']);eq(inherited.export()['sha256'],exported['sha256'])
        return {'bytes':len(C.encoded(exported['body'])),'rows':len(exported['body']['members']),'digest':exported['sha256']}
    case('full-ledger-file-larger-than-stdin-roundtrip-no-truncation',inherited_large)
    mrow=named['M'];mowner=next(x for x in held if x['path']==mrow['path'])
    M=module('M',{'SOURCE_ANCHOR':{'bootstrap':raw('A').decode(),'fd':mowner['fd'],'row':{'path':mrow['path'],'PRE9':mrow['PRE9'],'bytes':mrow['bytes'],'sha256':mrow['sha256']}}})
    process_dir=own_dir/'owned-processes1';process_dir.mkdir(mode=0o700,exist_ok=False)
    env={'PATH':'/usr/bin:/bin','HOME':str(Path.home()),'CORTEX_COORDINATOR_CWD':str(process_dir)}
    def process_case(label,code,timeout,expect):
        receipt,out,err=M.run(label,[sys.executable,'-B','-c',code],process_dir,timeout,env,required=False)
        eq(receipt['terminal'],True);eq(receipt['closeErrors'],[])
        if expect=='timeout':
            if receipt['failureClass'] is None:raise AssertionError('missing timeout failure')
        else:eq(receipt['exitCode'],expect);eq(receipt['failureClass'],None)
        if expect==0:eq(out,b'independent-held-source\n');eq(err,b'')
        return {'receipt':receipt,'stdoutBytes':len(out),'stderrBytes':len(err),'actualDockerEffects':0}
    case('owned-process-exact-held-anchor-positive',lambda:process_case('independent-positive',"print('independent-held-source')",5,0))
    case('owned-process-nonzero-terminal-and-all-close',lambda:process_case('independent-failure','raise SystemExit(19)',5,19))
    case('owned-process-timeout-terminal-and-all-close',lambda:process_case('independent-timeout','import time;time.sleep(5)',1,'timeout'))
    return {'scope':'BOUNDED_INDEPENDENT_CODE_BEHAVIOR_HOST_SOURCE_ONLY','conditions':results,'details':details,'passed':sum(x['status']=='PASS' for x in results),'failed':sum(x['status']=='FAIL' for x in results),'counterexamplePreEffectSenderContractFails':True,'sourceEligibility':False,'runtimeAuthority':False,'dockerRelease':False,'fullTask03':False,'fullGoal':False,'actualDockerEffects':0,'actualNetworkEffects':0,'actualPrivateReads':0}
