import json,os
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');T=Path('/tmp/cortex-evidence-transport-c4-c1/clean-checkout');T.mkdir()
p=Q/'restore-git-modes.py';env={'__file__':str(p),'__name__':'seed_source_loader'};exec(compile(p.read_bytes(),str(p),'exec'),env);h=env['load_helper'](Q);idx,m,rows,byhash=h.load(Q)
root='_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c4-source-fresh-review';seed=[r for r in rows if r['path'].startswith(root+'/') and r['path']!=root+'/qa-manifest.json'];h.require(len(seed)==17 and all(r['kind']=='file' and r['mode']==0o600 for r in seed),'exact SOURCE17 Git-like seed required')
proof=[]
for r in seed:
 data=h.exactread(Path.cwd(),r['path'],r['bytes'],r['sha256'],r['mode']);h.create(T,r,data);os.chmod(T/r['path'],0o644);s=(T/r['path']).stat();proof.append({'path':r['path'],'bytes':r['bytes'],'sha256':r['sha256'],'sourceMappedMode':r['mode'],'seedGitMode':0o644,'dev':s.st_dev,'ino':s.st_ino,'nlink':s.st_nlink})
(Q/'git-seed-results.json').write_text(json.dumps({'status':'EXACT_17_FILE_SOURCE_QA_GIT644_PARTIAL_ROOT_SEEDED','target':str(T),'files':proof,'ownCachedBytecodeRead':False},indent=2)+'\n');print(json.dumps({'seeded':len(seed),'mode':'0644','target':str(T)}))
