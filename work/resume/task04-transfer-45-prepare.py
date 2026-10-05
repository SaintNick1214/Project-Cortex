from pathlib import Path
import os,json,hashlib,subprocess,datetime,stat
R=Path('/workspace/Project-Cortex');W=R/'work/resume';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa'
base='f5f747199d7f222fbd9c73fd30416bb7b4f5d565';parent='c60372d08d7a73f934a1f0115ba9d59b8b80ecc1'
K=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {k:str(getattr(s,'st_'+k)) for k in K}
mapping={};selection=[];routes=[]
for name in ['task04-c6-frozen-content-backing','task04-c6-review-content-backing']:
 m=json.loads((W/name/'virtual-source-mapping.json').read_text())
 for path,source in m.items():
  if path.endswith('/index.json'):
   routes.append({'unpublishedRawPath':path,'publishedLosslessTransport':path+'.gz','decodedSHA256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'decodedBytes':Path(source).stat().st_size,'reason':'Full exact raw index is retained locally; published gzip reconstructs exact original bytes. Avoid duplicate large connector payload.'});continue
  assert path not in mapping;mapping[path]=source
 for p in [Q/name,W/name]:selection.append(str(p.relative_to(R)))
for p in [Q/'task04-native-c6-closed-launcher-c6',W/'task04-model-drift-native-preparation-c6/closed-launcher-c6',Q/'task04-native-c6-full-composition-restored-review',W/'task04-native-c6-full-composition-restored-review',Q/'task04-c7-exact-identity-source-aid',W/'task04-c7-exact-identity-source-aid']:
 selection.append(str(p.relative_to(R)))
for pattern in ['connector-transfer-44-*','task04-native-c6-root-*','task04-native-c6-restored-review-root-*','task04-c6-*-root-inspection.json','task04-c7-*-root-inspection.json','task04-c7-root-inspector-attempt01-failure.json','root-completed-*.json','connector-transfer-45-payload-reader-limit.json','user-facing-output-path-unavailable.json']:
 selection.extend(str(p.relative_to(R)) for p in Q.glob(pattern) if p.is_file())
selection.append(str((Q/'execution-progress.md').relative_to(R)))
for pattern in ['root-c6-*.py','root-c7-*.py','root-completed-*.py']:
 selection.extend(str(p.relative_to(R)) for p in W.glob(pattern))
routesPath=Q/'connector-transfer-45-content-routing.json';routesPath.open('x').write(json.dumps({'scope':'LOSSLESS_CONTENT_ONLY_NOT_PHYSICAL_RESTORATION','routes':routes,'frozenFirstMappingPreserved':True,'historicalProvenanceGaps':'First pack68rows/67hashes; supplement1Python executable hash. No runtime acceptance or clean-checkout aggregate assertion.'},indent=2)+'\n');selection.append(str(routesPath.relative_to(R)))
selection+=['work/resume/task04-transfer-45-prepare.py','work/resume/task04-transfer-45-materialize-tree.py','work/resume/task04-transfer-45-payload.py']
selection=sorted(set(selection));(W/'task04-transfer-45-selection.json').open('x').write(json.dumps(selection,indent=2)+'\n');(W/'transfer45-virtual-source-mapping.json').open('x').write(json.dumps(mapping,indent=2)+'\n')
paths=set(mapping)
for item in selection:
 p=R/item
 if p.is_dir():
  for root,dirs,files in os.walk(p,followlinks=False):
   assert not any((Path(root)/d).is_symlink() for d in dirs)
   paths.update(str((Path(root)/f).relative_to(R)) for f in files)
 else:assert p.is_file();paths.add(item)
e=os.environ.copy();alt=[Path('/dev/shm/cortex-root-storage-rescue-c5')/('transfer'+str(n)+'-objects') for n in (44,43,42)]+[Path('/tmp/cortex-root-storage-rescue')/('transfer'+str(n)+'-objects') for n in range(41,33,-1)]+[R/'.git/objects'];e['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(map(str,alt));known=set()
for entry in subprocess.check_output(['git','ls-tree','-r','-z',base],cwd=R,env=e).split(b'\0'):
 if entry:known.add(entry.split(b'\t',1)[0].split(b' ')[2].decode())
rows=[]
for path in sorted(paths):
 p=Path(mapping[path]) if path in mapping else R/path;a=p.lstat();assert stat.S_ISREG(a.st_mode) and a.st_nlink==1
 with p.open('rb') as f:b=f.read();assert ident(os.fstat(f.fileno()))==ident(a)
 assert ident(p.lstat())==ident(a)
 blob=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
 rows.append({'path':path,'sourcePath':str(p),'mode':'100644','bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':blob,'identity':ident(a),'existing':blob in known,'binary':True})
plan={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':parent,'tree':base,'localHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),'liveIndexSHA256':hashlib.sha256((R/'.git/index').read_bytes()).hexdigest(),'scope':'Completed frozen C6 candidate, independent FULL REJECT2.8, exact-identity source aid, authenticated first/supplement lossless backing transport and ROOT inspections. Mutable C7 excluded. All original122/native/private/paid/full120/ROOT approvals held. Content-only transport; explicit historical gaps and precision limits preserved.','rows':rows}
(W/'connector-transfer-plan-45.json').open('x').write(json.dumps(plan,indent=2)+'\n');print(json.dumps({'paths':len(rows),'newPaths':sum(not r['existing'] for r in rows),'newBytes':sum(r['bytes'] for r in rows if not r['existing']),'largest':max(r['bytes'] for r in rows)}))
