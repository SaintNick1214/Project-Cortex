import json,hashlib,subprocess,os,datetime,re,stat
from pathlib import Path
repo=Path('/workspace/Project-Cortex'); q=repo/'_goals/convex-backend-runtime-2026-10-02/qa'; candidate=q/'task03c2-live-resume-fixture'; old=q/'task03c2-live-fixture'; prep=q/'task03c2-live-resume-preparation'; out=q/'task03c2-live-resume-preparation-review'; scratch=repo/'work/resume/fresh-identity-review'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text())
verified={}
for name,rows,base in [('current-inventory',load(candidate/'current-inventory.json')['records'],repo),('preparation',load(prep/'preservation-manifest.json')['records'],repo),('current-freeze',load(candidate/'current-freeze.json')['files'],candidate),('archives',load(candidate/'archive-preservation.json'),repo),('SDK',load(candidate/'sdk-provenance.json')['files'],repo/'work/backend-runtime/task03c2-live-fixture')]:
 for r in rows:
  p=base/r['path'];assert digest(p)==r['sha256'],str(p)
  if 'bytes' in r:assert p.stat().st_size==r['bytes']
 verified[name]=len(rows)
f=load(candidate/'current-freeze.json'); baseline=load(old/'source-freeze.json'); assert digest(old/'source-freeze.json')==f['baseline']['sha256'];assert digest(old/'file-inventory.json')==f['baseline']['fileInventorySha256']
assert len(f['files'])==58
changed=[]
for r in f['files']:
 assert next(x['sha256'] for x in baseline['files'] if x['path']==r['path'])==r['baselineSha256']
 if r['sha256']!=r['baselineSha256']:changed.append(r['path'])
assert sorted(changed)==sorted(f['allowedChangedHistoricalRows']);verified['changed']=changed
sources=load(candidate/'source-provenance.json')
for r in sources['copied']:
 actual=subprocess.check_output(['git','show',r['sourceCommit']+':'+r['source']],cwd=repo)
 assert hashlib.sha256(actual).hexdigest()==r['sha256']==digest(candidate/r['fixture'])
verified['acceptedSources']=len(sources['copied'])
for p in (candidate/'scripts').iterdir():
 if p.name!='client.ts':assert p.read_bytes()==(old/'scripts'/p.name).read_bytes()
assert digest(candidate/'scripts/client.ts')=='e9cd7dba24a98be7e1eeeab645311c7728aa6fed5541db706ee36d4e056e521a'
identity=load(prep/'identity-preparation.json')
for r in identity['compilerDependencyFiles']:
 p=candidate/'fixture/node_modules/typescript'/r['path'];assert stat.S_ISREG(p.lstat().st_mode);assert digest(p)==r['sha256']==digest(repo/'node_modules/typescript'/r['path'])
verified['compilerFiles']=len(identity['compilerDependencyFiles'])
key=repo/'work/backend-runtime/qualification/jwt-private.pem'; directory=key.parent
assert stat.S_IMODE(directory.stat().st_mode)==0o700 and directory.stat().st_uid==os.getuid()
s=key.lstat();assert stat.S_ISREG(s.st_mode) and stat.S_IMODE(s.st_mode)==0o600 and s.st_uid==os.getuid() and s.st_nlink==1
assert not (candidate/'fixture/convex/_generated/api.js').exists();assert not (candidate/'fixture/convex/_generated/api.d.ts').exists()
assert load(candidate/'project-request.json')['projectSlug']!=load(old/'project-request.json')['projectSlug']
verified['keyMetadata']=True
(out/'integrity.json').write_text(json.dumps(verified,indent=2)+'\n')
commands=[]
def run(name,argv,expect=0):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=repo,env={'PATH':os.environ['PATH']},capture_output=True,timeout=50);end=datetime.datetime.now(datetime.timezone.utc).isoformat()
 (out/(name+'.stdout')).write_bytes(p.stdout);(out/(name+'.stderr')).write_bytes(p.stderr);commands.append({'name':name,'argv':argv,'cwd':str(repo),'environmentNames':['PATH'],'startUtc':start,'endUtc':end,'exitCode':p.returncode});(out/'commands.json').write_text(json.dumps(commands,indent=2)+'\n');assert p.returncode==expect,(name,p.returncode)
# The actual qualified helper performs the sole private-key read and exports no private content.
run('key-local-preflight',['node','--input-type=module','-e',f'import {{localPreflight,verifiedSigningKey}} from {json.dumps(str(candidate/"scripts/guard.mjs"))};localPreflight();verifiedSigningKey();console.log("local-preflight and public/private match PASS; tokens0 services0");'])
(scratch/'evidence-adapter.mjs').write_text(f'import {{writeFileSync}} from "node:fs";export {{localPreflight}} from {json.dumps(str(candidate/"scripts/guard.mjs"))}; export const root={json.dumps(str(candidate))};export function writeEvidence(name,value){{writeFileSync({json.dumps(str(out))}+"/"+name,JSON.stringify(value,null,2)+"\\n",{{flag:"wx",mode:0o600}});}}\n')
for name in ['classifier-check','classifier-adversarial','bounds-check']:
 source=(candidate/'scripts'/f'{name}.mjs').read_text().replace('"./guard.mjs"','"./evidence-adapter.mjs"').replace('"./operator-classifier.mjs"',json.dumps(str(candidate/'scripts/operator-classifier.mjs')))
 p=scratch/f'{name}.mjs';p.write_text(source);run(name,['node',str(p)])
raw=(q/'task03c2-live-service-qa-cycle1-review/native-regression.mjs').read_text().replace(str(old/'scripts/client.ts'),str(candidate/'scripts/client.ts'))
(scratch/'native-regression.mjs').write_text(raw)
for mode in ['immediate','early-deferred','forbidden','service-error','auth-lookalike','wrong-value','timeout']:
 run('native-'+mode,['node','--import','tsx',str(scratch/'native-regression.mjs'),mode]);(out/('native-'+mode+'.json')).write_bytes((scratch/('native-'+mode+'.json')).read_bytes())
for name in ['client-types','backend-es2021-types','scoped-eslint-corrected']:
 command=next(c for c in load(prep/'commands.json') if c['name']==name);run(name,command['argv'])
# Confirm read-only bindings still hold after every replay.
for r in load(prep/'preservation-manifest.json')['records']:assert digest(repo/r['path'])==r['sha256']
print(json.dumps({'integrity':verified,'commands':len(commands),'allExpectedExits':True}))
