import pathlib,json,re,hashlib
R=pathlib.Path('/workspace/Project-Cortex');W=R/'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6';T=pathlib.Path('/dev/shm/cortex-native-c6-closed-launcher-c6');p=W/'finite-producer-rules.json';d=json.loads(p.read_text());mp=json.loads((W/'mirror-source-transform-map.json').read_text())['inputs'];bydest={r['destination']:r for r in mp};byoriginal={r['source']:r for r in mp};contract=json.loads((R/'work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json').read_text());commands={x['id']:x for x in contract['commands']};evidence=[]
H=lambda b:hashlib.sha256(b).hexdigest()
def row(r):return{'path':r['destination'],'bytes':r['destinationBytes'],'sha256':r['destinationSHA256']}
def graph(seeds,profiles,skip=()):
 result={};queue=[]
 for name in seeds:
  for r in mp:
   if r['destination'].endswith('/scripts/'+name) and any('task04-model-drift-native-'+k+'-preparation-c5/scripts/' in r['destination'] for k in profiles):queue.append(r)
 while queue:
  r=queue.pop();q=r['destination']
  if q in result or pathlib.Path(q).name in skip:continue
  b=pathlib.Path(q).read_bytes();assert len(b)==r['destinationBytes'] and H(b)==r['destinationSHA256'];result[q]=row(r)
  for spec in re.findall(r"(?:from\s*|import\s*\()['\"]([^'\"]+)['\"]",b.decode()):
   if not spec.startswith('.'):continue
   nxt=str((pathlib.Path(q).parent/spec).resolve())
   if not nxt.endswith('.mjs'):continue
   assert nxt in bydest,('UNKNOWN_FIXED_LOADER_IMPORT',q,spec)
   queue.append(bydest[nxt])
 return list(result.values())
for id,recipe in d['perId'].items():
 for rule in recipe['calls']:
  producer=pathlib.Path(rule['producer']).name;profile=id.rsplit('-',1)[-1];profiles=['extension','regression','extra'] if producer=='body-controls.mjs' else [profile] if profile in ['extension','regression','extra'] else ['extension','regression','extra'];basis=None
  if rule['resolution'].endswith('REQUIRES_DYNAMIC_SELECTOR_PROOF'):
   if producer=='body-controls.mjs':rule['sources']=graph(['peer.mjs','publication-artifacts.mjs'],profiles,skip=['guard.mjs']);basis='EXACT_LOAD_PEER_PUBLICATION_PLUS_LITERAL_RELATIVE_IMPORTS'
   elif producer in ['actual-driver-harness.mjs','probe-driver-harness.mjs','reviewer-queue-controls.mjs','sdk-supported-controls.mjs']:rule['sources']=graph(['publication-artifacts.mjs','driver.mjs'],profiles,skip=['guard.mjs']);basis='EXACT_TWO_LOAD_SEEDS_RECURSIVE_STATIC_LINKER_CACHE_GUARD_SYNTHETIC'
   elif producer=='management-custody-controls.mjs':rule['sources']=graph(['provision.mjs'],profiles,skip=['guard.mjs']);basis='EXACT_PROVISION_SEED_RECURSIVE_STATIC_IMPORTS_GUARD_SYNTHETIC'
   elif producer=='management-entry-controls.mjs':rule['sources']=graph(['provision.mjs','retire.mjs'],profiles,skip=['guard.mjs']);basis='EXACT_ORIGINAL_CONTROL_MODE_SET_PROVISION_RETIRE_RELATIVE_IMPORTS'
   elif producer=='independent-body18.mjs':original=commands[id]['proposedArgv'][3];rule['sources']=[row(byoriginal[original])];basis='EXACT_FIXED_ARGV_SOURCEPATH_PARENT_NO_OPTIONAL_SOURCE_ARGUMENT'
   elif id=='OWN_VM_CONSUMER_CONTROL':basis='EXACT_MARKED_OWN_TEST_SELECTOR_SET_NOT_ORIGINAL_OR_ROOT_ROUTE'
   else:raise Exception(('UNRESOLVED_FINITE_SELECTOR',id,producer))
   rule['resolution']=basis
  if producer=='offline-runtime-freeze.mjs' and rule['line']==3:
   history=json.loads((T/('historical-offline-runtime-freeze-'+profile+'.json')).read_text())['rows'];assert len(history)==1;r=history[0];rule['sources'].append({k:r[k]for k in ['path','bytes','sha256']});basis='EXACT_ORIGINAL_LINE9_OLD_GUARD_OVERRIDE_NEGATIVE_PLUS_CURRENT_GUARD'
  if basis:evidence.append({'id':id,'producer':rule['producer'],'line':rule['line'],'columnStart':rule['columnStart'],'consumer':rule['kind'],'basis':basis,'sources':rule['sources']})
 recipe['readiness']='FINITE_SOURCE_SELECTORS_BOUND; ORIGINAL_EXECUTION_HELD'
p.write_text(json.dumps(d,indent=2)+'\n');(W/'finite-selector-lineage.json').write_text(json.dumps({'scope':'EXACT_ORIGINAL_CALL_SEEDS_AND_STATIC_IMPORT_RECIPES_NO_CODE_EXECUTION','rows':evidence},indent=2)+'\n');print('resolved',len(evidence),'fixed callsite recipes')
# Source-defining output pin refresh is a declared setup operation.
p=W/'prepared-source-inputs.json';d=json.loads(p.read_text())
for r in d['files']:
 b=pathlib.Path(r['path']).read_bytes();r['bytes']=len(b);r['sha256']=H(b)
p.write_text(json.dumps(d,indent=2)+'\n')
