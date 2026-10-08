from pathlib import Path
import os,stat,json,hashlib,datetime
w=Path('work/resume/task04-c7-exact-identity-repair');keys=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def held(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1;b=os.read(fd,a.st_size+1);i=lambda s:{k:str(getattr(s,'st_'+k)) for k in keys};assert i(a)==i(os.fstat(fd))==i(os.lstat(p)) and len(b)==a.st_size;return b,{'path':str(p.resolve()),'identity':i(a),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
 finally:os.close(fd)
b,pin=held(w/'recorder-v6-source-capture.json');c=json.loads(b);rows=[]
for key in ('source','beforeByteBacking'):
 e=c[key];b,z=held(Path(e['path']));assert z['identity']==e['identity']['fields'] and z['bytes']==e['bytes']==28631 and z['sha256']==e['sha256']=='6d01cf22404de0f4ccb4f57df4792dae7de84252a66f93934dfb6676dc097b5c';rows.append(z)
assert c['scope']=='STATIC_SOURCE_ONLY_NO_CHILD' and c['externalTempRoots']==[]
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_IMMUTABLE_V6_SOURCE_CAPTURE_VERIFIED_STATIC_ONLY','capture':pin,'sourceAndBacking':rows,'captureDeclaredScope':c['scope'],'limits':'Fresh fullsize/SHA/current9 source and rawbacking integrity only. Fresh independent staticreview and actual resource/controls pending; no qualification release.'}
Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-recorder-v6-source-root-inspection.json').open('x').write(json.dumps(out,indent=2)+'\n');print(out['status'])
