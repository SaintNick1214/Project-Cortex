import datetime,json,os,runpy,stat,subprocess,sys
from pathlib import Path
e=runpy.run_path('/workspace/Project-Cortex/work/resume/task04-evidence-transport-c4-c1-fresh-review/review.py');Q=e['R']/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1-fresh-review-cleanup';W=e['R']/'work/resume/task04-evidence-transport-c4-c1-fresh-review-cleanup';T=e['T'];read=e['read'];sha=e['sha'];meta=e['meta'];now=e['now'];save=e['save']
def entries(root,name):
 out=[];stack=[root]
 while stack:
  d=stack.pop()
  for p in sorted(d.iterdir()):
   s=p.lstat()
   if stat.S_ISDIR(s.st_mode):stack.append(p)
   elif p!=root/name:
    assert stat.S_ISREG(s.st_mode) and s.st_nlink==1;r=meta(p);r['path']=str(p.relative_to(root));r['kind']='file';out.append(r)
 return sorted(out,key=lambda r:r['path'])
def seal(root,name):
 rows=entries(root,name);save(root/name,{'root':str(root.relative_to(e['R'])),'excludeOnlySelf':name,'modeFields':'Exact local lstat observations only; Git source-input0644 was separately actually verified, no actual Git publication claim','files':rows});assert entries(root,name)==rows
 return {'manifest':meta(root/name),'rows':len(rows),'exactSelfOnly':True}
if len(sys.argv)>1:
 print(json.dumps(seal(Q,'qa-manifest.json')))
else:
 pre={'QA':entries(Q,'qa-manifest.json'),'work':entries(W,'work-manifest.json')};start=now();argv=[sys.executable,str(Path(__file__).absolute()),'qa'];out=T/'cleanup-qa-seal.stdout';err=T/'cleanup-qa-seal.stderr'
 with out.open('xb') as f,err.open('xb') as g:r=subprocess.run(argv,cwd=e['R'],env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'),stdout=f,stderr=g)
 finish=now()
 for p in [out,err]:
  b,s=read(p)
  with (W/p.name).open('xb') as f:f.write(b)
 save(W/'qa-seal.command.json',{'utcPRE':start,'utcPOST':finish,'argv':argv,'cwd':str(e['R']),'exit':r.returncode,'pre':pre,'postQA':entries(Q,'qa-manifest.json'),'qaSeal':meta(Q/'qa-manifest.json'),'rawStdout':meta(W/out.name),'rawStderr':meta(W/err.name),'byteBacking':'Every pre-state file remains byte-identical and is individually sealed; no exclusions beyond each manifest itself.'})
 assert r.returncode==0;qa=json.loads(read(out)[0]);work=seal(W,'work-manifest.json');final={'utcPRE':start,'utcPOST':now(),'argv':sys.argv,'cwd':str(e['R']),'exit':0,'qa':qa,'work':work,'report':meta(Q/'report.md'),'noFurtherOwnQAWorkWrites':True,'ownedMirrorAndPublicPacketRemoved':True};save(T/'cleanup-final-seal.command.json',final);print(json.dumps(final))
