import pathlib,os,json,hashlib,shutil,stat,datetime
R=pathlib.Path('/workspace/Project-Cortex');O=R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c5';W=R/'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6';OT=pathlib.Path('/tmp/cortex-native-c5-closed-launcher-c5');T=pathlib.Path('/dev/shm/cortex-native-c6-closed-launcher-c6');T.mkdir(mode=0o700,exist_ok=False)
H=lambda b:hashlib.sha256(b).hexdigest();refs=[];oldq='task04-native-c5-closed-launcher-c5';newq='task04-native-c6-closed-launcher-c6'
def change(b):return b.replace(str(O).encode(),str(W).encode()).replace(str(OT).encode(),str(T).encode()).replace(oldq.encode(),newq.encode())
def cp(src,dst,transform=False):
 b=src.read_bytes();nb=change(b) if transform else b;dst.parent.mkdir(parents=True,exist_ok=True,mode=0o700);dst.write_bytes(nb);os.chmod(dst,0o600);refs.append({'source':str(src),'sourceBytes':len(b),'sourceSHA256':H(b),'destination':str(dst),'destinationBytes':len(nb),'destinationSHA256':H(nb),'transform':'EXACT_C5_W_T_Q_NAMESPACE_LITERALS_ONLY' if transform and b!=nb else 'BYTE_EXACT'})
for p in O.iterdir():
 if p.name=='selfseal.json' or p.suffix not in ['.mjs','.cjs','.py','.json']:continue
 cp(p,W/p.name,p.suffix in ['.mjs','.cjs','.py','.json'])
# Closed mirror source rows, not failed-run directories or broad scratch copies.
mp=json.loads((O/'mirror-source-transform-map.json').read_bytes())
for r in mp['inputs']:
 old=pathlib.Path(r['destination']);new=pathlib.Path(str(old).replace(str(OT),str(T)));cp(old,new,old.suffix in ['.mjs','.cjs','.json','.ts'])
 r['c5MirrorBeforeFork']={'path':str(old),'bytes':r['destinationBytes'],'sha256':r['destinationSHA256']};r['destination']=str(new);b=new.read_bytes();r['destinationBytes']=len(b);r['destinationSHA256']=H(b)
 # Original backing remains immutable C5, not a fabricated new archive.
(W/'mirror-source-transform-map.json').write_text(json.dumps(mp,indent=2)+'\n')
for name in ['package-graph.json','original-read-map.json','historical-plan-index.json','historical-freeze-after-scratch.json','historical-offline-runtime-freeze-extension.json','historical-offline-runtime-freeze-regression.json','historical-offline-runtime-freeze-extra.json']:
 cp(OT/name,T/name,name=='historical-plan-index.json')
# Create only seven captured package links; no whole node_modules link.
g=json.loads((T/'package-graph.json').read_bytes());dirs=[T/'mirror/node_modules',T/'mirror/node_modules/@esbuild',T/'mirror/node_modules/@types']
for d in dirs:d.mkdir(parents=True,exist_ok=True,mode=0o700)
links=[]
def ident(p):
 s=p.lstat();return {k:getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','nlink','size','mtime_ns','ctime_ns']}
for n in g['packages']:
 p=T/'mirror/node_modules'/n;target=R/'node_modules'/n;p.symlink_to(target,target_is_directory=True);lit=str(target);links.append({'package':n,'path':str(p),'target':lit,'identity':ident(p),'literalTargetBytes':len(lit.encode()),'literalTargetSHA256':H(lit.encode()),'capturedPackageRows':sum(x['path'].startswith(lit+'/') for x in g['files'])})
(T/'package-aliases.json').write_text(json.dumps({'packageGraphSHA256':H((T/'package-graph.json').read_bytes()),'directories':[{'path':str(p),'identity':ident(p)} for p in dirs],'links':links,'wholeNodeModulesAlias':False,'NODE_PATH':'ABSENT'},indent=2)+'\n')
# Only source-defining refs are re-rooted; immutable original archives stay borrowed.
p=json.loads((O/'prepared-source-inputs.json').read_bytes())
for r in p['files']:
 old=pathlib.Path(r['path']);new=pathlib.Path(str(old).replace(str(O),str(W)).replace(str(OT),str(T)));r['path']=str(new)
 if not new.exists():cp(old,new,old.suffix in ['.json','.mjs','.cjs'])
 b=new.read_bytes();r['bytes']=len(b);r['sha256']=H(b)
(W/'prepared-source-inputs.json').write_text(json.dumps(p,indent=2)+'\n')
(W/'c5-fork-preimages.json').write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'EXACT_FROZEN_C5_NAMESPACE_FORK_NOT_APPROVAL','rows':refs},indent=2)+'\n')
print('forked',len(refs),'rows; original122 held')
