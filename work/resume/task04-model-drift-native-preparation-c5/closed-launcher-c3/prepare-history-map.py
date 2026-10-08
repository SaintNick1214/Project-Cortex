"""Read-only authenticated map backing; direct launch/import of history remains prohibited."""
from pathlib import Path
import json,gzip,hashlib
R=Path('/workspace/Project-Cortex');T=Path('/tmp/cortex-native-c5-closed-launcher-c3');B=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1';H=lambda b:hashlib.sha256(b).hexdigest();data=(B/'index.json').read_bytes();assert H(data)=='a82fb82ad92d4a9753a9c7fe612ba880f82f4893a7a6d3e211dc8ec9a4fad869';index=json.loads(data);parts=[]
for x in index['mapParts']:
 p=B/x['path'];b=p.read_bytes();assert len(b)==x['bytes']and H(b)==x['sha256'];parts.append(b)
raw=gzip.decompress(b''.join(parts));assert len(raw)==index['mapDecodedBytes']and H(raw)==index['mapDecodedSha256'];mapping=json.loads(raw);assert len(mapping['files'])==148325
out=T/'original-read-map.json';out.write_text(json.dumps({'indexSHA256':H(data),'decodedMapSHA256':H(raw),'sourceTiers':'READONLY_HISTORICAL_BACKING; NOT_EXECUTABLE_IMPORT_GRAPH; NO_ACTUAL_C11_PRIVATE_INPUT_PERMISSION','files':[{'path':str(R/x['path']),'bytes':x.get('bytes'),'sha256':x['sha256'],'kind':x['kind']}for x in mapping['files']]},separators=(',',':'))+'\n');print(json.dumps({'rows':len(mapping['files']),'path':str(out),'bytes':out.stat().st_size,'sha256':H(out.read_bytes())}))
