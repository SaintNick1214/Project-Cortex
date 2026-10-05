import datetime,importlib.util,json,os,stat
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');R=Path.cwd()
loader=Q/'restore-git-modes.py';scope={'__file__':str(loader),'__name__':'verified_source_loader'};exec(compile(loader.read_bytes(),str(loader),'exec'),scope);h=scope['load_helper'](Q);idx,m,rows,byhash=h.load(Q);rowmap={r['path']:r for r in rows}
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def meta(p):
 fd,n=h.parent(R,p)
 try:s=os.stat(n,dir_fd=fd,follow_symlinks=False)
 finally:os.close(fd)
 return {'dev':s.st_dev,'ino':s.st_ino,'nlink':s.st_nlink,'mode':stat.S_IMODE(s.st_mode),'size':s.st_size,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns,'regular':stat.S_ISREG(s.st_mode)}
expected={r['path'] for r in rows};actual=set()
for root in h.ROOTS:
 for dp,dns,fns in os.walk(R/root,followlinks=False):
  for n in list(dns):
   if (Path(dp)/n).is_symlink():actual.add(str((Path(dp)/n).relative_to(R)));dns.remove(n)
  for n in fns:actual.add(str((Path(dp)/n).relative_to(R)))
h.require(actual==expected,'post-incident full original terminal membership mismatch')
start=now();links={r['path']:meta(r['path']) for r in rows if r['kind']=='file' and meta(r['path'])['nlink']!=1};h.require(len(links)==32 and all(s['nlink']==2 for s in links.values()),'nonoperative fixture links changed')
h.require(all(p.startswith('work/resume/task04-model-drift-native-preparation-c4/') and '/parent-proof/case-' in p and '/owned-created-' in p for p in links),'unexpected hardlinked original input')
groups={}
for p,s in links.items():groups.setdefault((s['dev'],s['ino']),[]).append(p)
h.require(len(groups)==16 and all(len(ps)==2 and any(p.endswith('.DUMMY-link') for p in ps) for ps in groups.values()),'expected negativefixture hardlink pairs only')
operative={};freezepins=[]
for name,pin,count in [('extension','dad0677c535aaa56f7a52863e90f6baec8602585b99ed26d8832467ed082e683',210),('regression','89dad16e23957a4e038e385d841e87ff73c5d891bbb31eb53ca52aedcbcf429f',207),('extra','2103aa9d7337d009352962c96f5fe3be47e6c3eceda3ee52a4c61e6db74259db',318)]:
 root='_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-'+name+'-preparation-c4';fp=root+'/runtime-freeze.json';r=rowmap[fp];b=h.exactread(R,fp,r['bytes'],pin);f=json.loads(b);h.require(len(f['files'])==count,'runtime freeze row count')
 for rr in f['files']:
  p=root+'/'+rr['path'];s=meta(p);h.require(p not in links and s['regular'] and s['nlink']==1,'operative original input link guard');h.exactread(R,p,rr['bytes'],rr['sha256'],s['mode'],True);operative[p]=s
 freezepins.append({'path':fp,'sha256':pin,'rows':count})
h.require(len(operative)==735,'operative count')
before={'utc':now(),'originalNonoperativeNegativeHardlinkFixtures':[{'path':p,'sha256':rowmap[p]['sha256'],**s} for p,s in links.items()],'operative':operative,'runtimeFreezes':freezepins}
# New prospective source byte audit allows ONLY these exact negative fixtures to have nlink2.
for r in rows:h.require(h.present(R,r,unique=r['path'] not in links),'exact source content/mode/literal unchanged')
afterlinks={p:meta(p) for p in links};afteroperative={p:meta(p) for p in operative};h.require(afterlinks==links and afteroperative==operative,'source inode/mode/nlink metadata changed during own audited run')
result={'status':'PASS','utcPRE':start,'utcPOST':now(),'scope':'New prospective metadata and source-byte audit; does not backfill initial pack metadata history','before':before,'after':{'utc':now(),'nonoperative':afterlinks,'operative':afteroperative},'wholeRows':len(rows),'operativeNlink1':735,'nonoperativeNlink2':32,'allRestoredRegularNlink1Mandatory':True,'originalHardlinkTopologyNotReconstructed':True,'acceptance':'Transport only; source/native/timing acceptance stays held','historicalIncident':'Coordinator confirmed C5 inherited C4 output path mutated two original inventory files and added750 DUMMY files; earlier final source drift/diagnostic/cleanup-denial failures retained. This new prospective post-ROOT-recovery audit does not erase or backfill that history.'}
(Q/'post-incident-source-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'status':'PASS','operativeNlink1':735,'nonoperativeNegativeFixtureNlink2':32,'wholeRows':len(rows)}))
