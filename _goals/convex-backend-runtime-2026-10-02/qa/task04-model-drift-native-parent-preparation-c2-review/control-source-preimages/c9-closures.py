import runpy,json,hashlib
from pathlib import Path
r=Path.cwd();w=r/'work/resume/task04-model-drift-native-parent-preparation-c2-review';own=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-parent-preparation-c2-review';m=runpy.run_path(str(w/'verify-full-closure-v2.py'));out=[]
for name,count,heading in [('task04-terminal-capture-parent-inputs-c9-review',92,'## Verdict: REJECT'),('task04-terminal-capture-parent-inputs-c9-restoration-review',16,'## Verdict: PASS_PREPARATION_ONLY')]:
 p=own.parent/name;result=m['verify'](p,'qa-manifest.json');assert result['files']==count;b=(p/'report.md').read_bytes();assert heading in b.decode();(own/(name+'-report.md.text')).write_bytes(b);out.append(dict(result,reportSHA256=hashlib.sha256(b).hexdigest(),verdict=heading))
(own/'historical-c9-closures.json').write_text(json.dumps({'status':'PASS','closures':out},indent=2)+'\n');print(json.dumps({'status':'PASS','c9Counts':[x['files'] for x in out]}))
