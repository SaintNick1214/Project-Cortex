from pathlib import Path
import json,hashlib
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6';T=Path('/dev/shm/cortex-native-c6-closed-launcher-c6');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';H=lambda b:hashlib.sha256(b).hexdigest();sources=[]
def read(p):
 b=p.read_bytes();sources.append({'path':str(p),'bytes':len(b),'sha256':H(b)});return b
old='_goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c8/evidence/full-preservation01-failure/scripts--guard.mjs.text';oldBytes=read(R/old);oldRow={'path':str(R/old),'bytes':len(oldBytes),'sha256':H(oldBytes)}
per={};full={};manifests=[]
for kind in ['extension','regression','extra']:
 root=Q/('task04-model-drift-native-'+kind+'-preparation-c5');pres=json.loads(read(root/'historical-preservation.json'))
 for packet in pres['packets']:
  base=R/packet['path'];assert str(base).startswith(str(Q)+'/task04-') and '..' not in Path(packet['path']).parts
  p=base/packet['manifest'];b=read(p);assert H(b)==packet['manifestSHA256'];m=json.loads(b);assert len(m['files'])==packet['rows'];rows=m['files'];full[str(p)]={'path':str(p),'bytes':len(b),'sha256':H(b),'kind':'EXACT_READONLY_HISTORICAL_MANIFEST'};manifests.append({'profile':kind,'packet':packet,'manifest':sources[-1]})
  if 'fullClosure' in packet:
   index=root/packet['fullClosure']['path'];i=read(index);assert len(i)==packet['fullClosure']['bytes'] and H(i)==packet['fullClosure']['sha256'];rows=json.loads(i)['files'];assert len(rows)==packet['fullClosure']['rows'];assert packet['path'].endswith('task04-terminal-capture-parent-inputs-c7-review') and len(rows)==83
  for r in rows:
   assert not Path(r['path']).is_absolute() and all(x not in ['', '.', '..']for x in r['path'].split('/'));p=str(base/r['path']);value={'path':p,'bytes':r['bytes'],'sha256':r['sha256'],'kind':'EXACT_READONLY_HISTORICAL_PACKET_MEMBER'}
   if p in full:assert full[p]['bytes']==value['bytes'] and full[p]['sha256']==value['sha256']
   else:full[p]=value
 row=oldRow;per['offline-runtime-freeze-'+kind]=[{'path':row['path'],'bytes':row['bytes'],'sha256':row['sha256'],'kind':'EXACT_OLD_GUARD_NEGATIVE_HISTORY_FIXTURE'}]
per['freeze-after-scratch']=sorted(full.values(),key=lambda r:r['path'])
plan={'kind':'SOURCE_BOUND_HISTORICAL_INPUT_RECIPES_NO_AMBIENT_READ_MAP_PERMISSION','perId':per,'sourcePins':sources,'manifests':manifests,'routes':{'offline-runtime-freeze3':'scripts/offline-runtime-freeze.mjs line9 exact old guard text; all other history in these tests is OWN DUMMY','freeze-after-scratch':'source file line5 -> guard.preservationPreflight line35 -> verifyHistoricalPacket line31-34; exact declared packet manifests/full83 extension, regression,extra; readonly data, not executable import'},'historicalOriginal8Index':'a82fb82ad92d4a9753a9c7fe612ba880f82f4893a7a6d3e211dc8ec9a4fad869','actualOriginalEntriesExecuted':0}
index={'kind':plan['kind'],'perId':{},'sourceRecipeProvenance':'Exact original offline-runtime-freeze line9/freeze-after-scratch line5 -> original guardverifyHistoricalPacket; immutable source bindings in prepared-source-inputs'}
for ident,rows in per.items():
 p=T/('historical-'+ident+'.json');encoded=(json.dumps({'id':ident,'rows':rows},separators=(',',':'))+'\n').encode();p.write_bytes(encoded);index['perId'][ident]={'path':str(p),'bytes':len(encoded),'sha256':H(encoded),'rows':len(rows),'historicalBytes':sum(r['bytes']for r in rows)}
(T/'historical-plan-index.json').write_text(json.dumps(index,indent=2)+'\n');(T/'historical-recipe-provenance.json').write_text(json.dumps({k:v for k,v in plan.items()if k!='perId'},indent=2)+'\n');print(json.dumps({'ids':list(per),'rows':{k:len(v)for k,v in per.items()},'bytes':{k:sum(r['bytes']for r in v)for k,v in per.items()},'plan':str(T/'historical-plan-index.json')}))
