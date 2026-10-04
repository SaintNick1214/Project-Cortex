import json,gzip,hashlib,datetime,sys,traceback
from pathlib import Path
R=Path('/workspace/Project-Cortex');C=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-source-tier-design-c2';O=C.parent/'task04-native-source-tier-c2-fresh-review'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(b):return hashlib.sha256(b).hexdigest()
r={'argv':sys.argv,'cwd':str(R),'utcPre':now(),'scope':'SEALED C2 RETAINED CONTEXT ONLY','results':[],'pre':{},'post':{}}
def read(p):
 b=p.read_bytes();r['pre'][str(p)]={'bytes':len(b),'sha256':sha(b)};return b
try:
 live={x['path']:x for x in json.loads(read(C/'current-source-before.json'))['rows']};old={x['path']:x for x in json.loads(read(C/'selected-historical-sources.json'))['rows']}
 for profile in ['extra','extension','regression']:
  g=json.loads(read(C/(profile+'-graph.json')));base=g['base'];path=base+'/scripts/cli-prerequisites.mjs';newbytes=gzip.decompress(read(C/live[path]['preimage']));s=newbytes.decode();before=gzip.decompress(read(C/old[path]['preimage'])).decode()
  assert s==before.replace("logLevel:'silent'});const {router,effect}=await import", "logLevel:'silent'});reviewed();const {router,effect}=await import")
  assert sha(newbytes)==live[path]['sha256'];parent=gzip.decompress(read(C/old[base+'/scripts/parent-inputs.mjs']['preimage'])).decode();assert 'livePreflight(phase);' in parent
  r['results'].append({'profile':profile,'newCliHash':sha(newbytes),'exactImmediateFullInsertion':True,'parentDefaultFull':True,'dynamicSiteInventory':len(g['dynamicAndRequireAndProcessSites']),'actualAcceptance':'NOT_EXECUTED'})
 a=json.loads(read(C/'current-source-after.json'));assert len(a['historicalDrift'])==12 and not a['duringCommandsDrift'];r['sealedHistoricalDrift']=12;r['sealedDuringCommandsDrift']=0;r['currentMutableC4ReadOrAccepted']=False
 for p,expected in r['pre'].items():
  b=Path(p).read_bytes();r['post'][p]={'bytes':len(b),'sha256':sha(b)};assert r['post'][p]==expected
 r['exitCode']=0
except BaseException:r['exitCode']=1;r['failure']=traceback.format_exc()
r['utcPost']=now();(O/'context-audit-receipt.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));sys.exit(r['exitCode'])
