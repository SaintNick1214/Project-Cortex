"""Own first mature CURRENT output consumer only; never repairs historical pins."""
import os,stat,time,json,hashlib,pathlib
O=pathlib.Path(__file__).resolve().parent
FIELDS=("dev","ino","mode","nlink","uid","gid","size","mtime_ns","ctime_ns")
def identity(s):return {k:str(getattr(s,"st_"+k))for k in FIELDS}
def close_own_outputs():
 paths=sorted(p for p in O.rglob("*")if p.is_file()or p.is_symlink())
 assert not (O/"first-own-current-closure.json").exists()
 assert len(paths)<=64
 pre=[];seen=set();held=[];rows=[];total=0
 for p in paths:
  s=os.stat(p,follow_symlinks=False);pin=identity(s);age=time.time_ns()-max(s.st_mtime_ns,s.st_ctime_ns)
  assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and age>=60_000_000_000
  key=(s.st_dev,s.st_ino);assert key not in seen;seen.add(key)
  pre.append({"path":str(p),"PRE":pin,"ageNsAtFirstCapture":age})
 try:
  for row in pre:
   fd=os.open(row["path"],os.O_RDONLY|os.O_NOFOLLOW);held.append(fd);row["OPEN"]=identity(os.fstat(fd));assert row["OPEN"]==row["PRE"]
  for row,fd in zip(pre,held):
   b=b""
   while True:
    c=os.read(fd,65536)
    if not c:break
    b+=c
   total+=len(b);assert total<=100_000_000
   row.update(POST=identity(os.fstat(fd)),pathFINAL=identity(os.stat(row["path"],follow_symlinks=False)),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),EOF=True)
   assert row["PRE"]==row["POST"]==row["pathFINAL"]and str(len(b))==row["PRE"]["size"]
   rows.append(row)
  for row,fd in zip(rows,held):
   os.lseek(fd,0,0);sha=hashlib.sha256();size=0
   while True:
    c=os.read(fd,65536)
    if not c:break
    sha.update(c);size+=len(c)
   row.update(heldFINAL=identity(os.fstat(fd)),finalPath=identity(os.stat(row["path"],follow_symlinks=False)),finalSHA256=sha.hexdigest(),finalBytes=size)
   assert row["PRE"]==row["heldFINAL"]==row["finalPath"]and row["sha256"]==row["finalSHA256"]and row["bytes"]==size
 finally:
  closes=[{"path":row["path"],"closeReturn":os.close(fd)}for row,fd in zip(pre,held)]
 return {"schema":"OWN_FIRST_MATURE_CURRENT_REVIEW_OUTPUT_CONSUMER_V1","status":"CURRENT_REFERENCE_MATCH","files":rows,"count":len(rows),"bytes":total,"minimumActualAgeNs":min(r["ageNsAtFirstCapture"]for r in rows),"allMetadataAndOpensBeforeOwnContents":True,"FDCloses":closes,"notHistoricalPRE":True,"newOutputSelfExcluded":["first-own-current-closure.json"],"old119Scope":"FAILED_IMMUTABLE","initialReferenceReaderCustodyGapPreserved":True,"historicalCustodyRepaired":False,"sourceEligibility":False,"runtimeAuthority":False,"Task04SixCriteria":"OPEN","Task03":"OPEN","full17Goal":"OPEN"}

