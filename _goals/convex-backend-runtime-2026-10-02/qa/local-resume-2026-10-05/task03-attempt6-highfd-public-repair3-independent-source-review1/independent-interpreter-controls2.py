"""Exact declared host interpreter, isolated held entry, no actual handoff dispatch."""
import ast,hashlib,json,subprocess
from pathlib import Path
J=Path(REVIEW_DIR);U=J.parent/'task03-attempt6-actual-public-custody-readiness-repair3'
contract=json.loads(DATA[str(U/'exact-entry-and-handoff-contract.json')]);host=contract['hostInterpreter']
tree=ast.parse(DATA[str(U/'actual-entry.py')]);nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) or isinstance(n,ast.Assign) and any(isinstance(x,ast.Name) and x.id=='FIELDS' for x in n.targets)]
isolated=ast.unparse(ast.Module(body=nodes,type_ignores=[]))
p=U/'fixtures/owned-entry-3.py';pin=next(r for r in OWNERS if r['path']==str(p));expected={'PRE9':pin['PRE9'],'sha256':hashlib.sha256(DATA[str(p)]).hexdigest(),'bytes':len(DATA[str(p)])}
child=r'''
import hashlib,json,os,stat,sys,time,types
from pathlib import Path
payload=json.loads(sys.stdin.buffer.read());cases=[]
for fault in (False,True):
 opened=[];closes=[]
 class CloseFailure(OSError):pass
 class LoggedOS:
  def __getattr__(self,k):return getattr(os,k)
  def open(self,p,flags):
   fd=os.open(p,flags);opened.append(fd);return fd
  def close(self,fd):
   assert fd in opened and fd not in closes
   closes.append(fd);os.close(fd)
   if fault:raise CloseFailure('required-close-error')
 scope=dict(hashlib=hashlib,json=json,os=LoggedOS(),stat=stat,sys=types.SimpleNamespace(dont_write_bytecode=True,argv=['isolated-entry',payload['fixture'],json.dumps(payload['expected']),'/never-read-real-handoff']),time=time,Path=Path)
 exec(compile(payload['isolated'],'<verified-isolated-entry>','exec'),scope)
 result=None;error=None
 try:result=scope['main']()
 except BaseException as e:error=e
 errors=[]
 def walk(e):
  if e is None:return
  errors.append({'class':type(e).__name__,'reason':str(e)})
  for x in getattr(e,'exceptions',[]):walk(x)
  if e.__cause__ is not None:walk(e.__cause__)
 walk(error)
 cases.append({'closeFault':fault,'result':result,'errors':errors,'opened':len(opened),'closeAttempts':len(closes),'allCloseOnce':opened==closes,'requiredCloseErrorRetained':any(x['reason']=='required-close-error' for x in errors)})
print(json.dumps({'version':sys.version,'executable':sys.executable,'BaseExceptionGroupAvailable':hasattr(__builtins__,'BaseExceptionGroup'),'cases':cases}))
'''
payload={'isolated':isolated,'fixture':str(p),'expected':expected}
proc=subprocess.run([host,'-B','-c',child],input=json.dumps(payload).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=10,env={'HOME':'/Users/SaintNick','PATH':'/usr/bin:/bin','LANG':'C.UTF-8'})
(J/'independent-interpreter-controls2.stdout').write_bytes(proc.stdout);(J/'independent-interpreter-controls2.stderr').write_bytes(proc.stderr)
assert proc.returncode==0,proc.stderr.decode();r=json.loads(proc.stdout)
positive=r['cases'][0];fault=r['cases'][1];assert positive['result']==0 and positive['errors']==[] and positive['allCloseOnce']
sticky=fault['allCloseOnce'] and fault['requiredCloseErrorRetained']
RESULT={'scope':'INDEPENDENT_U3_EXACT_DECLARED_INTERPRETER_SOURCE_MOCK','sourceEligibility':False,'hostInterpreter':host,'observations':r,'controls':[{'name':'declared-entry-interpreter:positive','status':'PASS'},{'name':'declared-entry-interpreter:sticky-close-error','status':'PASS' if sticky else 'FAIL','priority':'P1' if not sticky else None,'actualDeclaredInterpreter':True}], 'PASS':1+int(sticky),'FAIL':int(not sticky),'candidateFailure':not sticky,'actualEffects':{'Docker':0,'network':0,'credentials':0,'private':0,'service':0,'actualRunner':0},'fullTask03':False,'fullGoal':False}
