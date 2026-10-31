"""First prospective finite public source closure, collected only after source writers stop."""
from pathlib import Path
import hashlib,importlib.util,json,os,resource,stat,time,types
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';Q=QA/'task03-local-native-attempt6-2026-10-06';P=QA/'local-resume-2026-10-05/task03-attempt6-integrated-preparation'
F=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {k:str(getattr(s,'st_'+k))for k in F}
def write(path,value):
 raw=(json.dumps(value,indent=2)+'\n').encode();fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb')as f:f.write(raw);f.flush();os.fsync(f.fileno())
 return hashlib.sha256(raw).hexdigest()
def held(paths):
 rows=[];fds=[];total=0
 try:
  # Capture and hold ALL source PRE/OPEN descriptors before their first content qualification.
  for path in paths:
   before=os.lstat(path);assert stat.S_ISREG(before.st_mode)and before.st_nlink==1 and before.st_uid==501 and before.st_gid==20 and path.resolve()==path
   fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);fds.append((path,fd,before));assert identity(before)==identity(os.fstat(fd))
  for path,fd,before in fds:
   raw=bytearray()
   while block:=os.read(fd,65536):raw.extend(block);assert len(raw)<=16777216
   assert len(raw)==before.st_size;post=os.fstat(fd);pathpost=os.lstat(path)
   assert identity(before)==identity(post)==identity(pathpost)
   total+=len(raw);assert total<=64*1024*1024
   rows.append({'path':str(path.relative_to(R)),'PRE':identity(before),'OPEN':identity(before),'POST':identity(post),'pathPOST':identity(pathpost),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'fullEOF':True})
  for path,fd,before in fds:assert identity(before)==identity(os.fstat(fd))==identity(os.lstat(path))
 finally:
  for path,fd,before in fds:os.close(fd)
 return rows,total

def main():
 stop=json.loads((P/'source-writers-stopped.json').read_text());assert stop['sourceWriters']=='STOPPED'and stop['privateAccess']==0
 soft,hard=resource.getrlimit(resource.RLIMIT_NOFILE);resource.setrlimit(resource.RLIMIT_NOFILE,(min(hard,max(soft,4096)),hard))
 public=[Q/'coordinate-source'/name for name in ('task03-attempt5-coordinate-common.py','task03-attempt5-linux-public-transfer.py','task03-attempt5-public-coordinate.py','public-recipe-binding.json')]
 rows,total=held(public);write(Q/'coordinate-source/source-receipt-manifest.json',{'scope':'PUBLIC_RECIPE_COMPLETE_SOURCE_BUNDLE_ONLY','status':'PROSPECTIVE_SOURCE_NOT_ACCEPTANCE','files':rows,'bytes':total,'manifestSelfExcluded':True,'privateReads':0})
 gpath=Q/'integrated/source-gates.py';pre=os.lstat(gpath);fd=os.open(gpath,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert identity(pre)==identity(os.fstat(fd));raw=bytearray()
  while block:=os.read(fd,65536):raw.extend(block);assert len(raw)<=16777216
  assert len(raw)==pre.st_size and identity(pre)==identity(os.fstat(fd))==identity(os.lstat(gpath))
  G=types.ModuleType('operative_closure_definition');G.__file__=str(gpath);G.__package__=''
  exec(compile(raw,str(gpath),'exec',dont_inherit=True),G.__dict__)
  assert identity(pre)==identity(os.fstat(fd))==identity(os.lstat(gpath))
 finally:os.close(fd)
 paths=G.expected_source_paths();assert len(paths)<=4096
 rows,total=held(paths);value={'scope':'FIRST_PROSPECTIVE_COMPLETE_OPERATIVE_SOURCE_CLOSURE_ONLY','status':'READY_FOR_FIRST_INDEPENDENT_REVIEW','sourceWriters':'STOPPED','files':rows,'bytes':total,'copyCeilingBytes':64*1024*1024,'candidateMembers':1907,'publicCopiedFiles':1914,'privateAccess':0,'externalEffects':0,'historicalCustodyRepaired':False,'selfAndDynamicIndependentDataExcludedFromCircularMembership':True,'observedUnixNs':str(time.time_ns())}
 sha=write(P/'operative-source-manifest.json',value)
 write(P/'source-closure-handoff.json',{'status':value['status'],'manifest':str(P/'operative-source-manifest.json'),'manifestSha256':sha,'members':len(rows),'bytes':total,'sourceWriters':'STOPPED','privateAccess':0,'sourceGate':'REQUIRES_FRESH_INDEPENDENT_REVIEW','goal':'OPEN'})
 print(json.dumps({'status':value['status'],'manifestSha256':sha,'members':len(rows),'bytes':total,'privateAccess':0}))
if __name__=='__main__':main()
