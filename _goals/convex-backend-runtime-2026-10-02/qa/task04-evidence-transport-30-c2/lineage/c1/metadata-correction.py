import json,gzip,hashlib,shutil,datetime,sys
from pathlib import Path
OUT=Path('/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-30');PRE=OUT/'preimages/initial-candidate';PRE.mkdir()
def sha(b):return hashlib.sha256(b).hexdigest()
r={'argv':sys.argv,'utcPre':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reason':'Original root manifest is 17,783,968 bytes, above connector request cap; retain original report directly and restore manifest from existing content archive.','failures':[]}
for name in ('materialize.py','transport-map.json.gz'):shutil.copyfile(OUT/name,PRE/name)
p=OUT/'transport-map.json.gz';initial=p.read_bytes();m=json.loads(gzip.decompress(initial));row=next(r for r in m['files'] if r[0]=='qa-manifest.json');m['directOriginalPaths']=['report.md'];m['originalManifest']={'path':m['originalRoot']+'/qa-manifest.json','bytes':row[2],'sha256':row[1],'transport':'existing unique-content archive; materialization required before original frozen manifest verification'};m['originalExclusions']={'prefix':m['originalRoot']+'/','exceptDirect':['report.md']};new=gzip.compress(json.dumps(m,separators=(',',':'),ensure_ascii=True).encode(),compresslevel=9,mtime=0);assert len(new)<=5*1024*1024;p.write_bytes(new)
h=OUT/'materialize.py';text=h.read_text();assert sha(initial) in text;h.write_text(text.replace(sha(initial),sha(new)))
# Preserve original manifest preimage through its already verified content-addressed archive, avoiding an untransportable redundant direct blob.
raw=OUT/'preimages/source/qa-manifest.json';assert sha(raw.read_bytes())==row[1] and raw.stat().st_size==row[2];raw.unlink();(OUT/'preimages/source/manifest-preimage-reference.json').write_text(json.dumps(m['originalManifest'],indent=2)+'\n')
r.update({'initialMapSha256':sha(initial),'finalMapSha256':sha(new),'originalManifest':m['originalManifest'],'utcPost':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':0});(OUT/'metadata-correction-receipt.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
