"""Executor SOURCE/MOCK disposition and export race outcomes; no native subjects."""
import ast,copy,hashlib,json,os,re,types
from pathlib import Path
RESULTS=[]
def case(name,fn):
    try:RESULTS.append({'name':name,'status':'PASS','scope':'EXECUTOR_SOURCE_MOCK','detail':fn()})
    except BaseException as error:RESULTS.append({'name':name,'status':'FAIL','scope':'EXECUTOR_SOURCE_MOCK','error':repr(error)})
def denied(fn):
    try:fn()
    except BaseException as error:return str(error)
    raise AssertionError('expected denial')
def extract(name,fn):
    node=next(n for n in ast.parse(SOURCES[name]).body if isinstance(n,(ast.FunctionDef,ast.ClassDef))and n.name==fn)
    return compile(ast.Module(body=[node],type_ignores=[]),name,'exec')
NE={};exec(compile(ast.Module(body=[n for n in ast.parse(SOURCES['native_export.py']).body if isinstance(n,ast.Assign)],type_ignores=[]),'native_export.py','exec'),NE)
PE={'re':re,'FIELDS':('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'),'PUBLIC':NE['PUBLIC'],'ROOT':'/var/tmp/task04-c8-current-canonical-input-producers/'}
exec(extract('public_export_contract.py','validate_public'),PE);exec(extract('public_export_contract.py','validate_public_outcome'),PE)
def manifest(primary=None):return {'scope':'FINITE_PUBLIC_SOURCE_CONTROL_EXPORT_ONLY','files':[{'relativePath':n,'status':'ABSENT'}for n in PE['PUBLIC']],'fileCount':23,'existingBytes':0,'combinedExportBytesMaxIncludingThisManifest':1048576,'primaryFailure':primary,'allDescendantsTerminal':True,'nativeClaims':False,'original122':'HELD','ROOT':'ABSENT'}
def result():return {'scope':'PUBLIC_SYNTHETIC_SOURCE_CONTROLS_ONLY','count':48,'controls':[{'name':'control-'+str(i),'status':'PASS'}for i in range(48)],'nativeClaims':False,'original122':'HELD','ROOT':'ABSENT','whole120':'HELD'}
def successful():
    out=PE['validate_public_outcome'](manifest(),0,result());assert out['count']==48 and out['primaryFailure']is None
    return {'exactSuccessfulProcessManifestResults':True}
case('successful_process_manifest_exact48_positive',successful)
for value in (False,True,0,1,[],{},1.5):
    def bad(value=value):return {'denial':denied(lambda:PE['validate_public'](manifest(value))),'copies':0}
    case('primary_alias_'+repr(value)+'_denied_before_copy',bad)
for value in ('body failure',''):
    def honest(value=value):
        assert len(PE['validate_public'](manifest(value)))==23
        reason=denied(lambda:PE['validate_public_outcome'](manifest(value),1,None));assert 'FAILED_STICKY'in reason
        reason2=denied(lambda:PE['validate_public_outcome'](manifest(value),0,result()));assert 'MANIFEST_FAILURE_STICKY'in reason2
        return {'rawFailureManifestValid':True,'acceptanceDeniedForZeroAndNonzeroExit':True}
    case('honest_failed_manifest_'+repr(value),honest)
for kind in ('false','float','none','negative','too-large','nonzero-success-form','nonzero-failed-form','missing-result','count-alias','count47','count49','list-tuple','duplicate','failed-row','status-alias','scope','native-alias','whole-held'):
    def negative(kind=kind):
        data=manifest();code=0;res=result()
        if kind=='false':code=False
        elif kind=='float':code=0.0
        elif kind=='none':code=None
        elif kind=='negative':code=-1
        elif kind=='too-large':code=256
        elif kind=='nonzero-success-form':code=1
        elif kind=='nonzero-failed-form':code=1;data['primaryFailure']='fail'
        elif kind=='missing-result':res=None
        elif kind=='count-alias':res['count']=48.0
        elif kind=='count47':res['count']=47;res['controls'].pop()
        elif kind=='count49':res['count']=49;res['controls'].append({'name':'extra','status':'PASS'})
        elif kind=='list-tuple':res['controls']=tuple(res['controls'])
        elif kind=='duplicate':res['controls'][1]['name']=res['controls'][0]['name']
        elif kind=='failed-row':res['controls'][1]['status']='FAIL'
        elif kind=='status-alias':res['controls'][1]['status']=True
        elif kind=='scope':res['scope']='native'
        elif kind=='native-alias':res['nativeClaims']=0
        elif kind=='whole-held':res['whole120']='PASS'
        return {'denial':denied(lambda:PE['validate_public_outcome'](data,code,res)),'acceptance':False}
    case('outcome_consistency_'+kind,negative)
def export(fault=None,process_exit=0,primary=None):
    events=[];buffers={};saved=[];fences=[];closings=[];reads=[]
    class P:
        def __init__(self,value):self.path=str(value)
        def __truediv__(self,value):return P(self.path+'/'+str(value))
        def mkdir(self,*a,**k):events.append('mkdir')
        def stat(self):return types.SimpleNamespace(st_size=len(buffers[self.path]))
        def __str__(self):return self.path
    payload=json.dumps(result()).encode();data=manifest(primary)
    index=PE['PUBLIC'].index('controls/linux-public-repair2/results.json');path=PE['ROOT']+PE['PUBLIC'][index]
    pin={'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest()}
    if fault!='missing-result':data['files'][index]={'relativePath':PE['PUBLIC'][index],'status':'EXISTS','current':pin}
    # Full validate_public is covered above. This finite export mock supplies an
    # already-qualified 23-row transport manifest and verified source functions.
    rows=[{'path':PE['ROOT']+r['relativePath'],'status':r['status'],**({'current':pin}if r['status']=='EXISTS'else{})}for r in data['files']]
    class Held:
        def __init__(self,target,cap,expected=None):
            self.path=str(target);self.fd=100+len(reads);self.raw=buffers[self.path];self.size=len(self.raw);reads.append(self)
            if expected is not None:
                assert expected==pin
                if fault=='result-hash':
                    self.close();raise ValueError('CURRENT_CONTENT_PIN')
        def fence(self,full=False):
            fences.append((self.path,full))
            if fault=='result-nine'and self.path.endswith('file-'+str(index).zfill(4)):raise ValueError('CURRENT_ALL_NINE_DRIFT')
            return {'path':self.path}
        def close(self):
            closings.append(self.path)
            if fault=='result-close'and len(reads)==3:raise OSError('INJECT_RESULT_CLOSE')
    def copying(remote,target,*a):
        events.append(('copy',remote));buffers[str(target)]=json.dumps(data).encode()if remote.endswith('public-export-manifest.json')else payload
    terminal={'State':{'Pid':0,'Running':False,'Status':'exited','ExitCode':process_exit},'immutableId':'a'*64};terminal_calls=[]
    def terminal_fence(code):
        terminal_calls.append(code)
        if fault=='process-race'and len(terminal_calls)==2:return {**terminal,'immutableId':'b'*64}
        return terminal
    def reading(fd,cap):
        item=next(h for h in reads if h.fd==fd)
        if fault=='result-eof'and len(reads)==3:return item.raw[:-1]
        return item.raw
    def outcome(d,e,r):
        # Reuse real success validator with full 23-row ABSENT transport vector;
        # content-pin qualification occurs in Held above, never in this substitute.
        return PE['validate_public_outcome'](manifest(d['primaryFailure']),e,r)
    G={'COMBINED_EXPORT_BYTES':0,'COMBINED_EXPORT_PATHS':0,'EXPORT_SECONDS_USED':0,'RUN':P('/mock'),'phase':lambda*a:None,'time':types.SimpleNamespace(monotonic=lambda:0),'export_copy':copying,'Held':Held,'strict':json.loads,'os':types.SimpleNamespace(lseek=lambda*a:None,read=reading,SEEK_SET=0),'validate_public':lambda d:rows,'validate_manifest':lambda d:None,'save':lambda n,v:saved.append((n,v)),'remaining':lambda:1,'public_terminal_fence':terminal_fence,'validate_public_outcome':outcome}
    exec(extract('ci-run.py','export_phase'),G)
    if fault or process_exit or primary is not None:
        reason=denied(lambda:G['export_phase']('public48',process_exit));assert G['COMBINED_EXPORT_BYTES']==0 and G['COMBINED_EXPORT_PATHS']==0
        if process_exit or primary is not None:assert any(n=='public48-export-copy.json'for n,v in saved)
    else:
        G['export_phase']('public48',process_exit);reason=None;assert G['COMBINED_EXPORT_BYTES']>0 and len(reads)==3 and len(closings)==3
    if fault not in ('result-hash',):assert len(closings)==len(reads)
    return {'reason':reason,'exportCopies':events,'heldReads':len(reads),'explicitCloses':len(closings),'terminalFences':len(terminal_calls),'rawFailureExportPreserved':bool(saved),'acceptance':reason is None}
case('complete_public_export_positive_held_result_postclose',lambda:export())
for fault in ('missing-result','result-hash','result-nine','result-eof','result-close','process-race'):
    case('public_export_race_denial_'+fault,lambda fault=fault:export(fault))
case('failed_process_honest_raw_export_sticky',lambda:export(process_exit=1,primary='body failure'))
case('zero_process_failure_manifest_sticky',lambda:export(primary='body failure'))
def terminal_fault(kind):
    state={'Pid':0,'Running':False,'Status':'exited','ExitCode':0}
    if kind=='exit-mismatch':state['ExitCode']=1
    elif kind=='running':state['Running']=True
    elif kind=='pid-alias':state['Pid']=False
    elif kind=='exit-alias':state['ExitCode']=False
    elif kind=='status':state['Status']='created'
    G={'inspect':lambda:{'State':state},'validate':lambda*a,**k:None,'EXPECTED':{},'remaining':lambda:1}
    exec(extract('ci-run.py','public_terminal_fence'),G)
    return {'denial':denied(lambda:G['public_terminal_fence'](0)),'targetActions':0}
for kind in ('exit-mismatch','running','pid-alias','exit-alias','status'):case('terminal_process_'+kind,lambda kind=kind:terminal_fault(kind))
RESULT={'schema':'EXECUTOR_R1_REPAIR3_PUBLIC_DISPOSITION_SOURCE_MOCK','results':RESULTS,'PASS':sum(r['status']=='PASS'for r in RESULTS),'FAIL':sum(r['status']=='FAIL'for r in RESULTS),'actualNative20Public48':False,'sourceEligibility':False,'runtimeAuthority':False,'originalTask04':'OPEN'}
