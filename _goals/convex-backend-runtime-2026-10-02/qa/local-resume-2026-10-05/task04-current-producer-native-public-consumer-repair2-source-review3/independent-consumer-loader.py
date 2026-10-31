import os,stat,time,json,hashlib,pathlib
O=pathlib.Path("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair2-source-review3")
N=O.parent/"task04-current-producer-native-public-consumer-repair2"
keys=("dev","ino","mode","nlink","uid","gid","size","mtime_ns","ctime_ns")
def m(s):return {k:getattr(s,"st_"+k)for k in keys}
paths=[N/"programs/consumer.py",O/"independent-consumer-controls.py"]
first=json.loads((O/"n2-first-held-readback.json").read_bytes());expected={e["path"]:e for e in first["rows"]}
rows=[];fds=[];raws=[]
try:
 for p in paths:
  s=os.stat(p,follow_symlinks=False);pre=m(s);age=time.time_ns()-max(s.st_mtime_ns,s.st_ctime_ns)
  assert age>=60_000_000_000 and stat.S_ISREG(s.st_mode)and s.st_nlink==1
  rows.append({"path":str(p),"PRE":pre,"ageSeconds":age/1e9})
 (O/"independent-consumer-controls-metadata-before-contents.json").write_text(json.dumps(rows,indent=2)+"\n")
 for p,row in zip(paths,rows):
  fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);fds.append(fd);row["OPEN"]=m(os.fstat(fd));assert row["OPEN"]==row["PRE"]
 for p,row,fd in zip(paths,rows,fds):
  b=b""
  while True:
   c=os.read(fd,65536)
   if not c:break
   b+=c
  raws.append(b);row.update(POST=m(os.fstat(fd)),pathFINAL=m(os.stat(p,follow_symlinks=False)),sha256=hashlib.sha256(b).hexdigest(),size=len(b))
  assert row["PRE"]==row["POST"]==row["pathFINAL"] and len(b)==row["PRE"]["size"]
  if str(p)in expected:
   e=expected[str(p)];assert row["PRE"]==e["PRE"]and row["sha256"]==e["sha256"]and len(b)==e["size"]
 (O/"independent-consumer-controls-first-mature-source-pins.json").write_text(json.dumps(rows,indent=2)+"\n")
 C={"__file__":str(paths[0]),"__name__":"review3_consumer_source"}
 exec(compile(raws[0],str(paths[0]),"exec"),C)
 C["C"]=C
 exec(compile(raws[1],str(paths[1]),"exec"),C)
 result=C["RESULT"];(O/"independent-consumer-control-results.json").write_text(json.dumps(result,indent=2)+"\n")
 print(json.dumps({"PASS":result["PASS"],"FAIL":result["FAIL"],"failures":[r for r in result["results"]if r["status"]=="FAIL"]}),flush=True)
finally:
 for p,row,fd,b in zip(paths,rows,fds,raws):
  os.lseek(fd,0,0);final=b""
  while True:
   c=os.read(fd,65536)
   if not c:break
   final+=c
  row["FINAL"]=m(os.fstat(fd));row["finalPath"]=m(os.stat(p,follow_symlinks=False));row["finalSHA256"]=hashlib.sha256(final).hexdigest()
  row["match"]=row["PRE"]==row["FINAL"]==row["finalPath"]and final==b;row["closeReturn"]=os.close(fd)
 (O/"independent-consumer-control-source-final-FDclosure.json").write_text(json.dumps(rows,indent=2)+"\n")

