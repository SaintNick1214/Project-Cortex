import pathlib,hashlib,json,datetime
base=pathlib.Path(__file__).resolve().parent.parent
manifest=base/'qa-manifest.json'
rows=[{'path':str(p.relative_to(base)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in sorted(base.rglob('*'))if p.is_file() and p!=manifest]
manifest.write_text(json.dumps({'version':1,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'classification':'ISOLATED_OFFLINE_IMPLEMENTATION_REVIEW_PENDING','excludesOnly':'qa-manifest.json','rows':rows},indent=2)+'\n')
actual={str(p.relative_to(base))for p in base.rglob('*')if p.is_file() and p!=manifest};assert actual=={r['path']for r in rows}
for row in rows:
 p=base/row['path'];assert p.stat().st_size==row['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256']
print(json.dumps({'files':len(rows),'reportSHA256':hashlib.sha256((base/'report.md').read_bytes()).hexdigest(),'manifestSHA256':hashlib.sha256(manifest.read_bytes()).hexdigest(),'native':'NOT_RUN','paid':'NOT_RUN'}))
