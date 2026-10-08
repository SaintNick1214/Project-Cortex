from pathlib import Path
import json,hashlib,datetime,subprocess,re,difflib,shutil
R=Path('/workspace/Project-Cortex'); B=R/'_goals/convex-backend-runtime-2026-10-02/qa'; C=B/'task04-native-admission-fixture-c7'; W=Path(__file__).parent; Q=B/'task04-native-admission-fixture-c7-review'
protected=json.loads((Q/"protected-before.json").read_text())
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(n,x): (Q/n).write_text(json.dumps(x,indent=2)+'\n')
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def verify(packet,name):
 j=json.loads((packet/name).read_text());rows=j['files'];bad=[]
 for row in rows:
  p=packet/row['path']
  if not p.is_file() or h(p)!=row['sha256'] or p.stat().st_size!=row['bytes']:bad.append(row['path'])
 return {'name':str(packet/name),'hash':h(packet/name),'rows':len(rows),'mismatches':bad}
checks=[];env={'PATH':'/workspace/Project-Cortex/work/resume/toolchain-bin:/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8'}
def snap():return {str(p.relative_to(R)):h(p) for p in (W/'scripts').glob('*.mjs')}
def run(name,args):
 pre=snap();start=utc();res=subprocess.run(args,cwd=R,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=150)
 (Q/(name+'.stdout')).write_bytes(res.stdout);(Q/(name+'.stderr')).write_bytes(res.stderr)
 row={'name':name,'argv':args,'cwd':str(R),'utcStart':start,'utcEnd':utc(),'exitCode':res.returncode,'sourceConfigBefore':pre,'sourceConfigAfter':snap(),'stdoutSHA256':h(Q/(name+'.stdout')),'stderrSHA256':h(Q/(name+'.stderr'))};save(name+'.receipt.json',row);checks.append(row);print(name,res.returncode,res.stdout[-450:].decode(errors='replace'),res.stderr[-350:].decode(errors='replace'),flush=True)
run('cli02',['node','--test','--test-reporter=tap',str(W/'scripts/offline-cli-prerequisites.mjs')])
save('cli02-checks.json',checks)
