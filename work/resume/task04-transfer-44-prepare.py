import pathlib,json,hashlib,os,subprocess,datetime,sys
root=pathlib.Path.cwd();w=root/'work/resume';qa='_goals/convex-backend-runtime-2026-10-02/qa/'
allowed_source=[]
paths=set(allowed_source)
for item in sys.argv[1:]:
 assert item in json.loads((w/'task04-transfer-44-selection.json').read_text())
 p=root/item
 if p.is_dir():
  for parent,dirs,files in os.walk(p,followlinks=False):
   for d in list(dirs):
    child=pathlib.Path(parent)/d
    if child.is_symlink():paths.add(str(child.relative_to(root)));dirs.remove(d)
   paths.update(str((pathlib.Path(parent)/f).relative_to(root)) for f in files)
 else:assert p.is_file();paths.add(item)
mapping=json.loads((w/'transfer44-virtual-source-mapping.json').read_text()); paths.update(mapping); known=set(); objectenv=os.environ.copy(); objectenv['GIT_ALTERNATE_OBJECT_DIRECTORIES']='/dev/shm/cortex-root-storage-rescue-c5/transfer43-objects:/dev/shm/cortex-root-storage-rescue-c5/transfer42-objects:/tmp/cortex-root-storage-rescue/transfer41-objects:/tmp/cortex-root-storage-rescue/transfer40-objects:/tmp/cortex-root-storage-rescue/transfer39-objects:/tmp/cortex-root-storage-rescue/transfer38-objects:/tmp/cortex-root-storage-rescue/transfer37-objects:/tmp/cortex-root-storage-rescue/transfer36-objects:/tmp/cortex-root-storage-rescue/transfer35-objects:/tmp/cortex-root-storage-rescue/transfer34-objects:'+str(root/'.git/objects')
for entry in subprocess.check_output(['git','ls-tree','-r','-z','a503d0fe393f6240e7125d3b040437680d48b6a4'],env=objectenv).split(b'\0'):
 if entry:known.add(entry.split(b'\t',1)[0].split(b' ')[2].decode())
rows=[]
for path in sorted(paths):
 p=pathlib.Path(mapping[path]) if path in mapping else root/path;b=os.readlink(p).encode() if p.is_symlink() else p.read_bytes();blob=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
 try:
  text=b.decode('utf-8');binary=len(json.dumps({'path':path,'sourcePath':str(p),'mode':'100644','type':'blob','content':text},ensure_ascii=False).encode())>5*1024*1024
 except UnicodeDecodeError:binary=True
 rows.append({'path':path,'sourcePath':str(p),'mode':'120000' if p.is_symlink() else '100644','bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':blob,'existing':blob in known,'binary':binary})
plan={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':'5619c79df18cd0765d5f6ab0b6fbcb37934ff597','tree':'a503d0fe393f6240e7125d3b040437680d48b6a4','localHead':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'scope':'Stable ROOT C6 retained-failure/source-delta inspections, native repair source aid only, prior publication/CI and lossless scratchcleanup evidence. Mutable C6 implementation and its still-live storage/preimage packet excluded; referenced C6 live-storage backing transport awaits complete freeze. No original122/actualapproval/native/private/paid/timing release.','rows':rows}
p=w/'connector-transfer-plan-44.json';p.open('x').write(json.dumps(plan,indent=2)+'\n');print(json.dumps({'paths':len(rows),'newPaths':sum(not x['existing'] for x in rows),'newBytes':sum(x['bytes'] for x in rows if not x['existing']),'binaryPaths':sum(x['binary'] and not x['existing'] for x in rows),'links':sum(x['mode']=='120000' for x in rows)}))
