"""Root-only Source fixture execution; exact independent release is required.

M,C,T,S,B,L are explicit verified held-source dependencies. No module imports,
cache fallback or dynamic replacement of an older module is used.
"""
import os
import re
import stat
import time
from pathlib import Path

WAIT_WRITER = ['-B','-c','import time; time.sleep(18000)']
SEED = """import hashlib,json,os,sys
raw=sys.stdin.buffer.read(327693)
if len(raw)>327692: raise ValueError('SEED_STDIN_CAP')
v=json.loads(raw)
if set(v)!= {'operation','files'} or v['operation']!='9cef9576-a3c1-4818-b847-ccd59a12a7fc': raise ValueError('SEED_EXACT_SCOPE')
if set(v['files'])!={'source_contract.py','linux_source_qualifier.py','wire-manifest.json'}: raise ValueError('SEED_EXACT_THREE')
os.mkdir('/source-epoch/inputs',0o700)
for name,row in v['files'].items():
 data=bytes.fromhex(row['hex'])
 if len(data)!=row['bytes'] or hashlib.sha256(data).hexdigest()!=row['sha256']: raise ValueError('SEED_FULL_BYTES_HASH')
 fd=os.open('/source-epoch/'+name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 primary=None
 try:
  view=memoryview(data)
  while view:
   n=os.write(fd,view)
   if n<=0: raise OSError('SEED_SHORT_WRITE')
   view=view[n:]
  os.fsync(fd)
 except BaseException as error: primary=error
 try: os.close(fd)
 except BaseException as error: raise RuntimeError(repr([primary,error])) from primary
 if primary: raise primary
print('SOURCE_SEED_WRITTEN_NO_QUALIFICATION')
"""


def admit_release(release, lease):
    expected = {'scope','operation','sourceManifestSha256','sourceApprovalSha256','verdict',
        'fixtureEffectsAuthorized','maxPaid','targetEffectsAllowed','privateInputsAllowed',
        'macSourceGatesReplaced','dockerPath','dockerEndpoint','daemonSocketNine','daemonID','imageID','imageEnv','senderProspectiveNineSha256'}
    if type(release) is not dict or set(release) != expected:
        raise ValueError('EXACT_ROOT_SOURCE_FIXTURE_RELEASE')
    checks = {'scope':'ROOT_EXPLICIT_U4_LINUX_SOURCE_FIXTURE_RELEASE_ONLY', 'operation':C.OPERATION,
        'sourceManifestSha256':lease.manifest_sha256,'sourceApprovalSha256':lease.approval_sha256,
        'verdict':'PASS','fixtureEffectsAuthorized':True,'maxPaid':0,'targetEffectsAllowed':False,
        'privateInputsAllowed':False,'macSourceGatesReplaced':False,'imageID':C.IMAGE}
    for key, value in checks.items(): T.exact(release[key],value,'release.'+key)
    if release['dockerPath'] != '/Applications/Docker.app/Contents/Resources/bin/docker' or release['dockerEndpoint'] != 'unix:///Users/SaintNick/.docker/run/docker.sock':
        raise ValueError('EXACT_PREDECLARED_LOCAL_DOCKER_CLI_ENDPOINT')
    C.valid_nine(release['daemonSocketNine'])
    if type(release['daemonID']) is not str or not release['daemonID']:
        raise ValueError('ROOT_ACTUAL_DAEMON_ID_REQUIRED')
    env = release['imageEnv']
    if type(env) is not list or not env or len(set(env)) != len(env):
        raise ValueError('EXACT_IMAGE_ENVIRONMENT')
    allowed = {'PATH','NODE_VERSION','YARN_VERSION','PYTHON_VERSION','PYTHON_SHA256','LANG','LC_ALL','NPM_VERSION','NODE_PATH','NPM_CONFIG_CACHE','NPM_CONFIG_PREFIX','DEBIAN_FRONTEND'}
    for entry in env:
        if type(entry) is not str or '=' not in entry or entry.split('=',1)[0] not in allowed:
            raise ValueError('NO_IMAGE_CREDENTIAL_ENVIRONMENT')
    lease.check()
    return release


class Runner:
    """Only reviewed Common; source lease stays held across all commands."""
    def __init__(self, release, lease, ledger, directory):
        self.release = admit_release(release,lease); self.lease=lease; self.ledger=ledger
        self.directory=Path(directory); self.budget=C.CommandBudget(); self.receipts=[]
        self.directory.mkdir(mode=0o700,exist_ok=False)
        self.env={'PATH':'/usr/bin:/bin','HOME':str(Path.home()),'CORTEX_COORDINATOR_CWD':str(self.directory)}
        self.sticky=[]

    def command(self,label,args,timeout=30,stdin=None,reserve=0,required=True,cleanup=False):
        if self.sticky and not cleanup:
            raise ValueError('STICKY_SOURCE_FAILURE_PREVENTS_DISPATCH')
        self.lease.check()
        socket_path=self.release['dockerEndpoint'][7:]
        socket_pin=C.nine(os.lstat(socket_path))
        if socket_pin!=self.release['daemonSocketNine'] or not stat.S_ISSOCK(int(socket_pin['mode'])) or socket_pin['uid']!='501':
            raise ValueError('CURRENT_EXACT_LOCAL_DAEMON_SOCKET_IDENTITY')
        self.budget.admit(reserve,timeout,0 if stdin is None else len(stdin))
        current_live=self.ledger.snapshot()['liveOwnedSourceFDs']
        if current_live+1 > C.MAX_FILES:raise ValueError('BORROWED_CHILD_SOURCE_DESCRIPTOR_CEILING')
        self.ledger.peak=max(self.ledger.peak,current_live+1)
        argv=[self.release['dockerPath'],'--host',self.release['dockerEndpoint']]+args
        try:
            row,out,err=M.run(label,argv,self.directory,timeout,self.env,input_bytes=stdin,required=False)
            self.receipts.append(row)
            self.lease.check()
            if not row['terminal'] or row['failureClass'] is not None or row['closeErrors']:
                raise ValueError('ORIGINAL_COMMON_TERMINAL_FAILURE_UNKNOWN')
            if required and (row['exitCode'] != 0 or err):
                raise ValueError('SOURCE_COMMAND_EXIT_OR_STDERR')
            return row,out,err
        except BaseException as error:
            self.sticky.append(repr(error)); raise


def inspect_objects(runner,label,kind,names,reserve=0,cleanup=False):
    _,raw,_=runner.command(label,[kind,'inspect']+names,reserve=reserve,cleanup=cleanup)
    value=C.strict(raw)
    if type(value) is not list or len(value)!=len(names): raise ValueError('EXACT_INSPECT_OBJECT_COUNT')
    return value


def absence(runner,label,kind,names,reserve=0,cleanup=False):
    # Enumeration proves absence without interpreting an ambiguous failed
    # inspect as absence. No unknown or foreign resource is ever removed.
    fmt='{{.Names}}' if kind=='container' else '{{.Name}}'
    args=['ps','-a','--format',fmt] if kind=='container' else ['volume','ls','--format',fmt]
    _,out,_=runner.command(label,args,reserve=reserve,cleanup=cleanup)
    found=out.decode('utf-8').splitlines()
    if any(name in found for name in names): raise ValueError('KNOWN_FIXTURE_NAME_ALREADY_PRESENT')


def cleanup(runner,owned,commands,sources):
    errors=[]
    for kind,names in owned['uncertain'].items():
        if names:
            try:
                absence(runner,'cleanup-uncertain-'+kind+'-absence',kind,list(names),cleanup=True)
            except BaseException as error:
                errors.append('UNKNOWN_OWNERSHIP_NO_SIGNAL: '+repr(error))
    if not owned['containers'] and not owned['volumes']:
        return {'ownedAbsent':not errors,'errors':errors,'unknownSticky':bool(errors),'foreignSignals':0}
    try:
        if owned['containers']:
            names=list(owned['containers']); got=inspect_objects(runner,'cleanup-container-exact','container',names,cleanup=True)
            running=[]
            for name,actual in zip(names,got):
                state=S.container(actual,name,owned['containers'][name],commands[name],sources,runner.release['imageEnv'])
                if state['Running']: running.append(owned['containers'][name])
            if running:
                # One extra grouped stop is the47 nominal/48 ceiling reserve.
                runner.command('cleanup-owned-stop',['stop','--time','2']+running,timeout=48,cleanup=True)
                got=inspect_objects(runner,'cleanup-stopped-exact','container',names,cleanup=True)
                for name,actual in zip(names,got): S.container(actual,name,owned['containers'][name],commands[name],sources,runner.release['imageEnv'],False)
        if owned['volumes']:
            got=inspect_objects(runner,'cleanup-volume-exact','volume',owned['volumes'],cleanup=True)
            for name,actual in zip(owned['volumes'],got): S.volume(actual,name,sources.get(name))
        if owned['containers']:
            runner.command('cleanup-remove-exact-containers',['rm']+list(owned['containers'].values()),cleanup=True)
            absence(runner,'cleanup-container-absence','container',list(owned['containers']),cleanup=True)
        if owned['volumes']:
            runner.command('cleanup-remove-exact-volumes',['volume','rm']+owned['volumes'],cleanup=True)
            absence(runner,'cleanup-volume-absence','volume',owned['volumes'],cleanup=True)
    except BaseException as error:
        errors.append(repr(error))
    return {'ownedAbsent':not errors,'errors':errors,'unknownSticky':bool(errors),'foreignSignals':0}


def wait_mature(lease,seconds=60):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        lease.check(); time.sleep(min(0.25,max(0,deadline-time.monotonic())))


class NativeSourceServices:
    """Concrete default ownership interfaces; effects use only this class."""
    def runner(self,release,lease,ledger,directory):return Runner(release,lease,ledger,directory)
    def write_bridge(self,path,raw,ledger):C.durable_new(path,raw,ledger=ledger)
    def wait(self,lease):wait_mature(lease)
    def cohort(self,rows,ledger):return C.Cohort(rows,ledger,owner=(501,20))


def planned_source_reserve(ledger,carry,wire,source_bodies,sender_nines,directory):
    """Deny known impossible Source budgets before creating any fixture."""
    base_bytes=len(C.encoded(ledger.export()['body']))
    C.integer(base_bytes,0,C.MAX_FILE,'COMPLETE_LEDGER_FILE_CAP_BEFORE_EFFECT')
    pins={r['path']:r['PRE9'] for r in sender_nines['members']}
    sender_bytes=0;sender_paths=set()
    for row in carry['members']:
        pin=row['historicalMacNine'] if row['original130'] else pins[row['actualMacPath']]
        key=(row['actualMacPath'],tuple(C.valid_nine(pin)[x] for x in C.FIELDS),row['sha256'],row['bytes'])
        if key not in ledger.admissions:sender_bytes+=row['bytes']
        if row['actualMacPath'] not in ledger.paths:sender_paths.add(row['actualMacPath'])
    # Distinct new Mac bridge plus Linux bridge; all135 Linux bodies; four
    # Linux bootstrap sources; nine deliberately changed batch-state tuples;
    # one bounded stop document. The full base is not copied per batch.
    required_bytes=(sender_bytes+2*base_bytes+carry['memberBytes']+len(source_bodies['C'])+
        len(source_bodies['Q'])+len(C.encoded(wire))+9*len(C.encoded({'next':9}))+4096)
    required_paths=len(sender_paths)+142
    required_peak=ledger.snapshot()['liveOwnedSourceFDs']+135+1+4+136+1
    if ledger.bytes+required_bytes>C.MAX_BYTES:raise ValueError('WHOLE_PLANNED_SOURCE_BYTES_BEFORE_ANY_EFFECT')
    if len(ledger.paths)+required_paths>C.MAX_FILES:raise ValueError('WHOLE_PLANNED_SOURCE_PATHS_BEFORE_ANY_EFFECT')
    if required_peak>C.MAX_FILES:raise ValueError('WHOLE_PLANNED_SOURCE_FDS_BEFORE_ANY_EFFECT')
    return {'scope':'PLANNED_SOURCE_RESERVE_NOT_ACTUAL_ADMISSIONS','baseLedgerBytes':base_bytes,
        'additionalBytesMaximum':required_bytes,'additionalPathsMaximum':required_paths,
        'combinedFDMaximum':required_peak,'changedFailuresMustStillCharge':True,'sourceEligibility':False}


def admit_sender(release,carry,sender_nines):
    """Validate all sender authority and immutable rows before fixture dispatch."""
    if type(sender_nines) is not dict or set(sender_nines)!={'scope','oldCustodyRepaired','members'}:
        raise ValueError('EXACT_PROSPECTIVE_SENDER_FIELDS')
    if type(sender_nines['members']) is not list:
        raise ValueError('EXACT_FIVE_PROSPECTIVE_SENDER_PINS')
    for member in sender_nines['members']:
        if type(member) is not dict or set(member)!={'path','bytes','sha256','PRE9'}:
            raise ValueError('EXACT_PROSPECTIVE_SENDER_MEMBER_FIELDS')
        C.integer(member['bytes'],0,C.MAX_FILE,'PROSPECTIVE_SENDER_BYTES_EXACT_INT')
    if C.digest(C.encoded(sender_nines))!=release['senderProspectiveNineSha256']:
        raise ValueError('EXACT_ROOT_PROSPECTIVE_SENDER_NINE_DATA')
    if sender_nines['scope']!='NEW_ROOT_PROSPECTIVE_FIVE_SENDER_PINS_ONLY' or sender_nines['oldCustodyRepaired'] is not False:
        raise ValueError('NEW_SENDER_PINS_CANNOT_REPAIR_OLD_CUSTODY')
    new_pins={r['path']:r for r in sender_nines['members']}
    expected_new={r['actualMacPath'] for r in carry['members'] if not r['original130']}
    if len(sender_nines['members'])!=5 or set(new_pins)!=expected_new:
        raise ValueError('EXACT_FIVE_PROSPECTIVE_SENDER_PINS')
    rows=[]
    for r in carry['members']:
        expected=r['historicalMacNine']
        if not r['original130']:
            current=new_pins[r['actualMacPath']]
            if (current['bytes'],current['sha256'])!=(r['bytes'],r['sha256']): raise ValueError('PROSPECTIVE_SENDER_IMMUTABLE_BYTES')
            expected=C.valid_nine(current['PRE9'])
            if (expected['uid']!='501' or expected['gid']!='20' or expected['nlink']!='1' or
                not stat.S_ISREG(int(expected['mode'])) or int(expected['size'])!=r['bytes']):
                raise ValueError('PROSPECTIVE_SENDER_TYPED_NINE_SIZE_OWNER')
        rows.append({'path':r['actualMacPath'],'bytes':r['bytes'],'sha256':r['sha256'],'expectedNine':expected})
    return rows


def execute(release,lease,ledger,carry,wire,proof,source_bodies,directory,sender_nines,source_services=None):
    """No target exists; all original target/private windows remain unstarted."""
    services=source_services or NativeSourceServices()
    carry_raw=source_bodies['carry'];wire_raw=source_bodies['wire']
    if C.strict(carry_raw)!=carry or C.strict(wire_raw)!=wire or wire_raw!=C.encoded(wire):
        raise ValueError('EXACT_VERIFIED_CARRY_BYTES_AND_CANONICAL_WIRE')
    carry_sha=C.digest(carry_raw)
    if wire['macCarrySha256']!=carry_sha or proof['carrySha256']!=carry_sha:
        raise ValueError('ACTUAL_CARRY_FILE_DIGEST_NO_RESERIALIZATION')
    rows=admit_sender(release,carry,sender_nines)
    source_reserve=planned_source_reserve(ledger,carry,wire,source_bodies,sender_nines,directory)
    runner=services.runner(release,lease,ledger,directory)
    owned={'containers':{},'volumes':[],'uncertain':{'container':set(),'volume':set()}}; commands={}; sources={}; primary=None; result=None
    sender=None; sender_close=None; cleanup_result=None; amendments=[]
    namespace='linux:'+C.OPERATION+':'
    try:
        _,raw,_=runner.command('source-daemon-info',['info','--format','{{json .}}'])
        daemon=C.strict(raw)
        if daemon['ID']!=release['daemonID'] or daemon['OSType']!='linux': raise ValueError('ACTUAL_DAEMON_BINDING')
        _,raw,_=runner.command('source-image-inspect',['image','inspect',C.IMAGE])
        image=C.strict(raw)
        if len(image)!=1 or image[0]['Id']!=C.IMAGE or image[0]['Os']!='linux' or image[0]['Architecture']!='amd64':
            raise ValueError('EXACT_LOCAL_AMD64_SOURCE_IMAGE')
        T.exact(image[0]['Config']['Env'],release['imageEnv'])
        absence(runner,'source-container-absence','container',[S.WRITER,S.QUALIFIER])
        absence(runner,'source-volume-absence','volume',[S.INPUT,S.RESULT])
        for name,reserve in ((S.INPUT,2),(S.RESULT,4)):
            args=['volume','create','--driver','local']
            for key in sorted(S.LABELS): args+=['--label',key+'='+S.LABELS[key]]
            owned['uncertain']['volume'].add(name)
            _,raw,_=runner.command('source-volume-create-'+('input' if name==S.INPUT else 'result'),args+[name],reserve=reserve)
            if raw.decode().strip()!=name: raise ValueError('UNCERTAIN_VOLUME_CREATION')
            owned['volumes'].append(name)
            owned['uncertain']['volume'].remove(name)
        got=inspect_objects(runner,'source-volume-mappings','volume',owned['volumes'],4)
        for name,actual in zip(owned['volumes'],got): sources[name]=S.volume(actual,name)
        commands[S.WRITER]=WAIT_WRITER
        owned['uncertain']['container'].add(S.WRITER)
        _,raw,_=runner.command('source-writer-create',S.create(S.WRITER,WAIT_WRITER,release['imageEnv']),reserve=6)
        cid=raw.decode().strip()
        if not re.fullmatch('[a-f0-9]{64}',cid): raise ValueError('UNCERTAIN_WRITER_ID')
        owned['containers'][S.WRITER]=cid
        owned['uncertain']['container'].remove(S.WRITER)
        def writer_check(label,reserve=8,running=True):
            actual=inspect_objects(runner,label,'container',[S.WRITER],reserve)[0]
            return S.container(actual,S.WRITER,cid,WAIT_WRITER,sources,release['imageEnv'],running)
        writer_check('source-writer-prestart',6,False)
        runner.command('source-writer-start',['start',cid],reserve=8)
        writer_check('source-writer-poststart')
        files={name:{'bytes':len(data),'sha256':C.digest(data),'hex':data.hex()} for name,data in
            [('source_contract.py',source_bodies['C']),('linux_source_qualifier.py',source_bodies['Q']),('wire-manifest.json',C.encoded(wire))]}
        seed=C.encoded({'operation':C.OPERATION,'files':files})
        runner.command('source-seed',['exec','-i',cid,'/usr/bin/python3','-B','-c',SEED],48,seed,8)
        # Full immutable ledger is a separately admitted physical SOURCE input.
        base=ledger.export(); base_path=Path(directory)/'immutable-full-ledger.json'; base_raw=C.encoded(base['body'])
        services.write_bridge(base_path,base_raw,ledger)
        services.wait(lease)
        bridge=services.cohort([{'path':str(base_path),'bytes':len(base_raw),'sha256':base['sha256']}],ledger)
        bridge.open_all(); bridge.read_all()
        bridge_row={'path':str(base_path),'PRE9':bridge.owned[0]['pin'],'sha256':base['sha256'],'bytes':len(base_raw),'kind':'SOURCE'}
        amendments.append(bridge_row)
        # It is copied while its original Mac FD is held. Child cannot import
        # those Mac fields as a Linux physical identity.
        runner.command('source-copy-full-ledger',['cp',str(base_path),cid+':/source-epoch/base-ledger.json'],reserve=8)
        services.wait(lease)
        source_rows=[{'name':name,'path':'/source-epoch/'+target,'bytes':len(raw),'sha256':C.digest(raw)}
            for name,target,raw in [('C','source_contract.py',source_bodies['C']),('Q','linux_source_qualifier.py',source_bodies['Q']),
                                   ('wire','wire-manifest.json',C.encoded(wire)),('base','base-ledger.json',base_raw)]]
        expected_linux={namespace+r['path']:{'linuxPath':r['path'],'bytes':r['bytes'],'sha256':r['sha256'],'kind':'NEW_LINUX_BOOTSTRAP_SOURCE'} for r in source_rows}
        def accept(observed):
            T.validate_new_linux_rows(observed['newAdmissions'],amendments,namespace,expected_linux)
            merged=T.merge_suffix(ledger,base,amendments,observed)
            for row in merged[len(amendments):]:expected_linux[row['path']]['PRE9']=row['PRE9']
            return merged
        def bootstrap(label,args,stdin,reserve=8):
            row,out,err=runner.command(label,args,48,stdin,reserve,required=False)
            observed=C.strict(out)
            if row['exitCode']==23:
                T.charge_failed_attempts(ledger,base,amendments,observed,namespace,expected_linux)
                runner.sticky.append('FAILED_SOURCE_ATTEMPTS_CHARGED')
                raise C.SourceFailure(observed['errors'])
            if row['exitCode']!=0 or err:raise ValueError('BOOTSTRAP_UNKNOWN_FAILED_ACCOUNTING_NO_ELIGIBILITY')
            return observed
        def contract():
            value={'operation':C.OPERATION,'sourceRows':source_rows,'baseLedgerSha256':base['sha256'],
                'amendments':amendments,'amendmentsSha256':C.digest(C.encoded(amendments)),
                'linuxIdentityNamespace':namespace,'wireSha256':C.digest(C.encoded(wire)),
                'rootLiveFDs':ledger.snapshot()['liveOwnedSourceFDs'],'rootPeakFDs':ledger.peak}
            raw=C.encoded(value)
            if len(raw)>120000: raise ValueError('ACTUAL_LINUX_SINGLE_ARGV_120000_CAP')
            return raw.decode()
        sender=services.cohort(rows,ledger); sender.open_all(); bodies=sender.read_all()
        base_keys={(r['path'],tuple(r['PRE9'][x] for x in C.FIELDS),r['sha256'],r['bytes']) for r in base['body']['members']}
        # New actual Mac sender charges are parent lineage, never Linux pins.
        # Preserve them in the exact ordered amendment before the first child.
        amendments=[r for r in ledger.export()['body']['members']
            if (r['path'],tuple(r['PRE9'][x] for x in C.FIELDS),r['sha256'],r['bytes']) not in base_keys]
        framed=T.frames(carry,{r['index']:bodies[r['actualMacPath']] for r in carry['members']})
        for index,packet in enumerate(framed):
            if index:services.wait(lease)
            writer_check('source-writer-before-batch-'+str(index))
            for r in wire['members']:
                expected_linux.setdefault(namespace+r['linuxPath'],{'linuxPath':r['linuxPath'],'bytes':r['bytes'],'sha256':r['sha256'],'kind':'NEW_LINUX_COPY_FULL_EOF'})
            state_raw=C.encoded({'next':index+1});expected_linux[namespace+'/source-epoch/batch-state.json']={
                'linuxPath':'/source-epoch/batch-state.json','bytes':len(state_raw),'sha256':C.digest(state_raw),'kind':'NEW_LINUX_CHANGED_BATCH_CONTROL'}
            observed=bootstrap('source-batch-'+str(index),['exec','-i',cid,'/usr/bin/python3','-B','-c',source_bodies['B'].decode(),contract(),'write'],packet)
            amendments=accept(observed)
        services.wait(lease)
        writer_check('source-writer-before-source-stop')
        stopped=bootstrap('source-write-genuine-stop',['exec','-i',cid,'/usr/bin/python3','-B','-c',source_bodies['B'].decode(),contract(),'stop'],b'{}')
        if stopped['sha256']!=C.digest(C.encoded(stopped['stopValue'])) or stopped['bytes']!=len(C.encoded(stopped['stopValue'])):
            raise ValueError('ACTUAL_STOP_DOCUMENT_BODY_HASH')
        expected_linux[namespace+'/source-epoch/source-stop.json']={'linuxPath':'/source-epoch/source-stop.json',
            'bytes':stopped['bytes'],'sha256':stopped['sha256'],'kind':'NEW_LINUX_SOURCE_STOP'}
        amendments=accept(stopped)
        writer_check('source-writer-before-owned-stop')
        runner.command('source-owned-writer-stop',['stop','--time','2',cid],48,reserve=6)
        writer_check('source-writer-terminal',6,False)
        services.wait(lease)
        stop_row={'path':'/source-epoch/source-stop.json','ledgerPath':namespace+'/source-epoch/source-stop.json',
                  'bytes':stopped['bytes'],'sha256':stopped['sha256'],'expectedNine':stopped['nine'],'kind':'NEW_LINUX_SOURCE_STOP'}
        control=C.encoded({'linuxIdentityNamespace':namespace,'controlRows':[stop_row]})
        qualifier=['-B','-c',source_bodies['B'].decode(),contract(),'qualify']
        commands[S.QUALIFIER]=qualifier
        owned['uncertain']['container'].add(S.QUALIFIER)
        _,out,_=runner.command('source-qualifier-create',S.create(S.QUALIFIER,qualifier,release['imageEnv']),reserve=8)
        qid=out.decode().strip()
        if not re.fullmatch('[a-f0-9]{64}',qid): raise ValueError('UNCERTAIN_QUALIFIER_ID')
        owned['containers'][S.QUALIFIER]=qid
        owned['uncertain']['container'].remove(S.QUALIFIER)
        got=inspect_objects(runner,'source-qualifier-prestart','container',[S.QUALIFIER],6)[0]
        S.container(got,S.QUALIFIER,qid,qualifier,sources,release['imageEnv'],False)
        linux=bootstrap('source-qualifier-start-attached',['start','-a','-i',qid],control)
        # Unchanged complete135 pins dedup in the same ledger; qualification
        # cannot silently manufacture a changed identity after the writer stop.
        amendments=accept(linux)
        got=inspect_objects(runner,'source-qualifier-terminal','container',[S.QUALIFIER],6)[0]
        state=S.container(got,S.QUALIFIER,qid,qualifier,sources,release['imageEnv'],False)
        if state['ExitCode']!=0 or state['Status']!='exited': raise ValueError('QUALIFIER_TERMINAL_EXIT')
        sender_close=sender.final_and_close(); sender=None
        if sender_close['closeErrors']: raise C.SourceFailure(sender_close['closeErrors'])
        sender_artifact={'macCarrySha256':carry_sha,'members':[dict(row,index=i) for i,row in enumerate(sender_close['members'])]}
        lineage=L.validate_artifact(carry,wire,linux,sender_artifact,proof,carry_raw=carry_raw)
        result={'scope':'ROOT_SOURCE_FIXTURE_LINEAGE_ONLY','linux':linux,'sender':sender_close,'lineage':lineage,
            'sourceEligibility':False,'runtimeAuthority':False,'fullTask03':False,'fullGoal':False}
    except BaseException as error:
        primary=error
    finally:
        close_errors=[]
        if sender is not None:
            try:close=sender.final_and_close(primary); close_errors+=close['closeErrors']
            except BaseException as error:close_errors.append(repr(error))
        if 'bridge' in locals():
            try:close=bridge.final_and_close(primary); close_errors+=close['closeErrors']
            except BaseException as error:close_errors.append(repr(error))
        try:cleanup_result=cleanup(runner,owned,commands,sources)
        except BaseException as error:
            cleanup_result={'ownedAbsent':False,'errors':[repr(error)],'unknownSticky':True,'foreignSignals':0}
        if cleanup_result['errors']: close_errors+=cleanup_result['errors']
        if primary is not None: close_errors.insert(0,repr(primary))
        if close_errors:
            raise C.SourceFailure(close_errors) from primary
    result['cleanup']=cleanup_result; result['commands']=runner.receipts
    result['commandCount']=runner.budget.used; result['oneLedger']=ledger.export()
    result['plannedSourceReserve']=source_reserve
    return result
