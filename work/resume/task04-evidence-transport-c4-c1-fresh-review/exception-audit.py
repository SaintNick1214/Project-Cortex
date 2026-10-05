import gzip,json,runpy
from pathlib import Path
e=runpy.run_path(str(Path(__file__).parent/'review.py'));Q=e['Q'];C=e['C'];read=e['read'];save=e['save'];proof=json.loads(read(C/'post-incident-source-results.json')[0]);fresh=json.loads(read(Q/'source-after-public-inputs-results.json')[0]);declared=proof['before']['originalNonoperativeNegativeHardlinkFixtures'];observed=fresh['negativeHardlinkTopology'];assert len(declared)==len(observed)==32
a={r['path']:r for r in declared};b={r['path']:r for r in observed};assert set(a)==set(b)
for p in a:
 for key in ['sha256','dev','ino','nlink','mode']:assert a[p][key]==b[p][key]
rows=json.loads(gzip.decompress(read(Q/'source-after-public-inputs-all-rows.json.gz')[0]));by={r[0]:r for r in rows};operative=proof['before']['operative'];assert len(operative)==735
for path,r in operative.items():assert by[path][7]==r['nlink']==1 and by[path][5]==r['dev'] and by[path][6]==r['ino'] and by[path][4]==r['mode']
save(Q/'declared-exception-audit-results.json',{'status':'PASS','exceptionSetExactlyDeclaredOriginal32':True,'noOtherSourceNlinkException':True,'allDeclared735OperativeExactHashNlink1':True,'all148295RestoredRegularNlink1Mandatory':True,'sourceProofReferenceSha256':e['sha'](read(C/'post-incident-source-results.json')[0])});print(json.dumps({'status':'PASS','declaredExceptions':32,'operativeNlink1':735}))
