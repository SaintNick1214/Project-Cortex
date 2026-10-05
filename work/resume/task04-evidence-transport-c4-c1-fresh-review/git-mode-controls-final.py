import hashlib,json,os,stat
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');O=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1-fresh-review');T=Path('/tmp/cortex-evidence-transport-c4-c1-fresh-review/git-mode-controls-final');T.mkdir()
p=Q/'restore-git-modes.py';source=p.read_bytes();env={'__file__':str(p),'__name__':'mode_normalizer_control_source'};exec(compile(source,str(p),'exec'),env);norm=env['normalize'];h=env['load_helper'](Q);idx,m,rows,byhash=h.load(Q)
r1=rows[0];r2=rows[1];data=h.exactread(Path.cwd(),r1['path'],r1['bytes'],r1['sha256'],r1['mode']);data2=h.exactread(Path.cwd(),r2['path'],r2['bytes'],r2['sha256'],r2['mode']);results=[]
def reject(name,fn):
 try:fn()
 except (ValueError,OSError,AssertionError) as e:results.append({'control':name,'rejected':True,'reason':str(e)});return
 raise AssertionError(name+' accepted')
def seed(name):
 b=T/name;b.mkdir();h.create(b,r1,data);os.chmod(b/r1['path'],0o644);return b
b=seed('positive');res=norm(Q,b);assert res['changed']==1 and stat.S_IMODE((b/r1['path']).stat().st_mode)==0o600 and (b/r1['path']).read_bytes()==data;results.append({'control':'exact-Git644-to-original600','pass':True});assert norm(Q,b)['changed']==0;results.append({'control':'exact600-idempotent-zero-chmod','pass':True})
b=seed('preflight-all-before-chmod');h.create(b,r2,data2);os.chmod(b/r2['path'],0o777);reject('wrong-mode-anywhere-denies-before-any-chmod',lambda:norm(Q,b));assert stat.S_IMODE((b/r1['path']).stat().st_mode)==0o644
for name,mut in [('wrong-bytes',lambda b:(b/r1['path']).write_bytes(b'X'*len(data))),('wrong-size',lambda b:(b/r1['path']).write_bytes(data+b'X')),('nlink2',lambda b:os.link(b/r1['path'],b/'outside-alias')),('unknown-filelike',lambda b:(b/r1['path']).parent.joinpath('unmapped').write_bytes(b'unknown'))]:
 b=seed(name);mut(b);reject(name+'-before-chmod',lambda b=b:norm(Q,b));assert stat.S_IMODE((b/r1['path']).stat().st_mode)==0o644
b=T/'terminal-symlink';b.mkdir();h.directory(b/Path(r1['path']).parent,True);foreign=T/'foreign';foreign.write_bytes(data);os.chmod(foreign,0o644);(b/r1['path']).symlink_to(foreign);reject('wrong-type-terminal-link-no-follow-no-chmod',lambda:norm(Q,b));assert stat.S_IMODE(foreign.stat().st_mode)==0o644
b=seed('owner-mismatch');geteuid=os.geteuid;uid=geteuid();os.geteuid=lambda:uid+1
try:reject('existing-owner-mismatch',lambda:norm(Q,b))
finally:os.geteuid=geteuid
assert stat.S_IMODE((b/r1['path']).stat().st_mode)==0o644
b=T/'ancestor-link';b.mkdir();(b/'_goals').symlink_to(T/'positive/_goals',target_is_directory=True);reject('ordinary-ancestor-required',lambda:norm(Q,b))
r644=next(r for r in rows if r['kind']=='file' and r['mode']==0o644);d=h.exactread(Path.cwd(),r644['path'],r644['bytes'],r644['sha256'],0o644);b=T/'no-reverse-mode';b.mkdir();h.create(b,r644,d);os.chmod(b/r644['path'],0o600);reject('no600-to644-or-other-transition',lambda:norm(Q,b));assert stat.S_IMODE((b/r644['path']).stat().st_mode)==0o600
link=next(r for r in rows if r['kind']=='literal-symlink');b=T/'literal-idempotent';b.mkdir();h.create(b,link);literal=os.readlink(os.fsencode(b/link['path']));res=norm(Q,b);assert res['changed']==0 and os.readlink(os.fsencode(b/link['path']))==literal;results.append({'control':'literal-exact-link-idempotent-no-chmod-no-follow','pass':True})
(O/'git-mode-controls-final-results.json').write_text(json.dumps({'status':'PASS','total':len(results),'controls':results,'normalizerSourceSha256':hashlib.sha256(source).hexdigest(),'materializerSourceSha256':env['HELPER_SHA'],'ownBytecodeRead':'NO_DIRECT_SOURCE_COMPILE'},indent=2)+'\n');print(json.dumps({'gitModeControls':len(results),'status':'PASS'}))
