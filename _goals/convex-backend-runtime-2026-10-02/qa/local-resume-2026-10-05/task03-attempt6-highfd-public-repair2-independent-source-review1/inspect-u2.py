"""Pure independent source-manifest shape probe; no subject dispatch."""
import json
from pathlib import Path
base=next(Path(p).parent for p in DATA if p.endswith('/executable-review-source-manifest.json'))
manifest=json.loads(DATA[str(base/'executable-review-source-manifest.json')])
def brief(value):
    if isinstance(value,list):return {'type':'list','count':len(value),'first':value[:2]}
    if isinstance(value,dict):return {'type':'dict','keys':list(value),'values':{k:brief(v)for k,v in value.items()}}
    return value
RESULT={'schema':'INDEPENDENT_U2_MANIFEST_SHAPE','manifest':{k:brief(v)for k,v in manifest.items()},'sourceOnly':True}
