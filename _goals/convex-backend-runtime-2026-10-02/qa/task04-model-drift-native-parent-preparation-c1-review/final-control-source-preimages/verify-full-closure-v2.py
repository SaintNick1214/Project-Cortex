from pathlib import Path
import json,hashlib,datetime,sys,re
repo=Path('/workspace/Project-Cortex');qa=repo/'_goals/convex-backend-runtime-2026-10-02/qa';own=qa/'task04-model-drift-native-parent-preparation-c1-review'
sha=lambda b:hashlib.sha256(b).hexdigest()
cache={};results=[]
def files(root):
 rows=[]
 for p in root.rglob('*'):
  assert not p.is_symlink(),str(p)+' symlink'
  if p.is_file():rows.append(str(p.relative_to(root)))
 return sorted(rows)
def verify(root,manifestName,rows=None):
 data=(root/manifestName).read_bytes();manifest=json.loads(data)
 if rows is None:rows=manifest['files']
 paths=[r['path'] for r in rows];assert len(paths)==len(set(paths))
 assert sorted(paths)==[p for p in files(root) if p!=manifestName],str(root)+' fullset'
 for row in rows:
  assert set(row)=={'path','bytes','sha256'},row
  rel=Path(row['path']);assert not rel.is_absolute() and all(x not in ['.','..'] for x in rel.parts)
  p=root/rel;assert p.stat().st_nlink==1,str(p)+' link';body=p.read_bytes()
  assert len(body)==row['bytes'] and sha(body)==row['sha256'],str(p)+' byteshash'
 return {'path':str(root.relative_to(repo)),'manifest':manifestName,'manifestSHA256':sha(data),'files':len(rows),'allBytesSHA':True,'exactRecursiveSet':True}
for profile in ['extension','regression','extra']:
 root=qa/f'task04-model-drift-native-{profile}-preparation-c1'
 closure=verify(root,'qa-manifest.json');freezeBytes=(root/'runtime-freeze.json').read_bytes();freeze=json.loads(freezeBytes)
 for row in freeze['files']:
  body=(root/row['path']).read_bytes();assert sha(body)==row['sha256'];assert 'bytes' not in row or len(body)==row['bytes']
 guard=(root/'scripts/guard.mjs').read_text();m=re.search(r'export const runtimeRootInputs=Object.freeze\(\[(.*?)\]\)',guard)
 inputs=re.findall(r"'([^']+)'",m.group(1));folders=re.findall(r"'([^']+)'",re.search(r"return (\[[^]]+\])\.includes\(path\.split",guard).group(1));operational=sorted(p for p in files(root) if p.split('/')[0] in folders or p in inputs)
 assert operational==freeze['operationalPaths'];assert sorted(r['path'] for r in freeze['files'])==operational
 contract=json.loads((root/'parent-input-contract.json').read_bytes());assert contract['profile']==json.loads((root/'project-request.json').read_bytes())
 for field in ['parentTemplate','watchTemplate']:
  row=contract[field];assert sha((root/row['path']).read_bytes())==row['sha256']
 inherited=[]
 for packet in json.loads((root/'historical-preservation.json').read_bytes())['packets']:
  d=repo/packet['path'];b=(d/packet['manifest']).read_bytes();assert sha(b)==packet['manifestSHA256'];prior=json.loads(b)['files'];assert len(prior)==packet['rows'];selected=prior
  if 'fullClosure' in packet:
   info=packet['fullClosure'];fullBytes=(root/info['path']).read_bytes();assert sha(fullBytes)==info['sha256'] and len(fullBytes)==info['bytes'];selected=json.loads(fullBytes)['files'];assert len(selected)==info['rows'];by={r['path']:r for r in selected};assert all(by[r['path']]==r for r in prior)
   assert len(selected)==83 and len(prior)==80
  key=(str(d),packet['manifest'],sha(json.dumps(selected,sort_keys=True).encode()))
  if key not in cache:cache[key]=verify(d,packet['manifest'],selected)
  inherited.append(cache[key])
 results.append({'profile':profile,'closure':closure,'freezeSHA256':sha(freezeBytes),'frozenFiles':len(freeze['files']),'inherited':inherited})
out={'argv':sys.argv,'cwd':str(Path.cwd()),'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':results,'uniqueInheritedPacketsVerified':len(cache),'status':'PASS','native':'NOT_RUN','paid':'NOT_RUN','private':'NOT_READ'}
(own/'full-closure-results.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'status':'PASS','profiles':len(results),'uniqueHistoricalClosures':len(cache)}))
