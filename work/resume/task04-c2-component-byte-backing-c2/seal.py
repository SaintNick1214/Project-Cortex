import hashlib,json,os,stat,datetime
from pathlib import Path
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c2-component-byte-backing-c2';W=R/'work/resume/task04-c2-component-byte-backing-c2';T=Path('/tmp/cortex-c2-component-byte-backing-c2');S=Q/'seals.json'
rows=[]
def visit(p):
 if p==S:return
 st=p.lstat();kind='directory' if stat.S_ISDIR(st.st_mode) else 'regular' if stat.S_ISREG(st.st_mode) else 'symlink' if stat.S_ISLNK(st.st_mode) else 'fifo' if stat.S_ISFIFO(st.st_mode) else 'special'
 r={'path':str(p),'kind':kind,'mode':stat.S_IMODE(st.st_mode),'uid':st.st_uid,'gid':st.st_gid,'dev':st.st_dev,'ino':st.st_ino,'nlink':st.st_nlink,'size':st.st_size,'mtime_ns':st.st_mtime_ns,'ctime_ns':st.st_ctime_ns}
 if kind=='regular':
  h=hashlib.sha256()
  with p.open('rb') as f:
   while b:=f.read(1024*1024):h.update(b)
  r['sha256']=h.hexdigest()
 elif kind=='symlink':r['target']=os.readlink(p)
 rows.append(r)
 if kind=='directory':
  for c in sorted(p.iterdir()):visit(c)
for root in (Q,W,T):visit(root)
refs=json.loads((W/'sourcePOST.json').read_text());parts=Path('/tmp/cortex-root-storage-rescue/c2-component-backing');index=json.loads((Q/'index.json').read_text());mapping=[{'virtualPath':str(Q/r['path']),'sourcePath':str(parts/r['path']),'bytes':r['bytes'],'sha256':r['sha256']} for r in index['parts']]
S.write_text(json.dumps({'schemaVersion':1,'createdUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'ownedRoots':[str(Q),str(W),str(T)],'excludedExactSelfOnly':[str(S)],'entries':rows,'externalBackingReferences':refs,'requestedVirtualPartMapping':mapping,'qualificationReleased':False,'all122':'HELD'},indent=2)+'\n')
print(json.dumps({'seal':str(S),'sha256':hashlib.sha256(S.read_bytes()).hexdigest(),'entries':len(rows),'helperSHA256':hashlib.sha256((Q/'materialize.py').read_bytes()).hexdigest()}))
