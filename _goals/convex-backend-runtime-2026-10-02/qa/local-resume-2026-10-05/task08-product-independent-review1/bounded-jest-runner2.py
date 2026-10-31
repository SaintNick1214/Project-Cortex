from pathlib import Path
import sys,json,subprocess,time,hashlib
R=Path("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion");J=Path("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task08-product-independent-review1")
name=sys.argv[1];config=sys.argv[2]
paths=["convex-dev/runtimeMemoryContext.ts","convex-dev/runtimeAgent.ts","convex-dev/runtimeTranscript.ts","convex-dev/runs.ts","convex-dev/runtimeIngestion.ts","convex-dev/runtimeBeliefs.ts","src/domain/belief-plan.ts","convex-dev/runtimeModelPolicy.ts","tests/unit/runtimeIngestion/fixture.ts","tests/unit/runtimeTranscript/fixture.ts","convex-dev/runtimeMemoryRepository.ts","convex-dev/runtimeContextWitness.ts","convex-dev/runtimeContextWitnessSchema.ts","src/domain/context-witness.ts","convex-dev/runtimeAgentFence.ts","convex-dev/runtimeDataAuth.ts"]
def pins():return [{"path":p,"bytes":len((R/p).read_bytes()),"sha256":hashlib.sha256((R/p).read_bytes()).hexdigest()} for p in paths]
before=pins();cmd=["/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/node/bin/node","--experimental-vm-modules",str(R/"node_modules/jest/bin/jest.js"),"--config",str(J/config),"--runInBand","--no-cache","--json","--outputFile",str(J/(name+".results.json"))];start=time.monotonic();timed=False
with (J/(name+".stdout.txt")).open("w") as out,(J/(name+".stderr.txt")).open("w") as err:
 p=subprocess.Popen(cmd,cwd=R,stdout=out,stderr=err)
 try:rc=p.wait(timeout=55)
 except subprocess.TimeoutExpired:
  timed=True;p.terminate()
  try:rc=p.wait(timeout=5)
  except subprocess.TimeoutExpired:p.kill();rc=p.wait(timeout=5)
receipt={"command":cmd,"cwd":str(R),"pid":p.pid,"exit":rc,"reaped":True,"elapsedSeconds":time.monotonic()-start,"deadlineSeconds":55,"timedOut":timed,"sourceBefore":before,"sourceAfter":pins(),"scope":"Controlled registered-handler/native-peer outcome checks; no target/inference/private effects."};receipt["sourceStable"]=receipt["sourceBefore"]==receipt["sourceAfter"];(J/(name+".command.json")).write_text(json.dumps(receipt,indent=2)+"\n")
res=json.loads((J/(name+".results.json")).read_text()) if (J/(name+".results.json")).exists() else {};print(json.dumps({"pid":p.pid,"exit":rc,"reaped":True,"elapsed":receipt["elapsedSeconds"],"sourceStable":receipt["sourceStable"],"passed":res.get("numPassedTests"),"failed":res.get("numFailedTests"),"failures":[(x["fullName"],x["failureMessages"]) for ss in res.get("testResults",[]) for x in ss.get("assertionResults",[]) if x["status"]=="failed"]},indent=2))
