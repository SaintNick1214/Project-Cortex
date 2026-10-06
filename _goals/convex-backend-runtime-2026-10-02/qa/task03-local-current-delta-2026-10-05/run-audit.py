from pathlib import Path
import subprocess,json,datetime
r=Path(__file__).resolve().parents[4];q=Path(__file__).resolve().parent;bin=Path("/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin");node=str(bin/"node")
env={"PATH":str(bin)+":/usr/bin:/bin","TMPDIR":str(q/"tmp"),"NO_COLOR":"1","NODE_OPTIONS":"--require "+str(q/"offline-network.cjs")}
receipts=[]
for name,argv,expected in [("source-audit-original-failure",[node,str(q/"source-audit.mjs")],1),("source-audit-v2",[node,str(q/"source-audit-v2.mjs")],0),("native-audit",[node,"--import","tsx",str(q/"native-audit.mts")],0)]:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=r,env=env,text=True,capture_output=True,timeout=120)
 (q/(name+".stdout")).write_text(p.stdout);(q/(name+".stderr")).write_text(p.stderr)
 row={"name":name,"argv":argv,"cwd":str(r),"startedAtUtc":start,"endedAtUtc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"exitCode":p.returncode,"expectedExitCode":expected,"status":"PASS" if p.returncode==expected else "FAIL","stdout":name+".stdout","stderr":name+".stderr"};receipts.append(row);print(json.dumps(row),flush=True)
 (q/"audit-command-receipts.json").write_text(json.dumps({"externalRequests":0,"commands":receipts},indent=2)+"\n")
