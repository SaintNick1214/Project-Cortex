"""Actual driver/qualification bodies with reviewed virtual effect interfaces.

Every source acquisition still calls the actual Cohort and bootstrap bodies.
The virtual clock ages every new source; no Docker command or target exists.
"""
import copy
import json
import types


def run(C,T,Q,B,S,D,L,FS,carry,wire,proof,sources):
    outcomes=[];traces=[]
    def equal(a,b):
        if a!=b:raise AssertionError((a,b))
    def case(name,body):
        try:body();outcomes.append({'name':name,'status':'PASS'})
        except BaseException as error:outcomes.append({'name':name,'status':'FAIL','error':repr(error)})
    class Clock:
        def __init__(self):self.ns=240000000001
        def monotonic(self):return self.ns/1000000000
        def age(self):self.ns+=60000000000
    class SourceFS(FS):
        def __init__(self,bodies,clock,owner):
            super().__init__(bodies,owner);self.clock=clock;self.stamps={p:1 for p in bodies}
        def value(self,path):
            value=super().value(path);value.st_mtime_ns=self.stamps.get(path,1);value.st_ctime_ns=value.st_mtime_ns;return value
        def now_ns(self):return self.clock.ns
        def put(self,path,raw):
            path=str(path);self.data[path]=raw;self.inodes[path]=9000+len(self.data);self.stamps[path]=self.clock.ns
        def sync(self,fd):
            super().sync(fd);self.stamps[self.fd[fd]]=self.clock.ns
        def replace(self,source,destination):
            source=str(source);destination=str(destination);stamp=self.stamps[source]
            super().replace(source,destination);self.stamps[destination]=stamp
        def write_stop(self,path,raw,ledger):
            path=str(path);ledger.can_open();fd=self.open_write(path,193)
            ledger.own(fd,path);primary=None
            try:self.write(fd,raw);self.sync(fd)
            except BaseException as error:primary=error
            ledger.detach(fd);self.close(fd)
            if primary:raise primary
    class Lease:
        def check(self):return None
    def fixture(name,cid,cmd,running,env):
        mounts=[{'Type':'volume','Source':S.INPUT,'Target':'/source-epoch','ReadOnly':name==S.QUALIFIER,'VolumeOptions':{'NoCopy':True}},
                {'Type':'volume','Source':S.RESULT,'Target':'/qualification-result','ReadOnly':False,'VolumeOptions':{'NoCopy':True}}]
        return {'Id':cid,'Name':'/'+name,'Image':C.IMAGE,'Platform':'linux',
            'Config':{'Cmd':cmd,'Entrypoint':['/usr/bin/python3'],'Env':env,'User':'0:0','Labels':S.LABELS,'WorkingDir':'/source-epoch'},
            'HostConfig':{'NetworkMode':'none','Memory':2147483648,'MemorySwap':2147483648,'PidsLimit':128,'ReadonlyRootfs':True,'Privileged':False,'AutoRemove':False,
                'CapDrop':['ALL'],'CapAdd':None,'SecurityOpt':['no-new-privileges'],'Init':False,'Mounts':mounts,'Binds':None,'Devices':[],'DeviceRequests':None,'PidMode':'','IpcMode':'private'},
            'Mounts':[{'Type':'volume','Name':v,'Source':'/var/lib/docker/volumes/'+v+'/_data','Destination':p,'Driver':'local','RW':rw,'Propagation':''}
                for v,p,rw in ((S.INPUT,'/source-epoch',name!=S.QUALIFIER),(S.RESULT,'/qualification-result',True))],
            'State':{'Running':running,'ExitCode':0,'Status':'running' if running else 'exited'}}
    def actual_driver(fail_command=None,corrupt_label=None,lineage_fault=False,restart_at_terminal=False):
        clock=Clock();fakecarry=copy.deepcopy(carry);fakewire=copy.deepcopy(wire)
        bodies={r['actualMacPath']:bytes([r['index']%251])*r['bytes'] for r in fakecarry['members']}
        mac=SourceFS(bodies,clock,(501,20));linux=SourceFS({},clock,(0,0));ledger=C.Ledger()
        for row in fakecarry['members']:
            row['sha256']=C.digest(bodies[row['actualMacPath']]);row['historicalMacNine']=C.nine(mac.value(row['actualMacPath']))
            fakewire['members'][row['index']]['sha256']=row['sha256']
        fakewire['macCarrySha256']=C.digest(C.encoded(fakecarry))
        # Model the actual Root source graph retaining130 current physical
        # charges before this phase; the five prospective sender rows are
        # acquired by the real driver and added to its ordered amendments.
        for row in fakecarry['members']:
            if row['original130']:ledger.admit(row['actualMacPath'],row['historicalMacNine'],row['sha256'],row['bytes'],'SOURCE')
        fakeproof=copy.deepcopy(proof);fakeproof['carrySha256']=fakewire['macCarrySha256']
        sender={'scope':'NEW_ROOT_PROSPECTIVE_FIVE_SENDER_PINS_ONLY','oldCustodyRepaired':False,
            'members':[{'path':r['actualMacPath'],'bytes':r['bytes'],'sha256':r['sha256'],'PRE9':r['historicalMacNine']} for r in fakecarry['members'] if not r['original130']]}
        release={'daemonID':'pure-fixture-daemon','imageEnv':['PATH=/usr/bin:/bin'],'senderProspectiveNineSha256':C.digest(C.encoded(sender))}
        class VirtualRunner:
            def __init__(self):
                self.release=release;self.budget=C.CommandBudget();self.receipts=[];self.sticky=[];self.containers={};self.volumes=set()
            def command(self,label,args,timeout=30,stdin=None,reserve=0,required=True,cleanup=False):
                if self.sticky and not cleanup:raise ValueError('STICKY_VIRTUAL_DRIVER')
                self.budget.admit(reserve,timeout,len(stdin or b''));self.receipts.append({'label':label,'command':self.budget.used,'reserve':reserve,'cleanup':cleanup})
                if self.budget.used==fail_command:
                    self.sticky.append('INJECTED_COMMAND_FAILURE');raise OSError('INJECTED_COMMAND_FAILURE')
                raw=b'';code=0
                if args[0]=='info':raw=C.encoded({'ID':release['daemonID'],'OSType':'linux'})
                elif args[:2]==['image','inspect']:raw=C.encoded([{'Id':C.IMAGE,'Os':'linux','Architecture':'amd64','Config':{'Env':release['imageEnv']}}])
                elif args[0]=='ps':raw=('\n'.join(self.containers)+'\n').encode()
                elif args[:2]==['volume','ls']:raw=('\n'.join(self.volumes)+'\n').encode()
                elif args[:2]==['volume','create']:
                    self.volumes.add(args[-1]);raw=(args[-1]+'\n').encode()
                elif args[:2]==['volume','inspect']:
                    raw=C.encoded([{'Name':n,'Driver':'local','Labels':S.LABELS,'Mountpoint':'/var/lib/docker/volumes/'+n+'/_data','Options':None} for n in args[2:]])
                elif args[0]=='create':
                    name=args[args.index('--name')+1];cid=('a' if name==S.WRITER else 'b')*64
                    self.containers[name]={'cid':cid,'cmd':args[args.index(C.IMAGE)+1:],'running':False};raw=(cid+'\n').encode()
                elif args[:2]==['container','inspect']:
                    raw=C.encoded([fixture(n,**self.containers[n],env=release['imageEnv']) for n in args[2:]])
                elif args[0]=='cp':linux.put('/source-epoch/base-ledger.json',mac.data[args[1]])
                elif args[0]=='start':
                    cid=args[-1];name=next(n for n,v in self.containers.items() if v['cid']==cid);self.containers[name]['running']=True
                    if '-a' in args:
                        cmd=self.containers[name]['cmd'];contract=C.strict(cmd[-2]);action=cmd[-1]
                        try:result=B.execute(contract,action,stdin,fs=linux,now=linux.now_ns,qualification_fs=linux,clock=clock,write_io=linux,qualification_kernel='linux')
                        except B.BootstrapFailure as error:result=error.envelope;code=23
                        raw=C.encoded(result);self.containers[name]['running']=False
                elif args[0]=='exec':
                    if label=='source-seed':
                        for n,r in C.strict(stdin)['files'].items():linux.put('/source-epoch/'+n,bytes.fromhex(r['hex']))
                    else:
                        try:result=B.execute(C.strict(args[-2]),args[-1],stdin,fs=linux,now=linux.now_ns,qualification_fs=linux,clock=clock,write_io=linux,qualification_kernel='linux')
                        except B.BootstrapFailure as error:result=error.envelope;code=23
                        raw=C.encoded(result)
                elif args[0]=='stop':
                    for cid in args[3:]:
                        for v in self.containers.values():
                            if v['cid']==cid:v['running']=False
                elif args[0]=='rm':
                    self.containers={n:v for n,v in self.containers.items() if v['cid'] not in args[1:]}
                elif args[:2]==['volume','rm']:
                    for n in args[2:]:self.volumes.remove(n)
                else:raise AssertionError(('UNDECLARED_DRIVER_COMMAND',label,args))
                if corrupt_label==label:raw=b'{"invalid":true}'
                if restart_at_terminal and label=='source-qualifier-terminal':
                    for value in self.containers.values():value['running']=True
                if len(raw)>262144:raise AssertionError('ACTUAL_PIPE_BOUND')
                row={'terminal':True,'failureClass':None,'closeErrors':[],'exitCode':code}
                return row,raw,b''
        runner=VirtualRunner()
        class Services:
            def runner(self,*args):return runner
            def write_bridge(self,path,raw,current):mac.put(path,raw)
            def wait(self,lease):clock.age();lease.check()
            def cohort(self,rows,current):return C.Cohort(rows,current,fs=mac,owner=(501,20))
        # The validator body is unchanged; a data fault reaches its actual
        # final-lineage denial after all40 normal pre-cleanup commands.
        if lineage_fault:fakeproof['indices'].append(fakeproof['indices'][0])
        result=None;error=None
        try:result=D.execute(release,Lease(),ledger,fakecarry,fakewire,fakeproof,{'C':sources['C'],'Q':sources['Q'],'B':sources['B'],'carry':C.encoded(fakecarry),'wire':C.encoded(fakewire)},'/pure-driver',sender,source_services=Services())
        except BaseException as value:error=value
        equal(len(mac.closed),len(mac.opened));equal(mac.fd,{})
        equal(len(linux.closed),len(linux.opened));equal(linux.fd,{})
        if runner.budget.used>48:raise AssertionError('REACHABLE_PREFIX_EXCEEDS48')
        trace={'faultCommand':fail_command,'corruptLabel':corrupt_label,'lineageFault':lineage_fault,'restartAtTerminal':restart_at_terminal,'commandCount':runner.budget.used,
            'commands':runner.receipts,'remainingContainers':sorted(runner.containers),'remainingVolumes':sorted(runner.volumes),'stickyFailure':error is not None,
            'macOnceCloses':len(mac.closed),'linuxOnceCloses':len(linux.closed),'ledger':ledger.snapshot()}
        traces.append(trace)
        if fail_command or corrupt_label or lineage_fault:
            if error is None:raise AssertionError('FAULT_LOST_PRIMARY_OR_UNKNOWN')
        else:
            if error:raise error
            equal(result['commandCount'],48 if restart_at_terminal else 46);equal(result['cleanup']['ownedAbsent'],True)
        return trace
    case('actual-driver-complete46-and-all-source-bodies',actual_driver)
    case('actual-driver-late-owned-running-cleanup-exact48',lambda:actual_driver(restart_at_terminal=True))
    for position in range(1,47):case('actual-driver-command-boundary-'+str(position),lambda p=position:actual_driver(fail_command=p))
    for label in ('source-daemon-info','source-image-inspect','source-volume-mappings','source-writer-prestart','source-writer-poststart',
        'source-batch-0','source-batch-4','source-batch-8','source-write-genuine-stop','source-writer-terminal','source-qualifier-prestart','source-qualifier-start-attached','source-qualifier-terminal'):
        case('actual-driver-collection-parse-'+label,lambda n=label:actual_driver(corrupt_label=n))
    case('actual-driver-final-lineage-failure',lambda:actual_driver(lineage_fault=True))
    return {'scope':'ACTUAL_DRIVER_BODY_SOURCE_MOCK_TOPOLOGY_ONLY','conditions':outcomes,'traces':traces,
        'passed':sum(r['status']=='PASS' for r in outcomes),'failed':sum(r['status']=='FAIL' for r in outcomes),
        'maxReachableCommandCount':max(t['commandCount'] for t in traces),'normalCommandCount':46,
        'DockerEffects':0,'serviceEffects':0,'sourceEligibility':False,'fullTask03':False}
