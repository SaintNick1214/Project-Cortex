import datetime,hashlib,json,pathlib,subprocess,sys,shutil
base=pathlib.Path(__file__).resolve().parent.parent
name=sys.argv[1]; argv=sys.argv[2:]
folder=base/'checks'/name;folder.mkdir(exist_ok=False)
shutil.copytree(base/'fixture',folder/'fixture-preimage')
source={str(p.relative_to(base)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((base/'fixture').rglob('*')) if p.is_file()}
(folder/'source-pre.json').write_text(json.dumps(source,sort_keys=True,indent=2)+'\n')
root=base.parents[3]
protected=json.loads((base/'source-pre.json').read_text())['sources']
external_pre=[{'path':r['path'],'bytes':(root/r['path']).stat().st_size,'sha256':hashlib.sha256((root/r['path']).read_bytes()).hexdigest(),'unchanged':hashlib.sha256((root/r['path']).read_bytes()).hexdigest()==r['sha256']} for r in protected]
(folder/'external-source-pre.json').write_text(json.dumps(external_pre,indent=2)+'\n')
if not all(r['unchanged'] for r in external_pre): raise RuntimeError('PROTECTED_SOURCE_DRIFT_BEFORE_CHECK')
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
r=subprocess.run(argv,cwd=base/'fixture',capture_output=True)
end=datetime.datetime.now(datetime.timezone.utc).isoformat()
external_post=[{'path':r['path'],'bytes':(root/r['path']).stat().st_size,'sha256':hashlib.sha256((root/r['path']).read_bytes()).hexdigest(),'unchanged':hashlib.sha256((root/r['path']).read_bytes()).hexdigest()==r['sha256']} for r in protected]
(folder/'external-source-post.json').write_text(json.dumps(external_post,indent=2)+'\n')
if not all(r['unchanged'] for r in external_post):r.returncode=125
post={str(p.relative_to(base)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((base/'fixture').rglob('*')) if p.is_file()}
(folder/'source-post.json').write_text(json.dumps(post,sort_keys=True,indent=2)+'\n')
(folder/'stdout').write_bytes(r.stdout);(folder/'stderr').write_bytes(r.stderr)
(folder/'run.json').write_text(json.dumps({'argv':argv,'cwd':str(base/'fixture'),'startUTC':start,'endUTC':end,'exit':r.returncode},indent=2)+'\n')
print(json.dumps({'name':name,'exit':r.returncode,'stdout':r.stdout.decode(),'stderr':r.stderr.decode()}))
sys.exit(r.returncode)
