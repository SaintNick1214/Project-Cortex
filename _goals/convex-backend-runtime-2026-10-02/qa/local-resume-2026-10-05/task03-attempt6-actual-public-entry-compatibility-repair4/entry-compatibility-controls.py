"""Owned SOURCE/MOCK entry tests, exact /usr/bin/python3 and supported interpreter."""
import ast,hashlib,json,os,stat,sys,time,types
from pathlib import Path
P=json.loads(sys.stdin.buffer.read());raw=P['entry'].encode();fixture=Path(P['fixture']);expected=P['fixturePin']
REAL_OS=os
FIELDS=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')
def nine(s):return{k:str(getattr(s,'st_'+k))for k in FIELDS}
def check(v,label):
 if not v:raise AssertionError(label)
class OwnedFinal(OSError):pass
class OwnedClose(OSError):pass
class OwnedPrimary(BaseException):pass
class FaultOS:
 def __init__(self,final,close):self.fds=[];self.closes=[];self.fstatCalls=0;self.final=final;self.close_error=close
 def __getattr__(self,name):return getattr(REAL_OS,name)
 def open(self,path,flags):
  check(Path(path)==fixture,'only_owned_fixture');fd=REAL_OS.open(path,flags);self.fds.append(fd);return fd
 def fstat(self,fd):
  check(fd in self.fds,'owned_fstat');self.fstatCalls+=1
  if self.fstatCalls==3 and self.final is not None:raise self.final
  return REAL_OS.fstat(fd)
 def close(self,fd):
  check(fd in self.fds and fd not in self.closes,'owned_close_once');self.closes.append(fd);REAL_OS.close(fd)
  if self.close_error is not None:raise self.close_error
def run(label,primary,final,close,positive_exit=None):
 tree=ast.parse(raw)
 tree.body=[n for n in tree.body if not(isinstance(n,ast.If)and isinstance(n.test,ast.Compare)and isinstance(n.test.left,ast.Name)and n.test.left.id=='__name__')]
 ns={'__name__':'isolated_held_entry','__file__':P['entryPath']}
 exec(compile(ast.fix_missing_locations(tree),P['entryPath'],'exec'),ns)
 fos=FaultOS(final,close)
 ns.update(os=fos,sys=types.SimpleNamespace(dont_write_bytecode=True,argv=['held-entry',str(fixture),json.dumps(expected),'/owned-source-only-unused-handoff']))
 real_compile=compile;real_exec=exec
 def owned_compile(source,path,mode,**kwargs):
  check(bytes(source)==b'raise SystemExit(0)\n','complete_original_fixture_bytes')
  return real_compile('raise _owned_primary'if primary is not None else('raise SystemExit('+repr(positive_exit)+')'if positive_exit is not None else'pass'),path,mode)
 def owned_exec(code,scope):
  scope['_owned_primary']=primary
  real_exec(code,scope)
 ns.update(compile=owned_compile,exec=owned_exec)
 outcome=None;returned=None
 try:returned=ns['main']()
 except BaseException as error:outcome=error
 check(fos.closes==fos.fds and len(fos.closes)==1,'explicit_all_owned_close_exactly_once')
 children=([primary]if primary is not None else[])+([final]if final is not None else[])+([close]if close is not None else[])
 successful_zero=isinstance(primary,SystemExit)and primary.code in(None,0)and final is None and close is None
 if children and not successful_zero:
  check(outcome is not None and not isinstance(outcome,NameError),'complete_sticky_failure_no_NameError')
  check(isinstance(outcome.exceptions,tuple)and len(outcome.exceptions)==len(children),'complete_child_count')
  check(all(a is b for a,b in zip(outcome.exceptions,children)),'exact_error_objects_and_order')
  check(outcome.__cause__ is children[0],'original_cause_identity')
  check(all(e.__traceback__ is not None for e in children),'original_tracebacks_retained')
  check(isinstance(outcome,Exception)==all(isinstance(e,Exception)for e in children),'BaseException_semantics_preserved')
 else:check(outcome is None and returned==0,'positive_exact_zero_success')
 return{'name':label,'status':'PASS','closeAttempts':1,'closeRetries':0,'originalErrorIdentitiesRetained':True,'childCount':len(children),'scope':'OWNED_ISOLATED_HELD_ENTRY_SOURCE_MOCK'}
rows=[]
rows.append(run('positive-complete-baseline',None,None,None,positive_exit=0))
for name,make in [('Exception',lambda:RuntimeError('original-primary')),('BaseException',lambda:OwnedPrimary('original-base-primary')),('SystemExit0',lambda:SystemExit(0)),('SystemExit7',lambda:SystemExit(7)),('SystemExitNone',lambda:SystemExit(None)),('KeyboardInterrupt',lambda:KeyboardInterrupt('original-interrupt'))]:
 for final_on,close_on in[(False,False),(True,False),(False,True),(True,True)]:
  rows.append(run(name+':final='+str(final_on)+':close='+str(close_on),make(),OwnedFinal('original-final-nine')if final_on else None,OwnedClose('original-owned-close')if close_on else None))
for name,f,c in [('close-alone',None,OwnedClose('close-only')),('final-nine-alone',OwnedFinal('final-only'),None),('final-plus-close',OwnedFinal('final-combined'),OwnedClose('close-combined'))]:rows.append(run(name,None,f,c))
check(nine(fixture.lstat())==expected['PRE9'],'immutable_fixture_original_nine')
print(json.dumps({'scope':'U4_AUTHOR_EXACT_INTERPRETER_ENTRY_SOURCE_MOCK','status':'PASS','controls':rows,'count':len(rows),'pythonVersion':sys.version,'pythonExecutable':sys.executable,'entrySha256':hashlib.sha256(raw).hexdigest(),'entryBytes':len(raw),'actualRunnerExecuted':False,'dockerCommands':0,'privateReads':0,'serviceCalls':0,'nativePrivate':False,'fullTask03':False},separators=(',',':')))
