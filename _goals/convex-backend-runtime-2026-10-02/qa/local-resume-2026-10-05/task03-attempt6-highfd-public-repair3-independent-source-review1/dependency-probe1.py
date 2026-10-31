import json
from pathlib import Path
U=Path(REVIEW_DIR).parent/'task03-attempt6-actual-public-custody-readiness-repair3'
M=json.loads(DATA[str(U/'closed-source-manifest.json')])
RESULT={'scope':'INDEPENDENT_U3_DEPENDENCY_INSPECTION','sourceEligibility':False,'members':[{'path':r['path'],'bytes':r['bytes'],'sha256':r['sha256']} for r in M['members']], 'documents':{p:DATA[p].decode() for p in DATA if p.startswith(str(U)) and p.endswith('.json') and any(x in Path(p).name for x in ('entry','handoff','semantic','reference'))}}
