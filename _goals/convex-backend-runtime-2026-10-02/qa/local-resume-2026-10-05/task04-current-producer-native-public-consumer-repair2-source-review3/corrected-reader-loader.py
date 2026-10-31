import os,stat,time,json,hashlib,pathlib
p=pathlib.Path("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair2-source-review3/reference-corrected-hold-review.py")
s=os.stat(p,follow_symlinks=False)
keys=("dev","ino","mode","nlink","uid","gid","size","mtime_ns","ctime_ns")
def m(s):return {k:getattr(s,"st_"+k)for k in keys}
pre=m(s);age=time.time_ns()-max(s.st_mtime_ns,s.st_ctime_ns)
assert age>=60_000_000_000 and stat.S_ISREG(s.st_mode) and s.st_nlink==1
f=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);opened=m(os.fstat(f));assert opened==pre
b=b""
while True:
 c=os.read(f,65536)
 if not c:break
 b+=c
assert m(os.fstat(f))==m(os.stat(p,follow_symlinks=False))==pre and len(b)==s.st_size
row={"path":str(p),"PRE":pre,"OPEN":opened,"POST":m(os.fstat(f)),"pathFINAL":m(os.stat(p,follow_symlinks=False)),"sha256":hashlib.sha256(b).hexdigest(),"size":len(b),"minimumAgeSeconds":age/1e9,"startupTrust":"Python/interpreter/stdlib/tool-text loader; no cache-first-use/native closure claimed"}
(p.parent/"corrected-reader-first-mature-source-pin.json").write_text(json.dumps(row,indent=2)+"\n")
try:exec(compile(b,str(p),"exec"),{"__name__":"__main__","__file__":str(p)})
finally:
 os.lseek(f,0,0);last=b""
 while True:
  c=os.read(f,65536)
  if not c:break
  last+=c
 final={"PRE":pre,"FINAL":m(os.fstat(f)),"pathFINAL":m(os.stat(p,follow_symlinks=False)),"sha256":hashlib.sha256(last).hexdigest(),"size":len(last),"matched":pre==m(os.fstat(f))==m(os.stat(p,follow_symlinks=False))and last==b}
 final["closeReturn"]=os.close(f)
 (p.parent/"corrected-reader-source-final-FDclosure.json").write_text(json.dumps(final,indent=2)+"\n")

