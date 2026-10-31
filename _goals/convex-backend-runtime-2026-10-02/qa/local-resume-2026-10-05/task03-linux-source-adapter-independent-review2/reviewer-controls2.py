"""Independent successor controls; only the reviewer owns this code.

Candidate modules are compiled from an externally qualified, still-held cohort.
Virtual files, image, resources, effects and clocks are SOURCE/MOCK only.
"""
import copy
import hashlib
import os
import stat
import sys
import types
from pathlib import Path


def run(held,bodies,spec,own_dir):
    named=spec['runtimeInputs'];own_dir=Path(own_dir)
    def raw(name):return bodies[named[name]['path']]
    def load(name,deps):
        m=types.ModuleType('independent_successor_'+name);m.__file__=named[name]['path'];m.__dict__.update(deps)
        exec(compile(raw(name),m.__file__,'exec',dont_inherit=True),m.__dict__);return m
    C=load('C',{});T=load('T',{'C':C});Q=load('Q',{'C':C});B=load('B',{});L=load('L',{'C':C})
    S=load('S',{'C':C,'T':T});D=load('D',{'C':C,'T':T,'S':S,'L':L,'M':None})
    carry=C.strict(raw('carry'));wire=C.strict(raw('wire'));proof=C.strict(raw('proof'))
    outcomes=[];details={}
    def equal(a,b):
        if type(a) is not type(b) or a!=b:raise AssertionError((type(a).__name__,a,type(b).__name__,b))
    def case(name,body):
        try:details[name]=body();outcomes.append({'name':name,'status':'PASS'})
        except BaseException as e:outcomes.append({'name':name,'status':'FAIL','type':type(e).__name__,'error':str(e)})
    class Clock:
        def __init__(self):self.ns=1_000_000_000_000
        def monotonic(self):return self.ns/1_000_000_000
        def age(self):self.ns+=60_000_000_000
    class Files:
        def __init__(self,clock,owner,data=None,first_fd=10000):
            self.clock=clock;self.owner=owner;self.data=dict(data or {});self.next_fd=first_fd
            self.inode={p:i+100 for i,p in enumerate(self.data)};self.stamps={p:1 for p in self.data}
            self.fd={};self.position={};self.opened=[];self.closed=[];self.reads=[]
        def value(self,p):
            p=str(p);return types.SimpleNamespace(st_dev=42,st_ino=self.inode[p],st_mode=stat.S_IFREG|0o600,st_uid=self.owner[0],st_gid=self.owner[1],st_nlink=1,st_size=len(self.data[p]),st_mtime_ns=self.stamps[p],st_ctime_ns=self.stamps[p])
        def validate_path(self,p):
            if type(p) is not str or not p.startswith('/'):raise ValueError('REVIEWER_ABSOLUTE_VIRTUAL_PATH')
        def lstat(self,p):return self.value(p)
        def fstat(self,fd):return self.value(self.fd[fd])
        def now_ns(self):return self.clock.ns
        def put(self,p,b):
            p=str(p);self.data[p]=b;self.inode[p]=1000+len(self.data);self.stamps[p]=self.clock.ns
        def open(self,p,flags=None):
            p=str(p)
            if p not in self.data:raise FileNotFoundError(p)
            self.next_fd+=1;fd=self.next_fd;self.fd[fd]=p;self.position[fd]=0;self.opened.append(fd);return fd
        def register(self,entry,fd):entry['fd']=fd
        def read(self,fd,n):
            p=self.fd[fd];self.reads.append(p);offset=self.position[fd];b=self.data[p][offset:offset+n];self.position[fd]+=len(b);return b
        def close(self,fd):
            if fd not in self.fd:raise AssertionError('FOREIGN_OR_SECOND_VIRTUAL_CLOSE')
            self.closed.append(fd);del self.fd[fd]
        def exists(self,p):return str(p) in self.data
        def open_write(self,p,flags):
            p=str(p)
            if flags&os.O_EXCL and p in self.data:raise FileExistsError(p)
            if p not in self.data:self.put(p,b'')
            return self.open(p)
        def seek(self,fd,offset):self.position[fd]=offset
        def write(self,fd,view):
            p=self.fd[fd];offset=self.position[fd];b=bytes(view)
            self.data[p]=self.data[p][:offset]+b+self.data[p][offset+len(b):];self.position[fd]+=len(b);self.stamps[p]=self.clock.ns;return len(b)
        def sync(self,fd):self.stamps[self.fd[fd]]=self.clock.ns
        def replace(self,source,dest):
            source=str(source);dest=str(dest);self.data[dest]=self.data.pop(source);self.inode[dest]=self.inode.pop(source);self.stamps[dest]=self.stamps.pop(source)
        def write_stop(self,p,b,ledger):
            ledger.can_open();fd=self.open_write(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW);primary=None
            try:ledger.own(fd,str(p));self.write(fd,b);self.sync(fd)
            except BaseException as e:primary=e
            finally:
                if fd in ledger.live:ledger.detach(fd)
                self.close(fd)
            if primary is not None:raise primary
    class Lease:
        def __init__(self):self.checks=0
        def check(self):self.checks+=1
    def sender_for(recipe):
        return {'scope':'NEW_ROOT_PROSPECTIVE_FIVE_SENDER_PINS_ONLY','oldCustodyRepaired':False,
            'members':[{'path':r['actualMacPath'],'bytes':r['bytes'],'sha256':r['sha256'],'PRE9':copy.deepcopy(r['historicalMacNine'])} for r in recipe['members'] if not r['original130']]}
    def boundary(mode):
        sender=sender_for(carry);release={'senderProspectiveNineSha256':None}
        member=sender['members'][0]
        if mode=='scope':sender['scope']='WRONG_SCOPE'
        elif mode=='custody-true':sender['oldCustodyRepaired']=True
        elif mode=='custody-integer':sender['oldCustodyRepaired']=0
        elif mode=='member-count':sender['members'].pop()
        elif mode=='duplicate':sender['members'][1]=copy.deepcopy(member)
        elif mode=='member-extra':member['unexpected']='value'
        elif mode=='historical-path':member['path']=next(r['actualMacPath'] for r in carry['members'] if r['original130'])
        elif mode=='bytes-boolean':member['bytes']=True
        elif mode=='hash-different':member['sha256']='0'*64
        elif mode=='hash-uppercase':member['sha256']=member['sha256'].upper()
        elif mode=='nine-owner':member['PRE9']['uid']='0'
        elif mode=='nine-link':member['PRE9']['nlink']='2'
        elif mode=='nine-size':member['PRE9']['size']=str(int(member['PRE9']['size'])+1)
        elif mode=='nine-fifo':member['PRE9']['mode']=str(stat.S_IFIFO|0o600)
        elif mode=='nine-integer':member['PRE9']['ino']=1
        release['senderProspectiveNineSha256']=C.digest(C.encoded(sender))
        if mode=='binding':release['senderProspectiveNineSha256']='0'*64
        called=[]
        class NoEffects:
            def runner(self,*a):called.append('runner');raise AssertionError('INVALID_SENDER_REACHED_EFFECT_INTERFACE')
        error=None
        try:D.execute(release,Lease(),C.Ledger(),carry,wire,proof,{'C':raw('C'),'Q':raw('Q'),'B':raw('B'),'carry':raw('carry'),'wire':raw('wire')},'/independent-review2-pure-virtual',sender,source_services=NoEffects())
        except BaseException as e:error=e
        if error is None:raise AssertionError('INVALID_SENDER_ACCEPTED')
        equal(called,[])
        if isinstance(error,AssertionError):raise error
        return {'denial':type(error).__name__+': '+str(error),'effectInterfaceCalls':called,'fixtureMutations':0}
    for mode in ('scope','custody-true','custody-integer','binding','member-count','duplicate','member-extra','historical-path','bytes-boolean','hash-different','hash-uppercase','nine-owner','nine-link','nine-size','nine-fifo','nine-integer'):
        case('sender-'+mode+'-denied-before-any-effect-interface',lambda m=mode:boundary(m))
    def strict_index(value):
        changed=copy.deepcopy(wire);changed['members'][1]['index']=value
        try:Q.validate_wire(changed)
        except BaseException as e:
            if isinstance(e,(ValueError,TypeError)):return {'denial':str(e),'mutations':0}
            raise
        raise AssertionError('NON_INTEGER_WIRE_INDEX_ACCEPTED')
    for value in (True,1.0,'1',None):case('wire-index-'+repr(value)+'-strict-denial',lambda v=value:strict_index(v))
    def original_proof():
        actual=L.original113(carry,C.strict(bodies[proof['receiptSource']['path']]),C.strict(bodies[proof['planSource']['path']]))
        for k,v in actual.items():equal(proof[k],v)
        equal(len(actual['indices']),113);equal(actual['original113PhysicalIntervalAdopted'],False)
        return actual
    case('unchanged-original113-proof-actual-validator-body',original_proof)
    def container_info(name,cid,cmd,running,env):
        input_ro=name==S.QUALIFIER
        return {'Id':cid,'Name':'/'+name,'Image':C.IMAGE,'Platform':'linux',
          'Config':{'Cmd':cmd,'Entrypoint':['/usr/bin/python3'],'Env':env,'User':'0:0','Labels':S.LABELS,'WorkingDir':'/source-epoch'},
          'HostConfig':{'NetworkMode':'none','Memory':2147483648,'MemorySwap':2147483648,'PidsLimit':128,'ReadonlyRootfs':True,'Privileged':False,'AutoRemove':False,'CapDrop':['ALL'],'CapAdd':None,'SecurityOpt':['no-new-privileges'],'Init':False,
            'Mounts':[{'Type':'volume','Source':S.INPUT,'Target':'/source-epoch','ReadOnly':input_ro,'VolumeOptions':{'NoCopy':True}},
                      {'Type':'volume','Source':S.RESULT,'Target':'/qualification-result','ReadOnly':False,'VolumeOptions':{'NoCopy':True}}],
            'Binds':None,'Devices':[],'DeviceRequests':None,'PidMode':'','IpcMode':'private'},
          'Mounts':[{'Type':'volume','Name':v,'Source':'/var/lib/docker/volumes/'+v+'/_data','Destination':p,'Driver':'local','RW':rw,'Propagation':''}
             for v,p,rw in ((S.INPUT,'/source-epoch',not input_ro),(S.RESULT,'/qualification-result',True))],
          'State':{'Running':running,'ExitCode':0,'Status':'running' if running else 'exited'}}
    def full_driver(late_running=False,fail_label=None):
        clock=Clock();recipe=copy.deepcopy(carry);newwire=copy.deepcopy(wire);newproof=copy.deepcopy(proof)
        payload={r['actualMacPath']:bytes([(r['index']*13+7)%251])*r['bytes'] for r in recipe['members']}
        mac=Files(clock,(501,20),payload,10000);linux=Files(clock,(0,0),None,20000);ledger=C.Ledger();lease=Lease()
        for row in recipe['members']:
            row['sha256']=C.digest(payload[row['actualMacPath']]);row['historicalMacNine']=C.nine(mac.value(row['actualMacPath']))
            newwire['members'][row['index']]['sha256']=row['sha256']
            if row['original130']:ledger.admit(row['actualMacPath'],row['historicalMacNine'],row['sha256'],row['bytes'],'SOURCE')
        carry_raw=C.encoded(recipe);newwire['macCarrySha256']=C.digest(carry_raw);newproof['carrySha256']=C.digest(carry_raw)
        sender=sender_for(recipe);release={'daemonID':'independent-source2-daemon','imageEnv':['PATH=/usr/bin:/bin'],'senderProspectiveNineSha256':C.digest(C.encoded(sender))}
        class VirtualRunner:
            def __init__(self):
                self.release=release;self.budget=C.CommandBudget();self.receipts=[];self.sticky=[];self.volumes=set();self.containers={};self.mutations=[];self.bootstrap_results=[]
            def command(self,label,args,timeout=30,stdin=None,reserve=0,required=True,cleanup=False):
                if self.sticky and not cleanup:raise AssertionError('POST_FAILURE_NON_CLEANUP_DISPATCH')
                self.budget.admit(reserve,timeout,len(stdin or b''));self.receipts.append({'label':label,'number':self.budget.used,'reserve':reserve,'cleanup':cleanup,'stdinBytes':len(stdin or b'')})
                if label==fail_label:self.sticky.append(label);raise OSError('INDEPENDENT_PHASE_FAILURE '+label)
                out=b'';code=0
                if args[0]=='info':out=C.encoded({'ID':release['daemonID'],'OSType':'linux'})
                elif args[:2]==['image','inspect']:out=C.encoded([{'Id':C.IMAGE,'Os':'linux','Architecture':'amd64','Config':{'Env':release['imageEnv']}}])
                elif args[0]=='ps':out=('\n'.join(sorted(self.containers))+'\n').encode()
                elif args[:2]==['volume','ls']:out=('\n'.join(sorted(self.volumes))+'\n').encode()
                elif args[:2]==['volume','create']:self.volumes.add(args[-1]);out=(args[-1]+'\n').encode();self.mutations.append(label)
                elif args[:2]==['volume','inspect']:out=C.encoded([{'Name':n,'Driver':'local','Labels':S.LABELS,'Mountpoint':'/var/lib/docker/volumes/'+n+'/_data','Options':None} for n in args[2:]])
                elif args[0]=='create':
                    name=args[args.index('--name')+1];cid=('a' if name==S.WRITER else 'b')*64
                    self.containers[name]={'cid':cid,'cmd':args[args.index(C.IMAGE)+1:],'running':False};out=(cid+'\n').encode();self.mutations.append(label)
                elif args[:2]==['container','inspect']:
                    out=C.encoded([container_info(n,env=release['imageEnv'],**self.containers[n]) for n in args[2:]])
                elif args[0]=='cp':linux.put('/source-epoch/base-ledger.json',mac.data[args[1]]);self.mutations.append(label)
                elif args[0]=='start':
                    cid=args[-1];name=next(n for n,v in self.containers.items() if v['cid']==cid);self.containers[name]['running']=True;self.mutations.append(label)
                    if '-a' in args:
                        command=self.containers[name]['cmd'];out,code=self.bootstrap(C.strict(command[-2]),command[-1],stdin);self.containers[name]['running']=False
                elif args[0]=='exec':
                    self.mutations.append(label)
                    if label=='source-seed':
                        for n,row in C.strict(stdin)['files'].items():linux.put('/source-epoch/'+n,bytes.fromhex(row['hex']))
                    else:out,code=self.bootstrap(C.strict(args[-2]),args[-1],stdin)
                elif args[0]=='stop':
                    ids=args[3:]
                    equal(set(ids).issubset({v['cid'] for v in self.containers.values()}),True)
                    for v in self.containers.values():
                        if v['cid'] in ids:v['running']=False
                    self.mutations.append(label)
                elif args[0]=='rm':
                    equal(set(args[1:]).issubset({v['cid'] for v in self.containers.values()}),True)
                    self.containers={n:v for n,v in self.containers.items() if v['cid'] not in args[1:]};self.mutations.append(label)
                elif args[:2]==['volume','rm']:
                    equal(set(args[2:]).issubset(self.volumes),True)
                    for n in args[2:]:self.volumes.remove(n)
                    self.mutations.append(label)
                else:raise AssertionError(('UNDECLARED_VIRTUAL_COMMAND',label,args))
                if late_running and label=='source-qualifier-terminal':
                    for v in self.containers.values():v['running']=True
                if len(out)>262144:raise AssertionError('ORIGINAL_RESULT_PIPE_CAP')
                return {'terminal':True,'failureClass':None,'closeErrors':[],'exitCode':code},out,b''
            def bootstrap(self,contract,action,stdin):
                try:result=B.execute(contract,action,stdin,fs=linux,now=linux.now_ns,qualification_fs=linux,clock=clock,write_io=linux,qualification_kernel='linux');code=0
                except B.BootstrapFailure as e:result=e.envelope;code=23
                self.bootstrap_results.append({'action':action,'exit':code,'sourceEligible':result.get('sourceEligibility'),'bootstrapOnceCloses':result.get('bootstrapCloseOnce')})
                return C.encoded(result),code
        runner=VirtualRunner()
        class Services:
            def runner(self,*a):return runner
            def write_bridge(self,p,b,current):equal(current is ledger,True);mac.put(p,b)
            def wait(self,current):equal(current is lease,True);clock.age();current.check()
            def cohort(self,rows,current):equal(current is ledger,True);return C.Cohort(rows,current,fs=mac,owner=(501,20))
        result=None;error=None
        try:result=D.execute(release,lease,ledger,recipe,newwire,newproof,{'C':raw('C'),'Q':raw('Q'),'B':raw('B'),'carry':carry_raw,'wire':C.encoded(newwire)},'/independent-review2-pure-virtual',sender,source_services=Services())
        except BaseException as e:error=e
        equal(mac.fd,{});equal(linux.fd,{})
        equal(len(mac.opened),len(mac.closed));equal(len(linux.opened),len(linux.closed))
        equal(len(set(mac.closed)),len(mac.closed));equal(len(set(linux.closed)),len(linux.closed))
        if runner.budget.used>48:raise AssertionError('WHOLE_FIXTURE_COMMAND_CEILING')
        summary={'error':None if error is None else type(error).__name__+': '+str(error),'commandCount':runner.budget.used,'commands':runner.receipts,
          'remainingContainers':sorted(runner.containers),'remainingVolumes':sorted(runner.volumes),'mutations':runner.mutations,'bootstrapResults':runner.bootstrap_results,
          'macOpenCloseCounts':[len(mac.opened),len(mac.closed)],'linuxOpenCloseCounts':[len(linux.opened),len(linux.closed)],'ledger':ledger.snapshot(),'actualDockerEffects':0,'actualLinuxFixture':False}
        if fail_label is not None:
            if error is None:raise AssertionError('INJECTED_FAILURE_LOST')
            if fail_label=='source-batch-4':equal(runner.containers,{});equal(runner.volumes,set())
        else:
            if error is not None:raise error
            equal(runner.budget.used,48 if late_running else 46);equal(runner.containers,{});equal(runner.volumes,set());equal(result['cleanup']['ownedAbsent'],True)
            equal(len(runner.bootstrap_results),11);equal([x['action'] for x in runner.bootstrap_results],['write']*9+['stop','qualify'])
            equal(all(x['exit']==0 for x in runner.bootstrap_results),True)
            equal(len(result['linux']['physicalSourceCohort']['members']),136);equal(result['lineage']['members'],135)
            equal(result['lineage']['original130'],130);equal(result['lineage']['original113'],113);equal(result['lineage']['sourceEligibility'],False)
        return summary
    case('complete-real-driver-bootstrap-qualifier-mock-path46-all-owned-cleanup',full_driver)
    case('complete-late-owned-running-cleanup48-all-resources-absent',lambda:full_driver(late_running=True))
    case('middle-batch-failure-sticky-and-all-source-close-owned-cleanup',lambda:full_driver(fail_label='source-batch-4'))
    case('cleanup-remove-failure-sticky-and-all-source-close',lambda:full_driver(fail_label='cleanup-remove-exact-containers'))
    case('late-cleanup-stop-failure-sticky-and-all-source-close',lambda:full_driver(late_running=True,fail_label='cleanup-owned-stop'))
    return {'scope':'INDEPENDENT_SUCCESSOR_SOURCE_MOCK_ONLY','conditions':outcomes,'details':details,
      'passed':sum(x['status']=='PASS' for x in outcomes),'failed':sum(x['status']=='FAIL' for x in outcomes),
      'sourceEligibility':False,'runtimeAuthority':False,'actualDockerEffects':0,'actualNetworkEffects':0,'actualPrivateReads':0,'actualLinuxFixture':False,'fullTask03':False,'fullGoal':False}
