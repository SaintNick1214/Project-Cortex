import os,sys,json,time,hashlib,stat,resource,pathlib
R=pathlib.Path("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion")
N=R/"_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair2"
O=R/"_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair2-source-review3"
assert O.is_dir()
resource.setrlimit(resource.RLIMIT_NOFILE,(min(10000,resource.getrlimit(resource.RLIMIT_NOFILE)[1]),resource.getrlimit(resource.RLIMIT_NOFILE)[1]))
K=["dev","ino","mode","nlink","uid","gid","size","mtime_ns","ctime_ns"]
def nine(s): return dict(zip(K,[s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_uid,s.st_gid,s.st_size,s.st_mtime_ns,s.st_ctime_ns]))
def dump(name,v): (O/name).write_text(json.dumps(v,indent=2)+"\n")
held={}
def capture(paths,label):
 now=time.time_ns(); rows=[]; seen={}
 for p in sorted(paths,key=str):
  if str(p) in held: continue
  s=os.stat(p,follow_symlinks=False); m=nine(s)
  assert stat.S_ISREG(s.st_mode) and s.st_nlink==1,(str(p),"regular-singlelink")
  assert now-max(s.st_mtime_ns,s.st_ctime_ns)>=60_000_000_000,(str(p),"immature",now-max(s.st_mtime_ns,s.st_ctime_ns))
  ident=(s.st_dev,s.st_ino); assert ident not in seen,(str(p),"alias",seen.get(ident));seen[ident]=str(p)
  rows.append({"path":str(p),"PRE":m,"ageNs":now-max(s.st_mtime_ns,s.st_ctime_ns)})
 dump(label+"-metadata-before-contents.json",{"timeNs":now,"rows":rows})
 for row in rows:
  p=row["path"];f=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);row["OPEN"]=nine(os.fstat(f));assert row["OPEN"]==row["PRE"],(p,"OPEN");held[p]={"fd":f,"row":row}
 for row in rows:
  p=row["path"];f=held[p]["fd"];b=b""
  while True:
   c=os.read(f,1024*1024)
   if not c:break
   b+=c
  row["POST"]=nine(os.fstat(f));row["pathFINAL"]=nine(os.stat(p,follow_symlinks=False));row["sha256"]=hashlib.sha256(b).hexdigest();row["size"]=len(b)
  assert row["PRE"]==row["POST"]==row["pathFINAL"],(p,"POST")
  assert len(b)==row["PRE"]["size"],(p,"EOFsize")
  held[p]["bytes"]=b
 dump(label+"-first-held-readback.json",{"scope":"CURRENT_FIRST_PROSPECTIVE_ONLY","rows":rows,"files":len(rows),"bytes":sum(r["size"] for r in rows),"minimumAgeSeconds":min(r["ageNs"] for r in rows)/1e9})
 return rows


own_paths=[O/"reference-metadata-before-contents.json",O/"reference-first-held-readback.json",O/"setup-processing-error.json",O/"n2-hold-review.py",O/"reference-initial-hold-review.py"]
own_rows=capture(own_paths,"corrected-review-setup-input")
original=json.loads(held[str(O/"reference-first-held-readback.json")]["bytes"])
original_rows={e["path"]:e for e in original["rows"]}
base=json.loads((N/"evidence/first-current-mature-baseline1.json").read_bytes())
paths=[pathlib.Path(e["path"]) for e in base["files"]]
assert len(paths)==len(set(map(str,paths)))==1277
rows=capture(paths,"reference-second-open-unchanged-first-pins")
expected={e["path"]:e for e in base["files"]}
mismatches=[];oldfails=[];rolecounts={}
for row in rows:
 e=expected[row["path"]];first=original_rows[row["path"]]
 if row["PRE"]!=first["PRE"] or row["sha256"]!=first["sha256"] or row["size"]!=first["size"]:mismatches.append({"path":row["path"],"scope":"OWN_UNCHANGED_FIRST_CAPTURE"})
 literal={k:int(v) for k,v in e["PRE"].items()}
 if row["PRE"]!=literal or row["sha256"]!=e["sha256"] or row["size"]!=e["bytes"]:mismatches.append({"path":row["path"],"scope":"NEW_CURRENT_BASELINE"})
 if e.get("stableLiteral") is not None:
  stable={k:int(v) for k,v in e["stableLiteral"].items()}
  if row["PRE"]!=stable:mismatches.append({"path":row["path"],"scope":"ORIGINAL_STABLE_LITERAL"})
 for role in e["roles"]:rolecounts[role]=rolecounts.get(role,0)+1
 if e.get("oldPacketLiteral") is not None:
  old={k:int(v) for k,v in e["oldPacketLiteral"].items()}
  changes=[k for k in K if old[k]!=row["PRE"][k]]
  if changes:oldfails.append({"path":row["path"],"expected":old,"current":row["PRE"],"changedFields":changes,"sha256":row["sha256"],"size":row["size"]})
dump("reference-comparison-corrected-second-open.json",{"currentLiteralMismatches":mismatches,"oldPacketFailures":oldfails,"oldFailureCount":len(oldfails),"roleCounts":rolecounts,"newBaselineHistoricalCustody":False,"runtimeAuthority":False,"initialProcessCustodyGap":True,"reviewHoldStartsAtThisSecondOpen":True})
assert not mismatches,mismatches
assert len(oldfails)==119,len(oldfails)
assert all(x["changedFields"]==["ctime_ns"] for x in oldfails)
print("REFERENCE_SECOND_OPEN_UNCHANGED_FIRST_PINS_PASS",len(rows),sum(r["size"] for r in rows),json.dumps(rolecounts), "OLDFAIL",len(oldfails),flush=True)
for line in sys.stdin:
 req=json.loads(line)
 if req["action"]=="describe":
  d=json.loads(held[str(N/req["file"])]["bytes"]);print(json.dumps(d if req.get("full") else {k:(v[:1] if isinstance(v,list) else v) for k,v in d.items()}),flush=True)
 elif req["action"]=="capture":
  r=capture([pathlib.Path(p) for p in req["paths"]],req["label"]);print("CAPTURE_PASS",len(r),flush=True)
 elif req["action"]=="final":
  final=[];errors=[]
  for p,h in held.items():
   f=h["fd"];os.lseek(f,0,0);bb=b""
   while True:
    cc=os.read(f,1024*1024)
    if not cc:break
    bb+=cc
   m=nine(os.fstat(f));pm=nine(os.stat(p,follow_symlinks=False));sha=hashlib.sha256(bb).hexdigest()
   ok=m==h["row"]["PRE"]==pm and sha==h["row"]["sha256"] and len(bb)==h["row"]["size"]
   if not ok:errors.append(p)
   closed=os.close(f);final.append({"path":p,"FINAL":m,"pathFINAL":pm,"sha256":sha,"size":len(bb),"match":ok,"closeReturn":closed})
  dump("reference-second-open-held-through-review-final-FDclosure.json",{"rows":final,"errors":errors,"files":len(final),"allClosed":True,"status":"PASS" if not errors else "FAIL"})
  print("FINAL",len(final),len(errors),flush=True);break

