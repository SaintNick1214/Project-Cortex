from pathlib import Path
import json,hashlib,datetime
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-product-c2-review';p=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-implementation-c2';m=p/'manifest.json'; h=lambda b:hashlib.sha256(b).hexdigest()
rows=json.loads(m.read_text())['files'];bad=[]
for row in rows:
 f=p/row['path'];b=f.read_bytes()
 if len(b)!=row['bytes'] or h(b)!=row['sha256']:bad.append(row['path'])
t=(r/'tests/unit/runtime/model-policy-admission.test.ts').read_bytes()
oldq=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-product-c1-review'; oldmanifest=oldq/'evidence-manifest.json'
if not oldmanifest.exists():oldmanifest=oldq/'manifest.json'
print('oldmanifest',oldmanifest.exists())
result={'observedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'producerManifestSHA256':h(m.read_bytes()),'rows':len(rows),'mismatches':bad,'source':{f:h((r/f).read_bytes()) for f in ['convex-dev/runtimeModelPolicy.ts','convex-dev/runtimePolicySchema.ts','tests/unit/runtime/model-policy-admission.test.ts']},'previous122':{'bytes':83111,'sha256':h(t[:83111]),'expectedSHA256':'be5b87c1c1bb744222c4ca9f4a274279890dcca9443fcfd93bbd6b1177134489'},'original76':{'bytes':50546,'sha256':h(t[:50546]),'expectedSHA256':'51a8a1072ec5d782fcd44fbcd03e1b7010f705568461a30896bbd9a234b39b23'}}
old=[]
for packet in [oldq,r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-implementation-c1',p]:
 for f in sorted(packet.rglob('*')):
  if f.is_file():old.append({'path':str(f.relative_to(r)),'bytes':f.stat().st_size,'sha256':h(f.read_bytes())})
(q/'protected-qa-pre.json').write_text(json.dumps(old,indent=2));(q/'producer-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
