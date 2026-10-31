import os,stat,time,json,hashlib,pathlib,ast
O=pathlib.Path("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair2-source-review3");S=O.parent/"task04-current-producer-native-public-repair1/source"
ref=json.loads((O/"reference-first-held-readback.json").read_bytes());expected={e["path"]:e for e in ref["rows"]}
mf=json.loads((S/"source-manifest.json").read_bytes())
paths=[S/e["path"]for e in mf["files"]]+[O/"independent-r1-controls.py",O/"independent-r1-extra-controls.py"]
keys=("dev","ino","mode","nlink","uid","gid","size","mtime_ns","ctime_ns")
def m(s):return {k:getattr(s,"st_"+k)for k in keys}
rows=[];fds=[];raws={}
try:
 for p in paths:
  s=os.stat(p,follow_symlinks=False);pre=m(s);age=time.time_ns()-max(s.st_mtime_ns,s.st_ctime_ns)
  assert age>=60_000_000_000 and stat.S_ISREG(s.st_mode)and s.st_nlink==1
  if str(p)in expected:assert pre==expected[str(p)]["PRE"]
  rows.append({"path":str(p),"PRE":pre,"ageSeconds":age/1e9})
 (O/"independent-r1-controls-metadata-before-contents.json").write_text(json.dumps(rows,indent=2)+"\n")
 for p,row in zip(paths,rows):
  fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);fds.append(fd);row["OPEN"]=m(os.fstat(fd));assert row["OPEN"]==row["PRE"]
 for p,row,fd in zip(paths,rows,fds):
  b=b""
  while True:
   c=os.read(fd,65536)
   if not c:break
   b+=c
  raws[str(p)]=b;row.update(POST=m(os.fstat(fd)),pathFINAL=m(os.stat(p,follow_symlinks=False)),sha256=hashlib.sha256(b).hexdigest(),size=len(b))
  assert row["PRE"]==row["POST"]==row["pathFINAL"] and len(b)==row["PRE"]["size"]
  if str(p)in expected:
   e=expected[str(p)];assert row["sha256"]==e["sha256"]and len(b)==e["size"]
 (O/"independent-r1-controls-first-mature-source-pins.json").write_text(json.dumps(rows,indent=2)+"\n")
 SOURCES={str(p.relative_to(S)):raws[str(p)] for p in paths if p.is_relative_to(S)}
 parses=[]
 for name,raw in SOURCES.items():
  if name.endswith(".py"):
   tree=ast.parse(raw,filename=name);parses.append({"path":name,"status":"PASS","functions":[n.name for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))]})
 (O/"independent-r1-complete-python-ast.json").write_text(json.dumps({"sources":parses,"count":len(parses),"all112SourceBytesConsumed":True,"actualNative20Public48":False},indent=2)+"\n")
 for name in ("independent-r1-controls.py","independent-r1-extra-controls.py"):
  C={"__name__":"review3_"+name,"__file__":str(O/name),"SOURCES":SOURCES,"SOURCE_ROOT":str(S)}
  exec(compile(raws[str(O/name)],str(O/name),"exec"),C)
  result=C["RESULT"];(O/(name.replace(".py","-results.json"))).write_text(json.dumps(result,indent=2)+"\n")
  print(json.dumps({"control":name,"PASS":result["PASS"],"FAIL":result["FAIL"],"failures":[r for r in result["results"]if r["status"]=="FAIL"]}),flush=True)
 print("COMPLETE112_SOURCE_EOF_AND19_PYTHON_AST",len(SOURCES),len(parses),flush=True)
finally:
 for p,row,fd in zip(paths,rows,fds):
  os.lseek(fd,0,0);final=b""
  while True:
   c=os.read(fd,65536)
   if not c:break
   final+=c
  row["FINAL"]=m(os.fstat(fd));row["finalPath"]=m(os.stat(p,follow_symlinks=False));row["finalSHA256"]=hashlib.sha256(final).hexdigest()
  row["match"]=row["PRE"]==row["FINAL"]==row["finalPath"]and final==raws.get(str(p),b"");row["closeReturn"]=os.close(fd)
 (O/"independent-r1-controls-source-final-FDclosure.json").write_text(json.dumps(rows,indent=2)+"\n")

