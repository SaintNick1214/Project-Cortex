exec(open('/workspace/Project-Cortex/work/resume/task04-default-experiment-guard-c1-review/freeze.py').read().replace("pr.get('files',[])","pr.get('sources',[])"))
checks=[]
for x in pr['sources']:
 p=r/x['path'];b=p.read_bytes();checks.append({**x,'match':len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256']})
(out/'preparation-reference-verification.json').write_text(json.dumps({'rows':len(checks),'mismatches':[x for x in checks if not x['match']],'checks':checks},indent=2)+'\n')
