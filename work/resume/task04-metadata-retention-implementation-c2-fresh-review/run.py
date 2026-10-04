from pathlib import Path
import json,subprocess
q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c2'); w=Path('work/resume/task04-metadata-retention-implementation-c2-fresh-review')
tags=json.loads((w/'execute-tags.json').read_text())
for tag in tags:
 j=json.loads((q/(tag+'-receipt.json')).read_text())
 x=subprocess.run(['python3',str(w/'capture.py'),'execute-'+tag,'@'+str(w/'inputs.json'),*j['argv']],capture_output=True)
 print(json.dumps({'tag':tag,'exit':x.returncode,'tail':x.stdout.decode()[-350:],'stderr':x.stderr.decode()[-250:]}),flush=True)
