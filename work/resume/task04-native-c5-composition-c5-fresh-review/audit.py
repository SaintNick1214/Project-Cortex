import importlib.util,pathlib,json,gzip
p=pathlib.Path(__file__).with_name('review.py');s=importlib.util.spec_from_file_location('review',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
out={'sourcepins':[],'bindings':{},'runs':[],'historical':{}}
for row in m.load(m.Q/'sourcepins.json')['rows']:
 actual=m.held(row['path'])[0];out['sourcepins'].append({'path':row['path'],'equal':all(actual[k]==row[k] for k in ['bytes','sha256','identity'])})
commands=m.load(m.Q/'prepared122bindings.json')['commands'];orig=m.load(m.R/'work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json')['commands'];a={x['id']:x for x in orig};out['bindings']={'count':len(commands),'sameIDs':{x['id'] for x in commands}==set(a),'rows':[{ 'id':x['id'],'originalFieldsEqual':all(x[k]==a[x['id']][k] for k in ['entrySha256','profile','proposedArgv','sourceExpected','writeFamily'] if k in a[x['id']]),'mirrorSHAEqual':m.held(x['mirrorEntry'])[0]['sha256']==x['mirrorEntrySHA256']} for x in commands]}
for run in m.load(m.Q/'evidence-index.json')['runs']:
 r=m.load(run['receipt']['path']);rr={'run':run['run'],'utcPRE':r['utcPRE'],'utcPOST':r['utcPOST'],'sourceEquality':r.get('sourceByteHashesEqual'),'original8Equality':r.get('original8LiteralRowsAndIdentitiesEqual'),'commands':[]}
 for c in r['commands']:
  cc={k:v for k,v in c.items() if k not in ['sourcePRE','sourcePOST']};cc['sourcePRECount']=len(c.get('sourcePRE',[]));rr['commands'].append(cc)
 out['runs'].append(rr)
plan=m.load(m.T/'historical-freeze-after-scratch.json');rows=plan['rows'];out['historical']={'rows':len(rows),'bytes':sum(x['bytes'] for x in rows),'membershipSHA256':m.H(json.dumps(sorted([{'path':x['path'],'bytes':x['bytes'],'sha256':x['sha256']} for x in rows],key=lambda x:x['path']),separators=(',',':')).encode()),'kinds':sorted(set(x.get('kind','') for x in rows)),'wholeRouteExecuted':False}
# Verify recorded historical input backing on final complete snapshot; retain every captured row and honest current observations, no new duplicate history backing.
found=[]
for d in m.T.glob('prepared-freeze-after-scratch-*'):
 lp=d/'consumed-version-ledger.jsonl'
 if lp.exists():
  count=sum(1 for _ in open(lp));found.append({'path':str(lp),'count':count})
out['historical']['actualLedgers']=found
m.save('independent-raw-evidence-audit',out)
print(json.dumps({'pins':len(out['sourcepins']),'pinsAllEqual':all(x['equal'] for x in out['sourcepins']),'bindings':out['bindings']['count'],'sameIDs':out['bindings']['sameIDs'],'bindingsAllEqual':all(x['originalFieldsEqual'] and x['mirrorSHAEqual'] for x in out['bindings']['rows']),'historical':out['historical'],'runs':[(r['run'],[(c.get('argv',[])[-1],c.get('exitCode',c.get('exit')),c.get('timeout')) for c in r['commands']]) for r in out['runs']]}))
