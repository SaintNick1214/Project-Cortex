import json,os
from pathlib import Path
assert os.getuid()==0
rows=[]
for p in [Path('/owned/healthy/private'),*sorted(Path('/owned/cases').glob('*/private'))]:
 rows.append({'path':str(p),'outputFiles':sorted(f.name for f in p.iterdir()),'uid':p.lstat().st_uid,'gid':p.lstat().st_gid,'mode':oct(p.lstat().st_mode&0o777)})
print(json.dumps({'scope':'FAILED_PUBLIC_DUMMY_RESIDUE_METADATA_ONLY','rows':rows,'exportMounted':False,'privateBytesRead':0}))
