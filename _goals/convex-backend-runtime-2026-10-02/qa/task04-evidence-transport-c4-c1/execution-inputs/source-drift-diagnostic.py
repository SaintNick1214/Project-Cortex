import json,os,stat,datetime
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');R=Path.cwd();p=Q/'restore-git-modes.py';env={'__file__':str(p),'__name__':'source_diagnostic_verified_loader'};exec(compile(p.read_bytes(),str(p),'exec'),env);h=env['load_helper'](Q);idx,m,rows,by=h.load(Q);bad=[]
for r in rows:
 try:h.require(h.present(R,r,unique=False),'missing original')
 except (ValueError,OSError) as e:
  item={'row':r,'reason':str(e)}
  try:
   fd,n=h.parent(R,r['path'])
   try:s=os.stat(n,dir_fd=fd,follow_symlinks=False)
   finally:os.close(fd)
   item['metadata']={'mode':stat.S_IMODE(s.st_mode),'size':s.st_size,'nlink':s.st_nlink,'dev':s.st_dev,'ino':s.st_ino}
   if stat.S_ISREG(s.st_mode) and s.st_size<=h.OBJECT_LIMIT:item['actualSha256']=h.sha(h.exactread(R,r['path'],s.st_size))
  except Exception as e2:item['metadataError']=str(e2)
  bad.append(item);print(json.dumps(item),flush=True)
result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mismatches':bad,'count':len(bad),'rowsScanned':len(rows),'noRepin':True,'noOriginalWrites':True};(Q/'source-drift-diagnostic-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'mismatches':len(bad),'rowsScanned':len(rows)}));raise SystemExit(1 if bad else 0)
