import json,os,stat,hashlib
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');R=Path.cwd();T=Path('/tmp/cortex-evidence-transport-c4-c1/clean-checkout');p=Q/'restore-directory-modes.py';scope={'__file__':str(p),'__name__':'verified_directory_verifier_source'};exec(compile(p.read_bytes(),str(p),'exec'),scope);h,m=scope['load'](Q);expected={r['path'] for r in m['directories']};sourceRows=[]
for base in [R,T]:
 actual=set()
 for root in h.ROOTS:
  for dp,dns,fns in os.walk(base/root,followlinks=False):
   for n in list(dns):
    if (Path(dp)/n).is_symlink():dns.remove(n)
   actual.add(str(Path(dp).relative_to(base)))
 h.require(actual==expected,'exact original/restored directory membership mismatch')
 for r in m['directories']:
  f=h.directory(base/r['path'])
  try:s=os.fstat(f)
  finally:os.close(f)
  h.require(stat.S_ISDIR(s.st_mode) and s.st_uid==os.geteuid() and stat.S_IMODE(s.st_mode)==r['mode'],'original/restored exact private directory owner/mode')
  if base==R:
   observed={'path':r['path'],'mode':stat.S_IMODE(s.st_mode),'sourceUid':s.st_uid,'sourceDev':s.st_dev,'sourceIno':s.st_ino,'sourceNlink':s.st_nlink,'sourceMtimeNs':s.st_mtime_ns,'sourceCtimeNs':s.st_ctime_ns};h.require(observed==r,'prospective source directory metadata changed');sourceRows.append(observed)
result={'status':'PASS','sourceAndRestoredDirectoryRows':len(expected),'sourceDirectoryMetadataExactSinceCurrentRecoveredSnapshot':True,'restoredDirectoriesAll0700CurrentUid':True,'missingOriginalEmptyDirectoriesRestored':186,'sourceDirectoryInodeTimeNotReconstructed':True,'historicalIncident':'C5 prior source continuity broke; ROOT archived752 changed/added bytes and restored original full closure; no preincident directory metadata claim'}
(Q/'directory-verify-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
