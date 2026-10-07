"""Independent actual export function controls with finite explicit host fixtures."""
import ast,copy,hashlib,json,math,os,re,time,types
from pathlib import Path
J=Path(__file__).resolve().parent;P=J.parent
A=P/'task04-current-producer-native-public-repair3'
def main():
    src=held_source(str(A/'source/ci-run.py'));tree=ast.parse(src)
    funcs=[n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name in ('export_phase','public_terminal_fence')]
    compiled=compile(ast.Module(body=funcs,type_ignores=[]),str(A/'source/ci-run.py'),'exec')
    pub=held_source(str(A/'source/public_export_contract.py'));pt=ast.parse(pub);pt.body=[n for n in pt.body if not isinstance(n,(ast.Import,ast.ImportFrom))]
    ne=ast.parse(held_source(str(A/'source/native_export.py')))
    public=ast.literal_eval(next(n.value for n in ne.body if isinstance(n,ast.Assign)and any(isinstance(t,ast.Name)and t.id=='PUBLIC'for t in n.targets)))
    pn={'re':re};exec(compile(pt,str(A/'source/public_export_contract.py'),'exec'),pn)
    pn.update(FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'),PUBLIC=public)
    nt=ast.parse(held_source(str(A/'source/native_contract.py')))
    strict=next(n for n in nt.body if isinstance(n,ast.FunctionDef)and n.name=='strict')
    sn={'json':json,'math':math};exec(compile(ast.Module(body=[strict],type_ignores=[]),str(A/'source/native_contract.py'),'exec'),sn)
    rows=[]
    result={'scope':'PUBLIC_SYNTHETIC_SOURCE_CONTROLS_ONLY','controls':[{'name':'control-'+str(i),'status':'PASS'}for i in range(48)],'count':48,'nativeClaims':False,'original122':'HELD','ROOT':'ABSENT','whole120':'HELD'}
    resultpath='/var/tmp/task04-c8-current-canonical-input-producers/controls/linux-public-repair2/results.json'
    for fault in ('positive','process-nonzero','manifest-failed','result-count','result-duplicate','result-parse','result-short','result-fence-before','result-fence-after','terminal-drift','report-failure'):
        events=[];owned=[];attempts=[];maps={};terminalCalls=[0];fences={};error=None
        r=copy.deepcopy(result)
        if fault=='result-count':r['count']=47
        if fault=='result-duplicate':r['controls'][47]['name']=r['controls'][0]['name']
        resultRaw=(json.dumps(r,separators=(',',':'))+'\n').encode()
        if fault=='result-parse':resultRaw=b'{"x":1e309}\n'
        pin={'schema':'FS_IDENTITY_DECIMAL_V1','fields':{'dev':'1','ino':'2','mode':str(0o100600),'uid':'0','gid':'0','nlink':'1','size':str(len(resultRaw)),'mtime_ns':'1','ctime_ns':'1'}}
        current={'path':resultpath,'bytes':len(resultRaw),'sha256':hashlib.sha256(resultRaw).hexdigest(),'PRE':pin,'OPEN':pin,'POST':pin,'pathPOST':pin,'EOF':True}
        data={'scope':'FINITE_PUBLIC_SOURCE_CONTROL_EXPORT_ONLY','files':[{'relativePath':n,'status':'EXISTS','current':current}if n=='controls/linux-public-repair2/results.json'else{'relativePath':n,'status':'ABSENT'}for n in public],
              'fileCount':23,'existingBytes':len(resultRaw),'combinedExportBytesMaxIncludingThisManifest':1048576,'primaryFailure':'FAILED'if fault=='manifest-failed'else None,
              'allDescendantsTerminal':True,'nativeClaims':False,'original122':'HELD','ROOT':'ABSENT'}
        manifestRaw=json.dumps(data,separators=(',',':')).encode()
        process_exit=1 if fault=='process-nonzero'else 0
        class FP:
            def __init__(self,s):self.s=s;self.name=s.rsplit('/',1)[-1]
            def __truediv__(self,x):return FP(self.s+'/'+x)
            def __str__(self):return self.s
            def mkdir(self,**kw):events.append('mkdir')
            def stat(self):return types.SimpleNamespace(st_size=len(maps[self.s]))
        class H:
            def __init__(self,path,cap,expected=None):
                self.path=path;self.raw=maps[path];self.size=len(self.raw);self.fd=os.open(J/'owned-fixtures/input0.json',os.O_RDONLY|os.O_NOFOLLOW)
                owned.append(self);events.append('open:'+path);fences[id(self)]=0
                assert self.size<=cap
                if expected is not None:assert(self.size,hashlib.sha256(self.raw).hexdigest())==(expected['bytes'],expected['sha256'])
            def fence(self,full=False):
                fences[id(self)]+=1;n=fences[id(self)];events.append('fence:'+self.path+':'+str(n))
                isresult=self.path.endswith('file-0017')and len([o for o in owned if o.path==self.path])==2
                if isresult and ((fault=='result-fence-before'and n==1)or(fault=='result-fence-after'and n==2)):raise ValueError('HELD_NINE_OR_HASH_DRIFT_'+fault)
                return {'path':self.path,'bytes':self.size,'sha256':hashlib.sha256(self.raw).hexdigest(),'EOF':True}
            def close(self):
                fd=self.fd;self.fd=None
                if fd is not None:attempts.append(fd);events.append('close:'+self.path);os.close(fd)
        class OS:
            SEEK_SET=0
            def lseek(self,*a):return 0
            def read(self,fd,count):
                obj=next(o for o in owned if o.fd==fd)
                isresult=obj.path.endswith('file-0017')and len([o for o in owned if o.path==obj.path])==2
                return obj.raw[:-1]if fault=='result-short'and isresult else obj.raw
        def export_copy(remote,target,cap,expected=None):
            value=manifestRaw if remote.endswith('public-export-manifest.json')else resultRaw
            assert len(value)<=cap;maps[str(target)]=value;events.append('copy:'+remote)
        def inspect():
            terminalCalls[0]+=1
            return {'State':{'Running':False,'Pid':0,'Status':'exited','ExitCode':process_exit},
                    'fixture':'changed'if fault=='terminal-drift'and terminalCalls[0]>1 else'original'}
        def strict(raw):
            events.append('strict');return sn['strict'](raw)
        def save(name,value):
            events.append('report:'+name)
            if fault=='report-failure':raise OSError('REPORT_MARKER')
        ns={'RUN':FP('/owned-export'),'EXPORT_SECONDS_USED':0,'COMBINED_EXPORT_BYTES':0,'COMBINED_EXPORT_PATHS':0,
            'phase':lambda *a:events.append('phase'),'remaining':lambda:20,'time':types.SimpleNamespace(monotonic=lambda:1),
            'export_copy':export_copy,'Held':H,'os':OS(),'strict':strict,'validate_public':pn['validate_public'],
            'validate_public_outcome':pn['validate_public_outcome'],'save':save,'inspect':inspect,'validate':lambda *a,**k:None,'EXPECTED':{}}
        exec(compiled,ns)
        try:ns['export_phase']('public48',process_exit)
        except BaseException as e:error=e
        rescued=[]
        for obj in owned:
            if obj.fd is not None:
                fd=obj.fd;obj.fd=None;os.close(fd);rescued.append(fd)
        okay=(error is None if fault=='positive'else error is not None)and len(attempts)==len(owned)and not rescued
        if fault=='positive':
            last=owned[-1];okay=okay and fences[id(last)]==2 and terminalCalls[0]==2
        if fault in ('manifest-failed','process-nonzero'):okay=okay and any(v.startswith('report:public48-export-copy')for v in events)
        rows.append({'name':'R3.export_phase.actualFunction.'+fault,'status':'PASS'if okay else'FAIL','events':events,
                     'openedCount':len(owned),'closeAttempts':len(attempts),'rescued':rescued,'terminalCalls':terminalCalls[0],
                     'error':repr(error)if error else None,'fakeExternalEvidenceOnly':True,'noDockerDispatch':True})
    # Actual terminal fence integer/boolean guards, independently reached.
    variants=[('positive',False,0,'exited',0,0,False),('running',True,0,'exited',0,0,True),
      ('runningAlias',0,0,'exited',0,0,True),('pidBool',False,False,'exited',0,0,True),
      ('pidNonzero',False,1,'exited',0,0,True),('exitBool',False,0,'exited',False,0,True),
      ('exitMismatch',False,0,'exited',1,0,True),('status',False,0,'running',0,0,True),
      ('processBool',False,0,'exited',0,False,True)]
    for name,running,pid,status,actual,expected,deny in variants:
        ns={'inspect':lambda:{'State':{'Running':running,'Pid':pid,'Status':status,'ExitCode':actual}},
            'validate':lambda *a,**k:None,'EXPECTED':{},'remaining':lambda:20}
        exec(compiled,ns);err=None
        try:ns['public_terminal_fence'](expected)
        except BaseException as e:err=e
        rows.append({'name':'R3.public_terminal.actualFunction.'+name,'status':'PASS'if(err is not None)==deny else'FAIL','error':repr(err)if err else None})
    value={'scope':'INDEPENDENT_ACTUAL_EXPORT_FUNCTION_SOURCE_CONTROLS_ONLY','rows':rows,'pass':sum(r['status']=='PASS'for r in rows),'fail':sum(r['status']=='FAIL'for r in rows),'ledger':source_ledger(),'Docker':False,'private':False,'native':False,'allFixtureFDsExplicitlyClosed':True}
    target=J/'independent-export-controls1.json';target.write_text(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n')
    return {'pass':value['pass'],'fail':value['fail'],'path':str(target),'failNames':[r['name']for r in rows if r['status']=='FAIL']}

