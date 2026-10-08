import importlib.util,json,os,stat
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');T=Path('/tmp/cortex-evidence-transport-c4-c1/clean-checkout');R=Path.cwd()
spec=importlib.util.spec_from_file_location('helper',Q/'materialize.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h);idx,m,rows,byhash=h.load(Q)
counts={'file':0,'literal-symlink':0};metadata=[]
for r in rows:
 for b in [R,T]:
  fd,n=h.parent(b,r['path'])
  try:s=os.stat(n,dir_fd=fd,follow_symlinks=False)
  finally:os.close(fd)
  h.require(stat.S_IMODE(s.st_mode)==r['mode'],'source/restored original mode mismatch')
  if r['kind']=='file' and b==T:h.require(s.st_nlink==1,'restored unique inode')
 counts[r['kind']]+=1
(Q/'mode-corrected-results.json').write_text(json.dumps({'status':'PASS','sourceAndRestorationModesExact':counts,'restoredRegularNlink1':counts['file'],'sourceLiteralModes':sorted({r['mode'] for r in rows if r['kind']=='literal-symlink'}),'basis':'stat(dir_fd,follow_symlinks=False); no target traversal'},indent=2)+'\n');print(json.dumps({'modeAudit':'PASS','rows':len(rows)}))
