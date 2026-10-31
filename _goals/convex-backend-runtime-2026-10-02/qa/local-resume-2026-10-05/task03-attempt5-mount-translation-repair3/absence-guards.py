"""Actual imported cleanup/run guards; all process/file effects mocked in memory."""
import copy,hashlib,importlib.util,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
QA=Path(__file__).absolute().parent;R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
SOURCE=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt5-private-source-repair3/task03-attempt5-private-coordinate.py'
spec=importlib.util.spec_from_file_location('actual_private_qualified_absence_guards',SOURCE);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
results=[]
def case(name,phase='initial',raw=b'[]\n',code=1,stderr=None,owned_mutation=None,row_mutation=None,running=False,expected=True):
 events=[];bodies={};m.RECORDS=[]
 absent_stderr=('error: no such object: '+m.NAME+'\n').encode()
 class Stream:
  def __init__(self,key):self.key=key
  def read_bytes(self):return bodies[self.key]
 class Log:
  def __truediv__(self,name):return Stream(name)
 m.LOG=Log()
 obj={'Name':'/'+m.NAME,'Image':m.IMAGE,'Config':{'Labels':{'cortex.operation':m.OP}},'State':{'Running':running}}
 if owned_mutation:owned_mutation(obj)
 class C:
  @staticmethod
  def run(label,argv,log,timeout,env,input_bytes,required,progress):
   assert required is False and timeout==30;events.append({'label':label,'argv':argv})
   row={'terminal':True,'closeErrors':[],'failureClass':None,'exitCode':0};out=b'';err=b''
   if '-inspect-' in label:
    if phase=='initial':row['exitCode']=code;out=raw;err=absent_stderr if stderr is None else stderr
    else:out=json.dumps([obj]).encode()
   elif '-terminal-' in label:
    terminal=copy.deepcopy(obj);terminal['State']['Running']=False;out=json.dumps([terminal]).encode()
   elif '-absence-' in label:
    row['exitCode']=code;out=raw;err=absent_stderr if stderr is None else stderr
   if row_mutation:
    target='-inspect-' if phase=='initial' else '-absence-'
    if target in label:row_mutation(row)
   bodies[label+'.stdout']=out;bodies[label+'.stderr']=err
   return row,out,err
 m.C=C;failure=None
 try:m.cleanup_owned(m.NAME,'source-mock')
 except BaseException as e:failure=type(e).__name__
 assert (failure is None)==expected,(name,failure,events)
 actions=[e['argv'][1] for e in events]
 if phase=='initial' and not expected:assert 'kill' not in actions and 'rm' not in actions
 if owned_mutation and not expected:assert 'kill' not in actions and 'rm' not in actions
 if expected and phase=='post':assert actions.count('rm')==1 and actions.count('kill')==int(running)
 results.append({'name':name,'status':'PASS','expectedAccept':expected,'observedAccept':failure is None,'exception':failure,'phase':phase,'rawStdoutHex':raw.hex(),'code':code,'allEffectsMocked':True,'events':events})
case('qualified-exact-initial-absence')
case('qualified-post-remove-absence',phase='post')
case('qualified-running-owned-cleanup',phase='post',running=True)
for phase in ('initial','post'):
 for name,raw in [('empty',b''),('missing-newline',b'[]'),('CRLF',b'[]\r\n'),('space-alias',b'[ ]\n'),('extra',b'[]\nEXTRA'),('null',b'null\n'),('malformed',b'['),('object',b'{}\n'),('foreign-object',b'[{"Name":"/FOREIGN"}]\n')]:case(phase+'-stdout-'+name,phase,raw=raw,expected=False)
 for code in (0,2,1.0,True,None):case(phase+'-exit-'+repr(code),phase,code=code,expected=False)
 for name,err in [('foreign-name',b'error: no such object: FOREIGN\n'),('unknown-error',b'error: daemon unavailable\n'),('absent-other-object-kind',('error: no such container: '+m.NAME+'\n').encode()),('empty',b'')]:case(phase+'-stderr-'+name,phase,stderr=err,expected=False)
 for name,mutation in [('terminal-false',lambda r:r.update(terminal=False)),('terminal-one',lambda r:r.update(terminal=1)),('close-error',lambda r:r.update(closeErrors=['MOCK_CLOSE_ERROR'])),('unknown',lambda r:r.update(failureClass='OwnedGroupUnknown'))]:case(phase+'-row-'+name,phase,row_mutation=mutation,expected=False)
for name,mutation in [('foreign-name',lambda o:o.update(Name='/FOREIGN')),('foreign-operation',lambda o:o['Config']['Labels'].update({'cortex.operation':'FOREIGN'})),('foreign-image',lambda o:o.update(Image='sha256:'+'0'*64)),('numeric-running',lambda o:o['State'].update(Running=1))]:case(name,phase='post',owned_mutation=mutation,running=True,expected=False)
result={'scope':'ACTUAL_IMPORTED_OWNED_CLEANUP_EXACT_QUALIFIED_DOCKER_ABSENCE_SOURCE_ONLY','status':'PASS','controls':len(results),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'qualifiedProtocolEvidence':'raw/actual-absence-protocol-evidence.json','allEffectsMocked':True,'actualDockerCalls':0,'privateReads':0,'privateStats':0,'cases':results}
(QA/'raw/absence-guards.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='cases'}))
