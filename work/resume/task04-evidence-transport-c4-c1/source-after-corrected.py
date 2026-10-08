import datetime,hashlib,importlib.util,json,os,stat
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');R=Path.cwd()
spec=importlib.util.spec_from_file_location('helper',Q/'materialize.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h);idx,m,rows,byhash=h.load(Q)
start=datetime.datetime.now(datetime.timezone.utc).isoformat();expected={r['path'] for r in rows};actual=set();nlinks={};modes={}
for root in h.ROOTS:
 for dp,dns,fns in os.walk(R/root,followlinks=False):
  for n in list(dns):
   if (Path(dp)/n).is_symlink():actual.add(str((Path(dp)/n).relative_to(R)));dns.remove(n)
  for n in fns:actual.add(str((Path(dp)/n).relative_to(R)))
h.require(actual==expected,'original full terminal membership changed')
for r in rows:
 h.require(h.present(R,r,unique=False),'original exact bytes/literal/mode missing')
 fd,n=h.parent(R,r['path'])
 try:s=os.stat(n,dir_fd=fd,follow_symlinks=False)
 finally:os.close(fd)
 h.require(stat.S_IMODE(s.st_mode)==r['mode'],'original mode changed')
 if r['kind']=='file':nlinks[str(s.st_nlink)]=nlinks.get(str(s.st_nlink),0)+1
 modes[str(r['mode'])]=modes.get(str(r['mode']),0)+1
result={'status':'PASS_EXACT_ORIGINAL_WHOLE_BYTES_MODES_LITERAL_MEMBERSHIP_UNCHANGED','utcPRE':start,'utcPOST':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':len(rows),'manifestRows':m['manifestRows'],'originalManifests':len(h.ROOTS),'literalLinks':m['literalLinks'],'originalRegularNlinkObservedPOST':nlinks,'originalModesObservedPOST':modes,'restorationNlinkRuleUnchanged':1,'earlierFailure':'source-after original files were mistakenly tested as restored nlink1; preserved raw failure; no source byte/type/mode/hash waiver','limits':'No historical inode/access-time/no-link-count-change claim; exact immutable original content/backing verified before and after.'}
(Q/'source-after-corrected-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
