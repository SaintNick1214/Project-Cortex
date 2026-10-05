import datetime,hashlib,json,os,stat
from pathlib import Path
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c2-byte-backing-ancestry-c2-fresh-review';W=R/'work/resume/task04-c2-byte-backing-ancestry-c2-fresh-review';T=Path('/tmp/cortex-c2-backing-ancestry-c2-fresh-review');S=Q/'seals.json';S.touch();rows=[]
def visit(p):
 if p==S:return
 s=p.lstat();k='directory' if stat.S_ISDIR(s.st_mode) else 'regular' if stat.S_ISREG(s.st_mode) else 'symlink' if stat.S_ISLNK(s.st_mode) else 'fifo' if stat.S_ISFIFO(s.st_mode) else 'special';d={'path':str(p),'kind':k,'mode':stat.S_IMODE(s.st_mode),'uid':s.st_uid,'gid':s.st_gid,'dev':s.st_dev,'ino':s.st_ino,'nlink':s.st_nlink,'size':s.st_size,'mtime_ns':s.st_mtime_ns,'ctime_ns':s.st_ctime_ns}
 if k=='regular':d['sha256']=hashlib.sha256(p.read_bytes()).hexdigest()
 elif k=='symlink':d['target']=os.readlink(p)
 rows.append(d)
 if k=='directory':
  for c in sorted(p.iterdir()):visit(c)
for p in (Q,W,T):visit(p)
refs=json.loads((W/'sourcePOST.json').read_text());index=json.loads((R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c2-component-byte-backing-c2/index.json').read_text());parts=Path('/tmp/cortex-root-storage-rescue/c2-component-backing');mapping=[{'sourcePath':str(parts/r['path']),'bytes':r['bytes'],'sha256':r['sha256']} for r in index['parts']]
S.write_text(json.dumps({'schemaVersion':1,'createdUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'ownedRoots':[str(p) for p in (Q,W,T)],'excludedExactSelfOnly':[str(S)],'entries':rows,'externalSourceReferences':refs,'externalAuthenticParts':mapping,'candidateSealSHA256':'95c3603dc9da1a2320edc248a89dd40b7831ce4e13f61fad8abd440aebb98d91','verdict':'PASS helper only','average':4.4,'all122':'HELD','qualificationReleased':False},indent=2)+'\n');print(json.dumps({'seal':str(S),'sha256':hashlib.sha256(S.read_bytes()).hexdigest(),'entries':len(rows),'reportSHA256':hashlib.sha256((Q/'report.md').read_bytes()).hexdigest()}))
# Verify exact closure after final seal write, no output files changed afterward.
expected=rows;rows=[]
for p in (Q,W,T):visit(p)
assert rows==expected
print('FINAL own exact closure PASS')
