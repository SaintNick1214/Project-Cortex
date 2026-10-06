"""Fresh independent finite SOURCE/MOCK consumer outcome controls, no actual I/O effects."""
import copy,json
RESULTS=[]
def case(name,fn):
 try:detail=fn();RESULTS.append({"name":name,"status":"PASS","kind":"INDEPENDENT_SOURCE_MOCK","detail":detail})
 except BaseException as e:RESULTS.append({"name":name,"status":"FAIL","kind":"INDEPENDENT_SOURCE_MOCK","error":repr(e)})
def deny(fn):
 try:fn()
 except C["BoundaryFailure"] as e:return str(e)
 raise AssertionError("denial required")
def current_row():
 p={"dev":"1","ino":"2","mode":"33152","nlink":"1","uid":"0","gid":"0","size":"1","mtime_ns":"1","ctime_ns":"1"}
 return {"PRE":p,"OPEN":copy.deepcopy(p),"POST":copy.deepcopy(p),"heldFINAL":copy.deepcopy(p),"pathFINAL":copy.deepcopy(p),"heldFD":123,"bytes":1,"sha256":"a"*64,"EOF":True}
case("current_exact_nine_eof_positive",lambda:{"identity":C["check_row"](current_row())})
for phase in ("OPEN","POST","heldFINAL","pathFINAL"):
 for field in C["FIELDS"]:
  def f(phase=phase,field=field):
   r=current_row();r[phase][field]="3";return {"reason":deny(lambda:C["check_row"](r))}
  case("current_late_"+phase+"_"+field+"_denied",f)
case("exact_60s_maturity",lambda:{"ageNs":C["mature"](current_row()["PRE"],60000000001)})
case("one_ns_premature_denied",lambda:{"reason":deny(lambda:C["mature"](current_row()["PRE"],60000000000))})
for raw in (b'{"x":1,"x":2}',b'{"x":{"y":1,"y":2}}',b'NaN',b'1e309'):
 def f(raw=raw):
  value=C["strict"](raw)
  if raw==b"1e309":
   assert value==float("inf")
   return {"nonfinite_numeric_exponent":True,"acceptedByStrictParser":True}
  raise AssertionError("malformed nonfinite/duplicate JSON was accepted")
 if raw==b"1e309":case("strict_exponent_nonfinite_observation",f)
 else:case("strict_duplicate_or_nonfinite_denial_"+raw.decode(),lambda raw=raw:{"reason":deny(lambda:C["strict"](raw))})
def consumer_close_stage(stage):
 old={k:C[k] for k in ("open_inputs","read_held","strict","close_inputs")}
 opens=[];closes=[]
 good={"schema":"DISTINCT_FIRST_CURRENT_MATURE_BASELINE_V2","oldPacketScope":"FAILED","oldFailedCount":119,"runtimeAuthority":False,"sourceEligibility":False,"files":[]}
 def opening(paths):
  if len(opens)==1 and stage=="pending-open":raise C["BoundaryFailure"]("INJECT_PENDING_OPEN_FAILURE")
  rows=[{"path":str(p),"heldFD":700+len(opens)} for p in paths];opens.extend(rows);return rows
 def reading(*a,**k):
  if stage=="baseline-read":raise C["BoundaryFailure"]("INJECT_BASELINE_READ_FAILURE")
  return {"bytes":0},b"{}"
 def parsing(raw):
  if stage=="baseline-parse":raise C["BoundaryFailure"]("INJECT_BASELINE_PARSE_FAILURE")
  if stage=="baseline-scope":return {**good,"oldFailedCount":0}
  return good
 def closing(rows):
  closes.extend(rows);return [{"path":r["path"],"closeReturn":None}for r in rows]
 try:
  C.update(open_inputs=opening,read_held=reading,strict=parsing,close_inputs=closing)
  reason=deny(lambda:C["consume_baseline"]({"bytes":1,"sha256":"a"*64}))
 finally:C.update(old)
 assert len(opens)==1 and len(closes)==1,{"opened":len(opens),"closed":len(closes),"stage":stage,"reason":reason}
 return {"opened":len(opens),"closed":len(closes),"reason":reason}
for stage in ("baseline-read","baseline-parse","baseline-scope","pending-open"):
 case("baseline_fd_closed_after_"+stage+"_failure",lambda stage=stage:consumer_close_stage(stage))
def json_nonfinite_exponent_denial():
 value=C["strict"](b'{"clock":1e309}')
 assert value["clock"]!=float("inf"),"strict JSON accepted nonfinite exponent 1e309"
 return {"finite":True}
case("strict_json_rejects_nonfinite_exponent",json_nonfinite_exponent_denial)
RESULT={"schema":"INDEPENDENT_FINITE_CONSUMER_SOURCE_MOCK_REVIEW3","results":RESULTS,"PASS":sum(r["status"]=="PASS"for r in RESULTS),"FAIL":sum(r["status"]=="FAIL"for r in RESULTS),"noCandidateNativeDockerNetworkPrivateEffects":True,"old119FailuresRemain":True,"runtimeAuthority":False}

