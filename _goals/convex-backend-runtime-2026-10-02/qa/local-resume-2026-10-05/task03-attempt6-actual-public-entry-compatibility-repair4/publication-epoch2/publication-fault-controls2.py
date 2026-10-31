"""Author SOURCE/MOCK tests of exact publisher acquire/final-close AST; no real FDs."""
import ast,stat,types
class Owned(list):
 def __init__(self,fail_at=None,primary=None):super().__init__();self.calls=0;self.fail_at=fail_at;self.primary=primary
 def append(self,value):
  self.calls+=1
  if self.calls==self.fail_at:raise self.primary
  return super().append(value)
class IO:
 def __init__(self,close_fault_at=()):self.next=100;self.live={};self.opens=[];self.closes=[];self.close_fault_at=set(close_fault_at);self.close_errors={}
 def open(self,path,*args):self.next+=1;self.live[self.next]=str(path);self.opens.append(self.next);return self.next
 def meta(self,fd):return types.SimpleNamespace(st_dev=1,st_ino=fd,st_mode=33152,st_nlink=1,st_uid=501,st_gid=20,st_size=7,st_mtime_ns=1,st_ctime_ns=1)
 def fstat(self,fd):assert fd in self.live;return self.meta(fd)
 def stat(self,path,**kwargs):return self.meta(next(fd for fd,p in self.live.items()if p==str(path)))
 def close(self,fd):
  self.closes.append(fd);assert fd in self.live,'UNKNOWN_OR_RETRY';del self.live[fd]
  if fd in self.close_fault_at:
   error=OSError('OWNED_CLOSE_'+str(fd));self.close_errors[fd]=error;raise error
 O_RDONLY=0;O_NOFOLLOW=0
def compile_exact(node,ns):exec(compile(ast.Module(body=[node],type_ignores=[]),'<exact-held-publisher-ast>','exec',dont_inherit=True),ns)
def originals(error):
 out=[];seen=set()
 def walk(e):
  if e is None or id(e)in seen:return
  seen.add(id(e));out.append(e)
  for child in getattr(e,'exceptions',()):walk(child)
  walk(getattr(e,'__cause__',None));walk(getattr(e,'__context__',None))
 walk(error);return out
def run(source):
 tree=ast.parse(source);main=next(n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='main')
 acquire=next(n for n in main.body if isinstance(n,ast.FunctionDef)and n.name=='acquire')
 outer=next(n for n in main.body if isinstance(n,ast.Try))
 controls=[]
 def environment(index,primary,closefds):
  owned=Owned(index,primary);io=IO(closefds);ns={'owned':owned,'os':io,'stat':stat,'time':types.SimpleNamespace(time_ns=lambda:100000000001),'failures':[],'final':[],'calls':[],'F':('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')}
  for name in('nine','err'):compile_exact(next(n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name==name),ns)
  ns['verify']=lambda:[{'exactNineHashEOF':True}for p in owned];compile_exact(acquire,ns)
  return owned,io,ns
 def finish(ns):exec(compile(ast.Module(body=outer.finalbody,type_ignores=[]),'<exact-held-publisher-finally>','exec',dont_inherit=True),ns)
 def check(name,fn):
  fn();controls.append({'name':name,'status':'PASS','scope':'AUTHOR_SOURCE_MOCK_ONLY'})
 def registration(index,kind,combined):
  primary=MemoryError('REGISTRATION_'+str(index))if kind=='MemoryError'else SystemExit(0 if kind=='SystemExit0'else 7)
  failedfd=100+index;owned,io,ns=environment(index,primary,[failedfd]if combined else[]);caught=None
  try:
   for i in range(1,4):ns['acquire']({'path':'/owned/'+str(i),'sha256':'unused','bytes':7})
  except BaseException as e:caught=e
  finally:finish(ns)
  assert io.opens==list(range(101,101+index))
  assert sorted(io.closes)==io.opens and len(io.closes)==len(set(io.closes))and io.live=={}
  assert any(e is primary for e in originals(caught))
  serialized=ns['err'](caught);flat=str(serialized);assert type(primary).__name__ in flat and str(primary)in flat
  if combined:
   close=io.close_errors[failedfd];assert any(e is close for e in originals(caught));assert type(close).__name__ in flat and str(close)in flat
  else:assert caught is primary
 for index in(1,2,3):
  for kind in('MemoryError','SystemExit0','SystemExit7'):
   for combined in(False,True):check('publisher.registration.'+str(index)+'.'+kind+'.close'+str(combined),lambda index=index,kind=kind,combined=combined:registration(index,kind,combined))
 def baseline():
  owned,io,ns=environment(None,None,[])
  for i in range(1,4):ns['acquire']({'path':'/owned/'+str(i),'sha256':'unused','bytes':7})
  finish(ns);assert io.closes==[101,102,103]and io.live=={}and ns['failures']==[]
 check('publisher.complete-positive-allclose',baseline)
 def closecase(fds,verify_fault):
  owned,io,ns=environment(None,None,fds)
  for i in range(1,4):ns['acquire']({'path':'/owned/'+str(i),'sha256':'unused','bytes':7})
  if verify_fault:
   def fail():raise OSError('FINAL_VERIFY')
   ns['verify']=fail
  finish(ns);assert io.closes==[101,102,103]and io.live=={}
  assert len(ns['calls'])==3 and sum(c['error']is not None for c in ns['calls'])==len(fds)
  if verify_fault:assert any('FINAL_VERIFY'in str(f)for f in ns['failures'])
 for fd in(101,102,103):
  for v in(False,True):check('publisher.final-close.'+str(fd)+'.verify'+str(v),lambda fd=fd,v=v:closecase([fd],v))
 check('publisher.all-close-errors-with-final-verify',lambda:closecase([101,102,103],True))
 return{'scope':'AUTHOR_PUBLISHER_SOURCE_MOCK_CONTROLS_ONLY','status':'PASS','count':len(controls),'controls':controls,'candidateRuntimeInvoked':False,'Docker':False,'private':False,'sourceEligibility':False}
