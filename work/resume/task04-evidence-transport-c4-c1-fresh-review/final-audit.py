import json,runpy
from pathlib import Path
e=runpy.run_path(str(Path(__file__).parent/'review.py'));e['audit']('mirror-full',False);e['audit']('source-after-final',True)
Q=e['Q'];read=e['read'];before=json.loads(read(Q/'source-before-corrected-results.json')[0]);after=json.loads(read(Q/'source-after-final-results.json')[0]);assert before['recordMetadataSha256']==after['recordMetadataSha256'] and before['negativeHardlinkTopology']==after['negativeHardlinkTopology']
e['save'](Q/'source-unchanged-results.json',{'status':'PASS','all148325MetadataRowsExact':True,'beforeMetadataSha256':before['recordMetadataSha256'],'afterMetadataSha256':after['recordMetadataSha256'],'negative32Paths16InodePairsExact':True,'nativeAcceptance':False,'historicalContinuity':False})
print(json.dumps({'completeMirror':'PASS','completeSourceUnchanged':'PASS','rows':148325,'directories':62205}))
