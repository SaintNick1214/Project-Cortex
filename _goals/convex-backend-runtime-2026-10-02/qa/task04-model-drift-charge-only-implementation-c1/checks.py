from pathlib import Path
import json,hashlib,subprocess,datetime,os,shutil
root=Path('/workspace/Project-Cortex');base=root/'_goals/convex-backend-runtime-2026-10-02/qa';qa=base/'task04-model-drift-charge-only-implementation-c1';work=root/'work/resume/task04-model-drift-charge-only-implementation-c1';node='/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(name,value):(qa/name).write_text(json.dumps(value,indent=2)+'\n')
def setup():
 old=base/'task04-gateway-terminal-composition-c1-review'
 paths={r['path'] for r in json.loads((old/'current-freeze.json').read_text())['files']}
 for line in (old/'native-imports.ndjson').read_text().splitlines():paths.add(json.loads(line)['resolved'])
 paths.update(str(root/p) for p in ['tests/unit/runtime/model-policy-admission.test.ts','tests/unit/runtime/model-policy-model-drift.test.ts','convex-dev/runtimeModelPolicy.ts','tsconfig.json','jest.config.mjs','eslint.config.js','tsconfig.lint.json','package.json','package-lock.json'])
 paths={p for p in paths if Path(p).is_file()}
 config=json.loads((old/'jest.native-probe.json').read_text());config['roots']=[str(root/'tests/unit/runtime')];config['testMatch']=[str(root/'tests/unit/runtime/model-policy-admission.test.ts'),str(root/'tests/unit/runtime/model-policy-model-drift.test.ts')];config['resolver']=str(qa/'resolver.cjs');save('jest.native.json',config)
 current=json.loads((old/'jest.current.json').read_text());current['resolver']=str(qa/'resolver.cjs');save('jest.current.json',current)
 resolver="""const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');module.exports=(request,options)=>{const resolved=['./profile.js','./extraction.js'].includes(request)&&options.basedir==='/workspace/Project-Cortex/src/domain'?options.defaultResolver(request.slice(0,-3)+'.ts',options):options.defaultResolver(request,options);if(path.isAbsolute(resolved)){const f=JSON.parse(fs.readFileSync(__dirname+'/current-freeze.json','utf8'));if(resolved.includes('/catalog/')||resolved.includes('gateway-historical'))throw Error('HISTORICAL_CURRENT_IMPORT_DENIED');const row=f.files.find(r=>r.path===resolved);if(!row)throw Error('UNCATALOGED_CURRENT_IMPORT '+resolved);const hash=crypto.createHash('sha256').update(fs.readFileSync(resolved)).digest('hex');if(hash!==row.sha256)throw Error('CURRENT_IMPORT_CHANGED '+resolved);fs.appendFileSync(__dirname+'/current-imports.ndjson',JSON.stringify({request,resolved,sha256:hash,verified:true})+'\\n');}return resolved;};"""
 (qa/'resolver.cjs').write_text(resolver);paths.update(str(qa/p) for p in ['resolver.cjs','jest.native.json','jest.current.json'])
 save('current-freeze.json',dict(files=[dict(path=p,sha256=sha(p),bytes=Path(p).stat().st_size) for p in sorted(paths)],scope='Actual current policy/new tests/Gateway; no historical mapping'))
 for p in paths:
  relative=Path(p).relative_to(root);dst=qa/'execution-source-preimages'/relative;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(Path(p).read_bytes())
 (qa/'current-imports.ndjson').write_text('')
def verify():
 f=json.loads((qa/'current-freeze.json').read_text());assert all(sha(r['path'])==r['sha256'] for r in f['files']);return len(f['files'])
def run(label,argv,expected=0,timeout=60):
 env={'PATH':str(root/'work/resume/toolchain-bin')+':'+str(Path(node).parent)+':/usr/bin:/bin','TMPDIR':str(work),'NO_COLOR':'1'}
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();pre=verify();p=subprocess.run(argv,cwd=root,env=env,capture_output=True,text=True,timeout=timeout);end=datetime.datetime.now(datetime.timezone.utc).isoformat();(qa/(label+'.stdout')).write_text(p.stdout);(qa/(label+'.stderr')).write_text(p.stderr)
 save(label+'-receipt.json',dict(argv=argv,cwd=str(root),environment=env,startUTC=start,endUTC=end,exit=p.returncode,expected=expected,verifiedClosureFiles=pre,postClosureFiles=verify()))
 print(label,p.returncode,p.stdout[-800:],p.stderr[-1800:],flush=True);return p
if __name__=='__main__':
 import sys
 mode=sys.argv[1]
 if mode=='setup':setup();print('guarded closure',verify())
 elif mode=='native-list':run(mode,[node,'--experimental-vm-modules',str(root/'node_modules/jest/bin/jest.js'),'--config',str(qa/'jest.native.json'),'--runInBand','--no-cache','--listTests','--json'])
 elif mode=='native-run':run(mode,[node,'--experimental-vm-modules',str(root/'node_modules/jest/bin/jest.js'),'--config',str(qa/'jest.native.json'),'--runInBand','--no-cache','--json','--outputFile',str(qa/'native-results.json')])
 elif mode=='current-list':run(mode,[node,'--experimental-vm-modules',str(root/'node_modules/jest/bin/jest.js'),'--config',str(qa/'jest.current.json'),'--runInBand','--no-cache','--listTests','--json'])
 elif mode=='current-run':run(mode,[node,'--experimental-vm-modules',str(root/'node_modules/jest/bin/jest.js'),'--config',str(qa/'jest.current.json'),'--runInBand','--no-cache','--json','--outputFile',str(qa/'current-results.json')])
 elif mode=='historical-list':run(mode,[node,str(qa/'historical/run-historical.mjs'),'--list'])
 elif mode=='historical-run':run(mode,[node,str(qa/'historical/run-historical.mjs'),'--run'])
 elif mode=='types':run(mode,[node,str(root/'node_modules/typescript/bin/tsc'),'--noEmit'])
 elif mode=='lint':run(mode,[node,str(root/'node_modules/eslint/bin/eslint.js'),'convex-dev/runtimeModelPolicy.ts','tests/unit/runtime/model-policy-model-drift.test.ts','--report-unused-disable-directives'])
