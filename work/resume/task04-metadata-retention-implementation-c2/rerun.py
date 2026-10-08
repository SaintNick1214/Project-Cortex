from pathlib import Path
import json,subprocess
q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c2');w=Path('work/resume/task04-metadata-retention-implementation-c2');old=q.parent/'task04-metadata-retention-implementation-c1'
tags=["store-final-metadata-stage","store-final-metadata-purge","metadata-resource-01","store-final-c2-collect-original-groups","store-retry-adapter","store-retry-c2-capability","store-retry-c2-capability-c10","store-final-c2-admission","store-final-c2-owned","store-final-c2-retained-refinements","store-final-c2-stream","store-final-independent","store-final-independent-account-load","store-final-independent-codec","store-final-independent-async","store-final-independent-money","store-final-regression-offline-check","store-final-regression-hostile","store-final-regression-refinement-check","store-final-regression-independent","strict-types-vm","typed-lint-complete"]
for tag in tags:
 j=json.loads((old/(tag+'-receipt.json')).read_text());argv=[x.replace('task04-metadata-retention-implementation-c1','task04-metadata-retention-implementation-c2') for x in j['argv']]
 x=subprocess.run(['python3',str(w/'capture.py'),'rerun-'+tag,'@'+str(w/'inputs.json'),*argv],capture_output=True)
 print(json.dumps({'tag':tag,'exit':x.returncode,'stdoutTail':x.stdout.decode()[-220:],'stderrTail':x.stderr.decode()[-220:]}),flush=True)
