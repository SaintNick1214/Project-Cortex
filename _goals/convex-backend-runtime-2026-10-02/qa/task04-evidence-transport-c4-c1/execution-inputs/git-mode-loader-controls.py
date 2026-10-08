import hashlib,json,os
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');T=Path('/tmp/cortex-evidence-transport-c4-c1/git-mode-loader-controls');T.mkdir()
p=Q/'restore-git-modes.py';source=p.read_bytes();env={'__file__':str(p),'__name__':'loader_controls_source'};exec(compile(source,str(p),'exec'),env);load=env['load_helper'];results=[]
def reject(name,fn):
 try:fn()
 except (ValueError,OSError,AssertionError) as e:results.append({'control':name,'rejected':True,'reason':str(e)});return
 raise AssertionError(name+' accepted')
(T/'packet-alias').symlink_to(Q.absolute(),target_is_directory=True);reject('helper-source-all-ancestry-nofollow',lambda:load(T/'packet-alias'))
b=T/'helper-bad-source';b.mkdir();data=bytearray((Q/'materialize.py').read_bytes());data[0]^=1;(b/'materialize.py').write_bytes(data);reject('approved-py-source-hash-before-execution',lambda:load(b))
b=T/'helper-oversize';b.mkdir();(b/'materialize.py').write_bytes((Q/'materialize.py').read_bytes()+b'X');reject('approved-py-source-exact-size-before-buffer',lambda:load(b))
b=T/'helper-short';b.mkdir();(b/'materialize.py').write_bytes(b'X');reject('approved-py-source-short-size',lambda:load(b))
b=T/'helper-nlink2';b.mkdir();(b/'materialize.py').write_bytes((Q/'materialize.py').read_bytes());os.link(b/'materialize.py',b/'alias');reject('approved-py-source-nlink1',lambda:load(b))
(Q/'git-mode-loader-controls-results.json').write_text(json.dumps({'status':'PASS','total':len(results),'controls':results,'normalizerSourceSha256':hashlib.sha256(source).hexdigest(),'ownCachedBytecodeRead':False},indent=2)+'\n');print(json.dumps({'normalizerLoaderControls':len(results),'status':'PASS'}))
