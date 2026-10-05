from pathlib import Path
import subprocess,json,datetime,time,hashlib,sys
repo=Path('/workspace/Project-Cortex');base=repo/'_goals/convex-backend-runtime-2026-10-02/qa';w=repo/'work/resume/task04-model-drift-native-preparation-c3'
tasks=[]
for k in ['extension','regression','extra']:
 r=base/f'task04-model-drift-native-{k}-preparation-c3'
 for name,path in [('parent-original',w/k/'parent-proof/actual-chain.mjs'),('parent-adversarial',w/k/'parent-proof/adversarial-chain.mjs'),('parent-watch17',w/k/'parent-proof/independent-watch17.mjs'),('runtime-freeze',r/'scripts/offline-runtime-freeze.mjs'),('inventory',r/'scripts/inventory.mjs'),('outcomes',r/'scripts'/('offline-actual-core.mjs' if k=='regression' else 'offline-extension.mjs'))]:
  cmd=['node','--experimental-vm-modules',str(path)]+(['--verify'] if name=='inventory' else [str(r/'evidence/final-watch17-results.json')] if name=='parent-watch17' else [])
  tasks.append((r,name,cmd,path))
for k in ['extension','regression','extra']:
 r=base/f'task04-model-drift-native-{k}-preparation-c3'
 tasks.append((r,'body18',['node','--experimental-vm-modules',str(w/'independent-body18.mjs'),str(r/'scripts/parent-inputs.mjs'),str(r/'evidence/final-body18-results.json')],r/'scripts/parent-inputs.mjs'))
 tasks.append((r,'original-first-review-denial',['node','--experimental-vm-modules',str(w/'same-source-review-denial.mjs'),k],r/'scripts/guard.mjs'))
for name in ['driver-error-controls','rpc-binding-controls']:
 tasks.append((base/'task04-model-drift-native-extra-preparation-c3',name,['node','--experimental-vm-modules',str(w/f'{name}.mjs')],w/f'{name}.mjs'))
for r,name,cmd,p in tasks:
 if len(sys.argv)>1 and name not in ['parent-watch17','original-first-review-denial']:continue
 k=r.name.split('-native-')[1].split('-preparation-')[0];runName='original-'+name+'-'+k
 res=subprocess.run(['python',str(w/'run.py'),runName,*cmd],cwd=repo,capture_output=True,text=True,timeout=150)
 d=r/'evidence';keep=r/'failures/c2-imported-offline-evidence';keep.mkdir(exist_ok=True)
 for ext in ['receipt.json','stdout','stderr']:
  previous=d/f'final-{name}.{ext}'
  if previous.exists() and not (keep/previous.name).exists():(keep/previous.name).write_bytes(previous.read_bytes())
  (d/f'final-{name}.{ext}').write_bytes((w/f'{runName}.{ext}').read_bytes())
 print(r.name,name,res.returncode,res.stdout[-300:],res.stderr[-300:],flush=True)
