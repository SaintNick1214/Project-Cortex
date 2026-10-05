from pathlib import Path
import json,hashlib,subprocess,time,datetime,shutil
r=Path('/workspace/Project-Cortex');base=r/'work/resume/task04-terminal-capture-native-profiles-c3-review';out=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-profiles-c3-review';q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-extension-preparation-c3';sha=lambda b:hashlib.sha256(b).hexdigest()
def manifest(p):
 m=json.loads((p/'qa-manifest.json').read_text()); actual=sorted(str(f.relative_to(p)) for f in p.rglob('*') if f.is_file() and f!=p/'qa-manifest.json');assert actual==[x['path'] for x in m['files']];assert len(actual)==len(set(actual));
 for row in m['files']:
  f=p/row['path'];b=f.read_bytes();assert not f.is_symlink() and f.stat().st_nlink==1;assert len(b)==row['bytes'] and sha(b)==row['sha256']
 return {'path':str(p.relative_to(r)),'rows':len(actual),'sha256':sha((p/'qa-manifest.json').read_bytes())}
def run(name,argv):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic();p=subprocess.run(argv,cwd=r,text=True,capture_output=True);d=out/name;d.mkdir(exist_ok=True);(d/'stdout.txt').write_text(p.stdout);(d/'stderr.txt').write_text(p.stderr);(d/'command.json').write_text(json.dumps({'argv':argv,'cwd':str(r),'UTC':start,'exitCode':p.returncode,'elapsedSeconds':time.monotonic()-t},indent=2)+'\n');return p
(out/'integrity-before.json').write_text(json.dumps([manifest(q),manifest(q/'regression')],indent=2)+'\n')
# Contemporary source preimages: entire executable closure plus external consumed helpers.
for pp,label in [(q,'extension'),(q/'regression','regression')]:
 freeze=json.loads((pp/'runtime-freeze.json').read_text());paths=[pp/x['path'] for x in freeze['files']]+[pp/'runtime-freeze.json',pp/'qa-manifest.json']+[r/x['path'] for x in json.loads((pp/'runtime-inputs.json').read_text())['externalSources']]
 for f in paths:
  dest=out/'source-preimages'/label/f.relative_to(r);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(f.read_bytes())
 script=base/(label+'-preflight.mjs');script.write_text("import {sourcePreflight,preservationPreflight} from "+json.dumps(str(pp/'scripts/guard.mjs'))+";import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';let t=Date.now();let f=sourcePreflight();let p=preservationPreflight({preservationManifestSHA256:createHash('sha256').update(readFileSync("+json.dumps(str(pp/'qa-manifest.json'))+")).digest('hex')});console.log(JSON.stringify({sourceRows:f.files.length,...p,elapsedMs:Date.now()-t}));")
 assert run(label+'-complete-preflight',['node',str(script)]).returncode==0
old=q.parent/'task04-terminal-capture-native-extension-preparation-c2';dif=[]
for pp,oo,label in [(q,old,'extension'),(q/'regression',old/'regression','regression')]:
 for f in sorted((pp/'scripts').glob('*.mjs')):
  prior=oo/'scripts'/f.name
  if prior.exists() and f.read_bytes()!=prior.read_bytes():
   p=run('diff-'+label+'-'+f.stem,['diff','-u',str(prior),str(f)]);dif.append({'profile':label,'path':f.name,'sha256':sha(f.read_bytes()),'priorSHA256':sha(prior.read_bytes())})
 for f in (pp/'fixture').rglob('*'):
  if f.is_file() and (oo/'fixture'/f.relative_to(pp/'fixture')).read_bytes()!=f.read_bytes():
   rel=f.relative_to(pp/'fixture');run('diff-'+label+'-fixture-'+str(rel).replace('/','--'),['diff','-u',str(oo/'fixture'/rel),str(f)]);dif.append({'profile':label,'fixture':str(rel),'sha256':sha(f.read_bytes())})
(out/'changed-scripts.json').write_text(json.dumps(dif,indent=2)+'\n')
print(json.dumps({'manifests':[manifest(q),manifest(q/'regression')],'changes':dif}))
