import pathlib,json,re,hashlib
R=pathlib.Path('/workspace/Project-Cortex');W=R/'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6';A=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-generated-producer-source-audit';rows=json.loads((A/'per-id-source-routes.json').read_text());maps=json.loads((W/'mirror-source-transform-map.json').read_text())['inputs'];m={x['source']:x for x in maps};rules={}
for x in rows:
 closure=[m[str(R/r['source']['path'])] for r in x['sourceReferenceClosure'] if str(R/r['source']['path']) in m and r['source']['path'].endswith('.mjs')];calls=[]
 for p in closure:
  src=pathlib.Path(p['destination']).read_text()
  for i,l in enumerate(src.splitlines(),1):
   if 'SourceTextModule(' in l or 'runInContext(' in l:
    names=re.findall(r"['\"]([^'\"]+\.mjs)['\"]",l)
    direct=[v for v in closure if pathlib.Path(v['destination']).name in {pathlib.Path(n).name for n in names}]
    if not direct:
     # Resolve source-copy variables from exact pinned enclosing producer literals.
     allnames={pathlib.Path(n).name for n in re.findall(r"['\"]([^'\"]+\.mjs)['\"]",src)}
     direct=[v for v in closure if pathlib.Path(v['destination']).name in allnames]
    calls.append({'producer':p['destination'],'producerSHA256':p['destinationSHA256'],'line':i,'kind':'VM_TEXT_CONSUMER','sources':[{'path':v['destination'],'bytes':v['destinationBytes'],'sha256':v['destinationSHA256']} for v in direct],'parent':x['parentTwoFieldActualBody'] and i==28,'canonical':x['parentTwoFieldActualBody'] and i==15,'json':x['parentTwoFieldActualBody'] and i==21,'resolution':'SOURCE_LINE_LITERAL_AND_REFERENCE_BINDINGS; MULTI_CONSTRUCTOR_LINE_FINITE_SET_NOT_COLUMN_SPECIFIC'})
 rules[x['id']]={'entry':m[str(R/x['entryPin']['path'])]['destination'],'calls':calls,'parentProfile':x['id'].split('-')[-1] if x['parentTwoFieldActualBody'] else None,'readiness':'COLUMN_SPECIFIC_SELECTOR_PROOF_PENDING_WHERE_MULTIPLE_SOURCE_ROWS'}
(W/'finite-producer-rules.json').write_text(json.dumps({'kind':'FIXED_122_SOURCE_BOUND_VM_RULES','perId':rules},indent=2)+'\n');print('rules',len(rules),'calls',sum(len(x['calls']) for x in rules.values()))
