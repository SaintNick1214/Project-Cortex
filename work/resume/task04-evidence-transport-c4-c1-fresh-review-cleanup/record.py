import gzip,json,os,runpy,subprocess,sys
from pathlib import Path
e=runpy.run_path(str(Path('/workspace/Project-Cortex/work/resume/task04-evidence-transport-c4-c1-fresh-review')/'review.py'));R=e['R'];Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1-fresh-review-cleanup';W=Path(__file__).parent;T=e['T'];read=e['read'];meta=e['meta'];save=e['save'];now=e['now']
start=now();argv=[sys.executable,str(W/'cleanup.py')];pre=[meta(W/'cleanup.py'),meta(Path(__file__)),meta(e['P']/'qa-manifest.json')] if 'P' in e else [meta(W/'cleanup.py'),meta(Path(__file__)),meta(e['Q']/'qa-manifest.json')]
out=T/'fresh-cleanup.stdout';err=T/'fresh-cleanup.stderr'
with out.open('xb') as f,err.open('xb') as g:r=subprocess.run(argv,cwd=R,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'),stdout=f,stderr=g)
end=now();streams={}
for channel,p in [('stdout',out),('stderr',err)]:
 b,s=read(p);dest=Q/('cleanup.'+channel+'.gz')
 with dest.open('xb') as f:f.write(gzip.compress(b,mtime=0))
 streams[channel]={'raw':meta(p),'compressedExactByteBacking':meta(dest),'decodedSha256':e['sha'](b),'decodedBytes':len(b)}
save(Q/'cleanup.command.json',{'utcPRE':start,'utcPOST':end,'argv':argv,'cwd':str(R),'exit':r.returncode,'pre':pre,'postScripts':[meta(W/'cleanup.py'),meta(Path(__file__))],'rawStreams':streams,'sourcePrePostFullInventoryProof':str(Q/'cleanup-before.json'),'postOutcome':str(Q/'cleanup-results.json'),'byteBacking':'Scripts unchanged; exact owned file bytes proven against frozen preserved complete source archive and candidate pinned input files before deletion. Literal targets never read.'});print(json.dumps({'exit':r.returncode,'receipt':str(Q/'cleanup.command.json')}));sys.exit(r.returncode)
