from pathlib import Path
import os,json,subprocess,datetime,hashlib
r=Path(__file__).resolve().parents[4];q=Path(__file__).resolve().parent
bin=Path("/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin");node=str(bin/"node")
env={"PATH":str(bin)+":/usr/bin:/bin","TMPDIR":str(q/"tmp"),"NO_COLOR":"1","NODE_OPTIONS":"--require "+str(q/"offline-network.cjs")}
files=["tests/unit/domain/outcomes.test.ts","tests/unit/domain/profile.test.ts","tests/unit/domain/sources.test.ts","tests/unit/domain/model-policy.test.ts","tests/unit/runtime/model-policy-admission.test.ts","tests/unit/runtime/model-policy-model-drift.test.ts","tests/unit/runtime/gateway-terminal-composition.test.ts","tests/unit/runtimeAuth/authority.test.ts","tests/unit/runtimeAuth/provisioning.test.ts","tests/unit/runtimeAuth/inventory.test.ts","tests/unit/runtimeMemory/repository.test.ts","tests/unit/runtimeMemory/services.test.ts","tests/unit/runtimeMemory/public-boundary.test.ts","tests/unit/runtimeMemory/public-closure.test.ts","tests/unit/auth/credentials.test.ts","tests/unit/runtimeWorkerAuth/governance.test.ts","tests/unit/runtimeWorkerAuth/graph.test.ts"]
c11=json.loads((r/"_goals/convex-backend-runtime-2026-10-02/qa/task03-foundation-live-c11-aggregate-review/source-hash-reconciliation.json").read_text())
pinned=set(files+ [x["source"] for x in c11["rows"]]+[str(p.relative_to(r)) for p in (r/"convex-dev").glob("*.ts")]+["src/domain/model-policy.ts","src/types/runtime.ts","package.json","package-lock.json","convex.json","tsconfig.json","convex-dev/tsconfig.json","jest.config.mjs"])
pinned={s for s in pinned if (r/s).exists()};sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
pre={s:sha(r/s) for s in sorted(pinned)};(q/"source-pre.json").write_text(json.dumps({"utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"files":pre},indent=2)+"\n")
receipts=[]
def run(name,argv,expected=0):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 try:
  p=subprocess.run(argv,cwd=r,env=env,capture_output=True,text=True,timeout=180);code=p.returncode;out=p.stdout;err=p.stderr;timed=False
 except subprocess.TimeoutExpired as e:
  code=None;out=e.stdout or "";err=e.stderr or "";timed=True
  if isinstance(out,bytes):out=out.decode(errors="replace")
  if isinstance(err,bytes):err=err.decode(errors="replace")
 for label,value in [("stdout",out),("stderr",err)]: (q/(name+"."+label)).write_text(value)
 row={"name":name,"argv":argv,"cwd":str(r),"startedAtUtc":start,"endedAtUtc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"exitCode":code,"timedOut":timed,"expectedExitCode":expected,"status":"PASS" if code==expected and not timed else "FAIL","stdout":name+".stdout","stderr":name+".stderr"};receipts.append(row)
 (q/"command-receipts.json").write_text(json.dumps({"scope":"CREDENTIAL_FREE_CURRENT_DELTA_ONLY","environmentLoaders":False,"services":0,"commands":receipts},indent=2)+"\n");print(json.dumps(row),flush=True)
run("runtime",[node,"--version"]);run("npm",[str(bin/"npm"),"--version"])
run("accepted-resolver-current-unclassified",[node,str(q/"inventory-original.mjs"),str(q/"initial-inventory")],1)
run("current-inventory",[node,str(q/"inventory.mjs"),str(q/"current-inventory")])
run("root-types",[node,str(r/"node_modules/typescript/bin/tsc"),"--noEmit"])
run("backend-types",[node,str(r/"node_modules/typescript/bin/tsc"),"--project","convex-dev/tsconfig.json","--noEmit"])
args=[node,"--experimental-vm-modules",str(r/"node_modules/jest/bin/jest.js"),"--config",str(q/"jest.config.mjs"),"--runInBand","--runTestsByPath",*files,"--no-cache"]
run("test-discovery",args+["--listTests"])
run("affected-tests",args+["--json","--outputFile="+str(q/"jest-result.json")])
post={s:sha(r/s) for s in sorted(pinned)};(q/"source-post.json").write_text(json.dumps({"utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"files":post,"changed":[s for s in sorted(pinned) if pre[s]!=post[s]]},indent=2)+"\n")
print(json.dumps({"sourceFiles":len(pre),"changed":len([s for s in pre if pre[s]!=post[s]])}),flush=True)
