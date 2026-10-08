from pathlib import Path
import hashlib,json,shutil
r=Path('/workspace/Project-Cortex'); q=r/'_goals/convex-backend-runtime-2026-10-02/qa'; subject=q/'task04-default-experiment-guard-implementation-c1'; out=q/'task04-default-experiment-guard-c1-review'
def row(p):
 b=p.read_bytes();return {'path':str(p.relative_to(r)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
m=json.loads((subject/'qa-manifest.json').read_text()); actual=sorted(str(p.relative_to(subject)) for p in subject.rglob('*') if p.is_file() and p.name!='qa-manifest.json'); expected=sorted(x['path'] for x in m['rows']); checks=[]
for x in m['rows']:
 p=subject/x['path']; b=p.read_bytes();checks.append({**x,'match':len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256']})
refs=json.loads((subject/'source-evidence.json').read_text())['files']; prep=q/'task04-default-model-qualification-preparation/source-evidence.json'; pr=json.loads(prep.read_text()); print('prep source keys',pr.keys())
paths=set(p for p in subject.rglob('*') if p.is_file()); paths.update(r/x['path'] for x in refs); paths.update([r/'.agents/roles/pessimistic-judge.md',r/'.agents/skills/judge-task/SKILL.md',r/'_research/prompts/convex-backend-runtime-2026-10-02.md'])
for x in pr.get('files',[]): paths.add(r/x['path'])
rows=[row(p) for p in sorted(paths)]; (out/'pre-check-fingerprints.json').write_text(json.dumps(rows,indent=2)+'\n')
for p in sorted(paths):
 target=out/'preimages'/p.relative_to(r);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
(out/'subject-manifest-verification.json').write_text(json.dumps({'manifest':row(subject/'qa-manifest.json'),'rows':len(checks),'completeSet':actual==expected,'mismatches':[x for x in checks if not x['match']],'checks':checks},indent=2)+'\n')
scratch=r/'work/resume/task04-default-experiment-guard-c1-review';shutil.copytree(subject/'fixture',scratch/'fixture',dirs_exist_ok=True);shutil.copyfile(subject/'initial14-manifest.json',scratch/'initial14-manifest.json');(scratch/'scripts').mkdir(exist_ok=True);shutil.copyfile(subject/'scripts/offline-check.mjs',scratch/'scripts/offline-check.mjs')
print('protected',len(rows),'subject rows',len(checks),'complete',actual==expected,'matches',all(x['match'] for x in checks))
