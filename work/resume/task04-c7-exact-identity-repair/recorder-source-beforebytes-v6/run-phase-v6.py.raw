"""Owned C7 controls only. Fresh held9 source reads; immutable byte reuse only.
Linux pidfds address positively bound processes, never a numeric process group.
One 120-second absolute deadline includes preparation, body and cleanup.
"""
from pathlib import Path
import os,sys,stat,json,gzip,hashlib,subprocess,datetime,time,signal,importlib.util
W=Path('/workspace/Project-Cortex/work/resume/task04-c7-exact-identity-repair')
T=Path('/dev/shm/cortex-native-c7-exact-identity-repair')
N=Path('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node')
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
PHASES=('refresh-bindings4','rebound-controls2','rebound-controls3','parser-controls3')

def ident(s):
 return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{key:str(getattr(s,'st_'+key)) for key in FIELDS}}
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def error(e):return {'name':type(e).__name__,'message':str(e)}
def pairs(rows):
 result={}
 for key,value in rows:
  if key in result:raise ValueError('OWN_DUPLICATE_JSON_KEY')
  result[key]=value
 return result
def load(raw):return json.loads(raw,object_pairs_hook=pairs)
def safe_pid(value,zero=False):
 if type(value) is not int or value<0 or (not zero and value==0) or value>9007199254740991:raise ValueError('OWN_PID_SCHEMA')
 return value
class BindingConflict(RuntimeError):pass
class Interrupted(RuntimeError):pass
class Deadline(RuntimeError):pass

class Recorder:
 def __init__(self,phase):
  self.phase=phase;self.label='v6-'+phase;self.started=utc();self.begin=time.monotonic();self.deadline=self.begin+120
  self.out=T/('execution-'+self.label);self.held=[];self.pending_source={};self.members={};self.primary=None;self.secondary=[]
  self.child=None;self.creation_attempted=False;self.creation_confirmed=False;self.reaped=False;self.in_cleanup=False;self.initial=None;self.owner=None;self.binding=None;self.code=None;self.timeout=False;self.conflict=False
  self.censuses=[];self.signals=[];self.final_census=None;self.source_post=[];self.raws=[];self.fd_closes=[]
  self.resource_pre=None;self.resource_before_child=None;self.resource_post=None;self.reserve=None;self.reserve_required=None
  self.preflight_hold=None;self.reuse={};self.argv=None;self.env=None;self.rows=[];self.handlers={};self.interrupted=None
 def fence(self):
  if self.interrupted is not None and not self.in_cleanup:raise Interrupted('OWN_RECORDER_DEFERRED_SIGNAL_'+str(self.interrupted))
  if time.monotonic()>=self.deadline:raise Deadline('OWN_ABSOLUTE_120S_DEADLINE')
 def resources(self):
  return {name:Path('/sys/fs/cgroup',name).read_text() for name in ('memory.current','memory.max','memory.stat','memory.events')}
 def write(self,name,data):
  path=W/(self.label+'-'+name+'.json')
  with path.open('x') as target:json.dump(data,target,indent=2);target.write('\n');target.flush();os.fsync(target.fileno())
 def held_bytes(self,path,cap=1048576):
  path=Path(path);fd=None
  try:
   s=os.lstat(path);fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);a=os.fstat(fd)
   if not stat.S_ISREG(a.st_mode) or a.st_nlink!=1 or ident(s)!=ident(a) or a.st_size>cap:raise ValueError('OWN_HELD_FILE_BINDING')
   blocks=[];count=0
   while block:=os.read(fd,65536):
    count+=len(block)
    if count>cap:raise ValueError('OWN_HELD_FILE_CAP')
    blocks.append(block)
   if count!=a.st_size or ident(a)!=ident(os.fstat(fd)) or ident(a)!=ident(os.lstat(path)):raise ValueError('OWN_HELD_FILE_DRIFT')
   return b''.join(blocks),ident(a)
  finally:
   if fd is not None:os.close(fd)
 def raw_backing(self,name,raw):
  path=self.out/(name+'-'+hashlib.sha256(raw).hexdigest()+'.raw')
  if not path.exists():
   with path.open('xb') as target:target.write(raw);target.flush();os.fsync(target.fileno())
   os.chmod(path,0o600)
  actual,identity=self.held_bytes(path)
  if actual!=raw:raise ValueError('OWN_RAW_BACKING_DRIFT')
  return {'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'identity':identity}
 def setup_reuse(self):
  for prior in sorted(W.glob('*-PRE.json')):
   raw,_=self.held_bytes(prior,2097152);pre=load(raw)
   for row in pre.get('sourceTools',[]):
    backing=row.get('beforeByteBacking',{})
    if backing.get('identity',{}).get('schema')=='FS_IDENTITY_DECIMAL_V1':self.reuse.setdefault(row['sha256'],(row['bytes'],backing))
 def verify_backing(self,backing,digest,size):
  if type(size)is not int or size<0 or size>9007199254740991 or type(backing.get('bytes'))is not int or backing['bytes']<0 or backing.get('encoding')!='GZIP_EXACT_PREIMAGE' or type(digest)is not str or len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest):raise ValueError('OWN_BACKING_SCHEMA')
  path=Path(backing['path']);fd=None
  try:
   s=os.lstat(path);fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);a=os.fstat(fd)
   if not stat.S_ISREG(a.st_mode) or a.st_nlink!=1 or ident(s)!=ident(a) or ident(a)!=backing['identity']:raise ValueError('OWN_BACKING_BINDING')
   encoded=hashlib.sha256();encoded_size=0
   while block:=os.read(fd,1048576):self.fence();encoded.update(block);encoded_size+=len(block)
   if encoded.hexdigest()!=backing['sha256'] or encoded_size!=backing['bytes']:raise ValueError('OWN_BACKING_ENCODED_DRIFT')
   os.lseek(fd,0,os.SEEK_SET);decoded=hashlib.sha256();decoded_size=0
   with os.fdopen(os.dup(fd),'rb') as source:
    with gzip.GzipFile(fileobj=source,mode='rb') as stream:
     while block:=stream.read(1048576):
      self.fence();decoded.update(block);decoded_size+=len(block)
      if decoded_size>size:raise ValueError('OWN_BACKING_DECODE_CAP')
   if decoded.hexdigest()!=digest or decoded_size!=size or ident(a)!=ident(os.fstat(fd)) or ident(a)!=ident(os.lstat(path)):raise ValueError('OWN_BACKING_DECODED_DRIFT')
   return {**backing,'reuseRole':'VERIFIED_IMMUTABLE_BYTES_ONLY_FRESH_SOURCE_HELD9_EACH_EXECUTION'}
  finally:
   if fd is not None:os.close(fd)
 def capture(self,path):
  self.fence();path=Path(path);s=os.lstat(path);fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
  self.pending_source[fd]={'path':str(path),'stage':'OPENED'};a=os.fstat(fd);self.pending_source[fd].update(identity=ident(a),pathPREIdentity=ident(s),stage='HELD_PRE_IDENTITY')
  if not stat.S_ISREG(a.st_mode) or a.st_nlink!=1 or ident(s)!=ident(a):raise ValueError('OWN_SOURCE_BINDING')
  h=hashlib.sha256();count=0
  while block:=os.read(fd,1048576):self.fence();h.update(block);count+=len(block)
  if ident(a)!=ident(os.fstat(fd)) or ident(a)!=ident(os.lstat(path)) or count!=a.st_size:raise ValueError('OWN_SOURCE_DRIFT')
  digest=h.hexdigest();self.pending_source[fd].update(bytes=count,sha256=digest,stage='FULL_SOURCE_HASH_BEFORE_BACKING')
  if digest in self.reuse:
   size,backing=self.reuse[digest]
   if size!=count:raise ValueError('OWN_REUSE_SOURCE_SIZE')
   before=self.verify_backing(backing,digest,count)
  else:
   back=self.out/(str(len(self.held))+'.gz');os.lseek(fd,0,os.SEEK_SET);again=hashlib.sha256();again_size=0
   with back.open('xb') as target:
    with gzip.GzipFile(filename='',fileobj=target,mode='wb',mtime=0) as compressed:
     while block:=os.read(fd,1048576):self.fence();again.update(block);again_size+=len(block);compressed.write(block)
    target.flush();os.fsync(target.fileno())
   if again.hexdigest()!=digest or again_size!=count or ident(a)!=ident(os.fstat(fd)) or ident(a)!=ident(os.lstat(path)):raise ValueError('OWN_SOURCE_BACKING_CAPTURE_DRIFT')
   os.chmod(back,0o600)
   encoded_fd=None
   try:
    encoded_fd=os.open(back,os.O_RDONLY|os.O_NOFOLLOW);encoded_pre=os.fstat(encoded_fd);eh=hashlib.sha256();encoded_size=0
    while block:=os.read(encoded_fd,1048576):self.fence();eh.update(block);encoded_size+=len(block)
    if ident(encoded_pre)!=ident(os.fstat(encoded_fd)) or ident(encoded_pre)!=ident(os.lstat(back)):raise ValueError('OWN_NEW_BACKING_DRIFT')
   finally:
    if encoded_fd is not None:os.close(encoded_fd)
   before={'path':str(back),'bytes':encoded_size,'sha256':eh.hexdigest(),'identity':ident(encoded_pre),'encoding':'GZIP_EXACT_PREIMAGE'}
   self.verify_backing(before,digest,count);self.reuse[digest]=(count,before)
  if ident(a)!=ident(os.fstat(fd)) or ident(a)!=ident(os.lstat(path)):raise ValueError('OWN_SOURCE_AFTER_BACKING_DRIFT')
  row={'path':str(path),'bytes':count,'sha256':digest,'identity':ident(a),'beforeByteBacking':before}
  self.held.append((fd,row));self.pending_source.pop(fd);return row
 def proc_parse(self,raw,pid):
  text=raw.decode('ascii');fields=text[text.rindex(')')+2:].split()
  if len(fields)<50 or int(text.split(' ',1)[0])!=pid:raise BindingConflict('OWN_PROC_PID_SCHEMA')
  start=fields[19]
  if not start.isdecimal() or (len(start)>1 and start.startswith('0')):raise BindingConflict('OWN_STARTTIME_SCHEMA')
  return {'pid':safe_pid(pid),'ppid':safe_pid(int(fields[1]),True),'pgid':safe_pid(int(fields[2]),True),'sid':safe_pid(int(fields[3]),True),'state':fields[0],'startTime':start,'kernelExitCodeRaw':fields[49]}
 def process_pin(self,pid,pgid=None,argv=False):
  """One held proc FD around pidfd acquisition; no filter/reread pathname race."""
  safe_pid(pid);path=Path('/proc',str(pid),'stat');fd=None;pidfd=None
  try:
   s=os.lstat(path);fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);a=os.fstat(fd);first=os.read(fd,65536)
   if os.read(fd,1):raise BindingConflict('OWN_PROC_CAP')
   row=self.proc_parse(first,pid)
   if pgid is not None and row['pgid']!=pgid:return None
   pidfd=os.pidfd_open(pid,0);os.lseek(fd,0,os.SEEK_SET);second=os.read(fd,65536)
   if os.read(fd,1):raise BindingConflict('OWN_PROC_CAP')
   final=self.proc_parse(second,pid)
   keys=('pid','ppid','pgid','sid','startTime')
   if any(row[key]!=final[key] for key in keys) or ident(s)!=ident(a) or ident(a)!=ident(os.fstat(fd)) or ident(a)!=ident(os.lstat(path)):raise BindingConflict('OWN_PROC_STABLE_BINDING')
   final['sourceIdentity']=ident(a);final['sourceRole']='PROC_STAT_NATIVE_ZERO_SIZE_RAW_PAYLOAD_SEPARATE'
   final['rawBeforeByteBacking']=self.raw_backing('proc-'+str(pid)+'-first',first)
   final['rawAfterByteBacking']=self.raw_backing('proc-'+str(pid)+'-second',second)
   if argv:
    cmdpath=Path('/proc',str(pid),'cmdline');cmdfd=None
    try:
     cmdfd=os.open(cmdpath,os.O_RDONLY|os.O_NOFOLLOW);cmdpre=os.fstat(cmdfd);cmd=os.read(cmdfd,65536)
     if os.read(cmdfd,1) or ident(cmdpre)!=ident(os.fstat(cmdfd)) or ident(cmdpre)!=ident(os.lstat(cmdpath)):raise BindingConflict('OWN_CMDLINE_BINDING')
    finally:
     if cmdfd is not None:os.close(cmdfd)
    os.lseek(fd,0,os.SEEK_SET);after_cmd=self.proc_parse(os.read(fd,65536),pid)
    if any(final[key]!=after_cmd[key] for key in keys):raise BindingConflict('OWN_PROC_CMDLINE_REBIND')
    final['rawArgvHex']=cmd.hex();final['argv']=[arg.decode() for arg in cmd.rstrip(b'\0').split(b'\0')] if cmd else []
    final['cmdlineBeforeByteBacking']=self.raw_backing('cmdline-'+str(pid),cmd)
   result=(pidfd,final);pidfd=None;return result
  finally:
   if fd is not None:os.close(fd)
   if pidfd is not None:os.close(pidfd)
 def bind_initial(self):
  pin=self.process_pin(self.child.pid,argv=True)
  if pin is None:raise BindingConflict('OWN_INITIAL_BINDING_ABSENT')
  fd,row=pin;self.members[(row['pid'],row['startTime'])]=(fd,row)
  if row['pid']!=self.child.pid or row['ppid']!=self.owner['pid'] or row['pgid']!=self.child.pid or row['sid']!=self.child.pid or row['argv']!=self.argv:raise BindingConflict('OWN_INITIAL_PROCESS_RELATION')
  self.initial=row;self.binding={'owner':self.owner,'initial':row,'argv':row['argv'],'rawArgvHex':row['rawArgvHex'],'pgid':row['pgid'],'startTime':row['startTime'],'signals':'LINUX_PIDFD_ONLY_NEVER_NUMERIC_KILLPG'}
  self.write('group-PRE',self.binding)
 def census(self):
  if self.initial is None:raise BindingConflict('OWN_CENSUS_WITHOUT_BOUND_LEADER')
  pgid=self.initial['pgid'];names=[name for name in os.listdir('/proc') if name.isdecimal()]
  if len(names)>4096:raise BindingConflict('OWN_PROC_ENUM_CAP')
  acquired=[];rows=[]
  try:
   # Observe the original leader regardless of PGID, so a rebind cannot hide
   # by moving outside the filter. Missing leader grants no new member authority.
   try:leader_pin=self.process_pin(self.initial['pid'])
   except (FileNotFoundError,ProcessLookupError):leader_pin=None
   leader_live=False
   if leader_pin:
    fd,leader=leader_pin;acquired.append(fd)
    if leader['startTime']!=self.initial['startTime'] or leader['pgid']!=pgid or leader['sid']!=self.initial['sid']:raise BindingConflict('OWN_LEADER_REBIND')
    leader_live=leader['state']!='Z'
   elif not self.reaped:raise BindingConflict('OWN_UNEXPLAINED_UNREAPED_LEADER_ABSENCE')
   # Independently inspect EVERY retained member, without the group filter.
   # A missing pathname is terminal only if the retained kernel pidfd is ready.
   observed_retained={}
   import select
   for key,(retained_fd,original) in list(self.members.items()):
    try:retained_pin=self.process_pin(original['pid'])
    except (FileNotFoundError,ProcessLookupError):retained_pin=None
    if retained_pin is None:
     poller=select.poll();poller.register(retained_fd,select.POLLIN)
     if not poller.poll(0):raise BindingConflict('OWN_RETAINED_MEMBER_ABSENCE_NOT_TERMINAL')
     observed_retained[key]={**original,'state':'TERMINAL_PIDFD_READY','terminal':True,'provenance':'RETAINED_KERNEL_PIDFD_TERMINAL'}
     continue
    retained_current_fd,current=retained_pin;acquired.append(retained_current_fd)
    if current['startTime']!=original['startTime'] or current['pgid']!=pgid or current['sid']!=self.initial['sid']:raise BindingConflict('OWN_RETAINED_MEMBER_ESCAPE_OR_REBIND')
    current['provenance']='EXACT_PREVIOUSLY_PIDFD_BOUND_MEMBER';observed_retained[key]=current
   for name in names:
    self.fence()
    try:pin=self.process_pin(safe_pid(int(name)),pgid=pgid)
    except (FileNotFoundError,ProcessLookupError):continue
    if pin is None:continue
    fd,row=pin;acquired.append(fd)
    if row['sid']!=self.initial['sid']:raise BindingConflict('OWN_MEMBER_SESSION_REBIND')
    key=(row['pid'],row['startTime'])
    if key not in self.members and not leader_live:raise BindingConflict('OWN_NEW_MEMBER_WITHOUT_LIVE_BOUND_LEADER')
    if key not in self.members:self.members[key]=(fd,row);acquired.remove(fd)
    row['provenance']='SAME_SESSION_GROUP_OBSERVED_WITH_LIVE_BOUND_LEADER' if leader_live else 'EXACT_PREVIOUSLY_PIDFD_BOUND_MEMBER'
    observed_retained[key]=row
   rows=list(observed_retained.values())
   if len(rows)>6:raise BindingConflict('OWN_GROUP_CAP')
   result={'utc':utc(),'rows':rows,'effectfulRows':[row for row in rows if row['state']!='Z' and not row.get('terminal')],'complete':True}
   self.censuses.append(result);return result
  finally:
   for fd in acquired:os.close(fd)
 def send(self,row,signum):
  if self.conflict:raise BindingConflict('OWN_SIGNAL_PROHIBITED_AFTER_IDENTITY_UNCERTAINTY')
  key=(row['pid'],row['startTime'])
  if key not in self.members:raise BindingConflict('OWN_SIGNAL_UNBOUND_MEMBER')
  fd,original=self.members[key]
  try:current_pin=self.process_pin(row['pid'])
  except (FileNotFoundError,ProcessLookupError):
   self.signals.append({'pid':row['pid'],'startTime':row['startTime'],'signal':signum,'result':'DISAPPEARED_NO_SIGNAL'});return
  current_fd,current=current_pin
  try:
   if current['startTime']!=original['startTime'] or current['pgid']!=self.initial['pgid'] or current['sid']!=self.initial['sid']:raise BindingConflict('OWN_SIGNAL_REBIND')
   if current['state']=='Z':return
   # The kernel descriptor, rather than a reused numeric PID or PGID, is the target.
   try:signal.pidfd_send_signal(fd,signum,None,0);result='PIDFD_SIGNAL_SENT'
   except ProcessLookupError:result='DISAPPEARED_NO_SIGNAL'
   self.signals.append({'pid':row['pid'],'startTime':row['startTime'],'signal':signum,'result':result,'freshBinding':current})
  finally:os.close(current_fd)
 def cleanup(self):
  if self.child is None:
   self.final_census={'utc':utc(),'rows':[],'effectfulRows':None if self.creation_attempted else [],'complete':not self.creation_attempted,'scope':'CREATION_OUTCOME_UNKNOWN' if self.creation_attempted else 'NO_CREATION_ATTEMPT'};return
  # A failed initial syscall can be retried only as observation of the same
  # unreaped Popen-owned child, never as a second execution or deadline reset.
  if self.initial is None and not self.conflict:
   try:self.bind_initial()
   except BindingConflict as e:self.conflict=True;self.secondary.append({'stage':'RECOVERY_FIRST_BIND','error':error(e)})
   except BaseException as e:self.secondary.append({'stage':'RECOVERY_FIRST_BIND','error':error(e)})
  if self.initial is None or self.conflict:
   self.final_census={'utc':utc(),'rows':[],'effectfulRows':None,'complete':False,'scope':'IDENTITY_UNPROVED_NO_SIGNALS'}
   try:self.code=self.child.wait(timeout=max(0.001,self.deadline-time.monotonic()));self.reaped=True
   except BaseException as e:self.secondary.append({'stage':'UNBOUND_CHILD_WAIT','error':error(e)})
   return
  while True:
   try:observed=self.census()
   except BindingConflict as e:
    self.conflict=True;self.secondary.append({'stage':'CLEANUP_CENSUS','error':error(e)});self.final_census={'utc':utc(),'rows':[],'effectfulRows':None,'complete':False};break
   except BaseException as e:
    self.secondary.append({'stage':'CLEANUP_CENSUS','error':error(e)});self.final_census={'utc':utc(),'rows':[],'effectfulRows':None,'complete':False};break
   self.final_census=observed
   if not observed['effectfulRows']:break
   for row in observed['effectfulRows']:
    try:self.send(row,signal.SIGKILL)
    except BindingConflict as e:self.conflict=True;self.secondary.append({'stage':'CLEANUP_SIGNAL','error':error(e)});break
    except BaseException as e:self.secondary.append({'stage':'CLEANUP_SIGNAL','error':error(e)})
   if self.conflict:break
   if time.monotonic()>=self.deadline:
    self.secondary.append({'stage':'CLEANUP_DEADLINE','error':{'name':'Deadline','message':'OWN_POST_SIGNAL_QUIESCENCE_UNPROVED'}});break
   time.sleep(min(0.01,max(0,self.deadline-time.monotonic())))
  try:self.code=self.child.wait(timeout=max(0.001,self.deadline-time.monotonic()));self.reaped=True
  except BaseException as e:self.secondary.append({'stage':'CHILD_REAP','error':error(e)})
  # The last observation is explicitly after signals and reap; no old census
  # is promoted to a cleanup-complete proof.
  if not self.conflict:
   try:self.final_census=self.census()
   except BaseException as e:
    self.secondary.append({'stage':'FINAL_POST_REAP_CENSUS','error':error(e)});self.final_census={'utc':utc(),'rows':[],'effectfulRows':None,'complete':False}
 def source_POST(self):
  for fd,row in self.held:
   try:
    a=os.fstat(fd);os.lseek(fd,0,os.SEEK_SET);h=hashlib.sha256();count=0
    while block:=os.read(fd,1048576):self.fence();h.update(block);count+=len(block)
    final=os.fstat(fd);path=os.lstat(row['path'])
    self.source_post.append({'path':row['path'],'identity':ident(a),'bytes':count,'sha256':h.hexdigest(),'complete':True,'equal':row['identity']==ident(a)==ident(final)==ident(path) and count==row['bytes'] and h.hexdigest()==row['sha256']})
   except BaseException as e:self.source_post.append({'path':row['path'],'complete':False,'equal':False,'error':error(e)})
   finally:
    try:os.close(fd);self.fd_closes.append({'role':'source','path':row['path'],'complete':True})
    except BaseException as e:self.fd_closes.append({'role':'source','path':row['path'],'complete':False,'error':error(e)})
  for fd,row in self.pending_source.items():
   try:
    a=os.fstat(fd);os.lseek(fd,0,os.SEEK_SET);h=hashlib.sha256();count=0
    while block:=os.read(fd,1048576):self.fence();h.update(block);count+=len(block)
    final=os.fstat(fd);path=os.lstat(row['path'])
    pre=row.get('identity');digest=row.get('sha256')
    self.source_post.append({'path':row['path'],'role':'FAILED_PRE_SOURCE_FRESH_POST','preStage':row['stage'],'identity':ident(a),'bytes':count,'sha256':h.hexdigest(),'complete':True,'equal':pre is not None and pre==ident(a)==ident(final)==ident(path) and digest is not None and digest==h.hexdigest() and row.get('bytes')==count})
   except BaseException as e:self.source_post.append({'path':row['path'],'role':'FAILED_PRE_SOURCE_FRESH_POST','preStage':row['stage'],'complete':False,'equal':False,'error':error(e)})
   try:os.close(fd);self.fd_closes.append({'role':'failed-PRE-source','path':row['path'],'complete':True})
   except BaseException as e:self.fd_closes.append({'role':'failed-PRE-source','path':row['path'],'complete':False,'error':error(e)})
  for fd,row in self.members.values():
   try:os.close(fd);self.fd_closes.append({'role':'pidfd','pid':row['pid'],'startTime':row['startTime'],'complete':True})
   except BaseException as e:self.fd_closes.append({'role':'pidfd','pid':row['pid'],'complete':False,'error':error(e)})
 def raw_POST(self):
  for channel in ('stdout','stderr'):
   path=W/(self.label+'.'+channel);fd=None
   try:
    if not path.exists():self.raws.append({'path':str(path),'created':False,'role':'NO_CHILD_OUTPUT'});continue
    s=os.lstat(path);fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);a=os.fstat(fd);h=hashlib.sha256();count=0
    while block:=os.read(fd,1048576):self.fence();h.update(block);count+=len(block)
    if ident(s)!=ident(a) or ident(a)!=ident(os.fstat(fd)) or ident(a)!=ident(os.lstat(path)) or count!=a.st_size:raise ValueError('OWN_RAW_OUTPUT_DRIFT')
    self.raws.append({'path':str(path),'bytes':count,'sha256':h.hexdigest(),'identity':ident(a),'complete':True})
   except BaseException as e:self.raws.append({'path':str(path),'complete':False,'error':error(e)})
   finally:
    if fd is not None:os.close(fd)
 def interrupted_handler(self,signum,frame):
  # Handlers never raise asynchronously: syscall return/FD registration and
  # Popen ownership assignment cannot be interrupted between bytecodes.
  self.interrupted=signum
 def run(self):
  try:
   self.out.mkdir(mode=0o700,exist_ok=False)
   for signum in (signal.SIGTERM,signal.SIGINT):self.handlers[signum]=signal.signal(signum,self.interrupted_handler)
   self.resource_pre=self.resources();self.setup_reuse()
   python_phase=self.phase.startswith(('refresh-bindings','parser-controls'))
   program=W/(self.phase+('.py' if python_phase else '.mjs'))
   sources=sorted(path for path in (W/'candidate').iterdir() if path.is_file() and path.suffix in ('.mjs','.cjs','.py'))+[program,Path(__file__),N,Path(sys.executable).resolve()]
   if python_phase:sources.append(W/'stream_json.py')
   if self.phase.startswith('rebound-controls'):
    sources+=sorted(path for path in (W/'candidate').iterdir() if path.suffix=='.json')
    sources+=sorted(path for path in T.iterdir() if path.suffix=='.json')
   for path in sources:self.rows.append(self.capture(path))
   self.argv=[str(Path(sys.executable).resolve()),'-u',str(program)] if python_phase else [str(N),'--max-old-space-size=256','--experimental-vm-modules',str(program)]
   self.env={'PATH':str(N.parent)+':/usr/bin:/bin','TMPDIR':str(T/'tmp'),'PYTHONDONTWRITEBYTECODE':'1'}
   self.write('PRE',{'utc':utc(),'argv':self.argv,'cwd':str(W),'env':self.env,'sourceTools':self.rows,'resourcePRE':self.resource_pre,'deadlineSeconds':120,'absoluteMonotonicDeadline':self.deadline,'phase':self.phase,'scope':'OWN_C7_CONTROLS_OR_NEW_SOURCE_BINDING_ONLY'})
   self.resource_before_child=self.resources();maximum=self.resource_before_child['memory.max'].strip();current=self.resource_before_child['memory.current'].strip()
   self.reserve_required=(128 if python_phase else 512)*1048576
   if not current.isdecimal() or (maximum!='max' and not maximum.isdecimal()):raise ValueError('OWN_CGROUP_NUMERIC_SCHEMA')
   if maximum=='max':self.preflight_hold='UNBOUNDED_CGROUP_MAX_NO_MEASURABLE_LITERAL_RESERVE'
   else:
    self.reserve=int(maximum)-int(current)
    if self.reserve<self.reserve_required:self.preflight_hold='INSUFFICIENT_MEASURED_LITERAL_RESERVE'
   if not hasattr(os,'pidfd_open') or not hasattr(signal,'pidfd_send_signal'):self.preflight_hold='LINUX_PIDFD_CAPABILITY_REQUIRED'
   if self.preflight_hold:return
   owner_fd,self.owner=self.process_pin(safe_pid(os.getpid()),argv=True);os.close(owner_fd)
   self.fence()
   with (W/(self.label+'.stdout')).open('xb') as stdout,(W/(self.label+'.stderr')).open('xb') as stderr:
    # Popen and every operation thereafter remain inside the lifetime finally.
    self.creation_attempted=True
    self.child=subprocess.Popen(self.argv,cwd=W,env=self.env,stdout=stdout,stderr=stderr,start_new_session=True)
    self.creation_confirmed=True
    self.bind_initial()
    self.fence()
    while True:
     self.fence();self.census();code=self.child.poll()
     if code is not None:self.code=code;self.reaped=True;break
     if time.monotonic()>=self.deadline-5:self.timeout=True;break
     time.sleep(min(0.02,max(0,self.deadline-5-time.monotonic())))
  except BindingConflict as e:self.primary=error(e);self.conflict=True
  except BaseException as e:self.primary=error(e)
  finally:
   self.in_cleanup=True
   # Ignore a repeated handled signal during cleanup; one deadline is retained.
   for signum in self.handlers:signal.signal(signum,signal.SIG_IGN)
   try:self.cleanup()
   except BaseException as e:self.secondary.append({'stage':'CLEANUP_UNEXPECTED','error':error(e)});self.final_census={'utc':utc(),'rows':[],'effectfulRows':None,'complete':False}
   try:self.source_POST()
   except BaseException as e:self.secondary.append({'stage':'SOURCE_POST_UNEXPECTED','error':error(e)})
   try:self.raw_POST()
   except BaseException as e:self.secondary.append({'stage':'RAW_POST_UNEXPECTED','error':error(e)})
   try:self.resource_post=self.resources()
   except BaseException as e:self.secondary.append({'stage':'RESOURCE_POST','error':error(e)})
   for signum,handler in self.handlers.items():signal.signal(signum,handler)
   source_equal=bool(self.rows) and len(self.source_post)==len(self.rows) and all(row.get('equal') is True for row in self.source_post)
   group_empty=self.final_census is not None and self.final_census.get('complete') is True and self.final_census.get('effectfulRows')==[]
   receipt={'kind':'OWN_C7_V6_EXECUTION_OR_EXPLICIT_NO_CHILD','utcStart':self.started,'utcEnd':utc(),'phase':self.phase,'argv':self.argv,'cwd':str(W),'env':self.env,'deadlineSeconds':120,'absoluteMonotonicDeadline':self.deadline,'elapsedSeconds':time.monotonic()-self.begin,'finishedWithinDeadline':time.monotonic()<=self.deadline,'childExecuted':self.child is not None,'creationAttempted':self.creation_attempted,'creationOwnershipConfirmed':self.creation_confirmed,'positivelyReaped':self.reaped,'actualExit':self.code,'signal':-self.code if type(self.code)is int and self.code<0 else None,'timeout':self.timeout,'handledRecorderSignal':self.interrupted,'primary':self.primary,'secondary':self.secondary,'preflightHold':self.preflight_hold,'requiredLiteralReserveBytes':self.reserve_required,'observedLiteralReserveBytes':self.reserve,'resourcePRE':self.resource_pre,'resourceBeforeChild':self.resource_before_child,'resourcePOST':self.resource_post,'groupBinding':self.binding,'groupObservations':self.censuses,'signals':self.signals,'finalGroupCensus':self.final_census,'groupEmpty':group_empty,'sourceToolPRE':self.rows,'failedPRESourceDescriptors':list(self.pending_source.values()),'sourceToolPOST':self.source_post,'sourceToolsExactEqual':source_equal,'FDCloses':self.fd_closes,'raws':self.raws,'original122':'HELD','originalWhole120':'UNEXECUTED_HELD','rootApproval':'ABSENT_NOT_CREATED'}
   receipt['completeOwnedEvidence']=self.child is not None and self.primary is None and not self.secondary and source_equal and group_empty and receipt['finishedWithinDeadline'] and all(row.get('complete') is True for row in self.raws) and all(row['complete'] for row in self.fd_closes)
   try:self.write('receipt',receipt)
   except BaseException as e:
    print(json.dumps({'kind':'OWN_RECEIPT_WRITE_FAILED','primary':self.primary,'secondary':self.secondary,'receiptWriteError':error(e),'childExecuted':self.child is not None,'groupEmpty':group_empty,'sourceToolsExactEqual':source_equal,'originals':'HELD'}),file=sys.stderr)
   print(json.dumps({key:value for key,value in receipt.items() if key not in ('resourcePRE','resourceBeforeChild','resourcePOST','sourceToolPOST','groupObservations','FDCloses')}))
  return 78 if self.preflight_hold else 1 if self.primary or self.secondary or self.timeout else 0

if __name__=='__main__':
 if len(sys.argv)!=2 or sys.argv[1] not in PHASES:raise SystemExit('OWN_PHASE_ONLY_NO_CHILD')
 recorder=Recorder(sys.argv[1]);result=recorder.run();raise SystemExit(78 if recorder.preflight_hold else result or 0)
