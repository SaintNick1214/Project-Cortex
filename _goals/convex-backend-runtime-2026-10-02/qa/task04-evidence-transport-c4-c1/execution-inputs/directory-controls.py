import json,os,stat
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');T=Path('/tmp/cortex-evidence-transport-c4-c1/directory-controls');T.mkdir();p=Q/'restore-directory-modes.py';scope={'__file__':str(p),'__name__':'directory_control_source'};exec(compile(p.read_bytes(),str(p),'exec'),scope);restore=scope['restore'];h,m=scope['load'](Q);r0=h.ROOTS[0];r1=h.ROOTS[1];results=[]
def reject(name,fn):
 try:fn()
 except (ValueError,OSError,AssertionError) as e:results.append({'control':name,'reject':True,'reason':str(e)});return
 raise AssertionError(name+' accepted')
b=T/'private-first';b.mkdir();res=restore(Q,b,True);assert res['created']==8 and all(stat.S_IMODE((b/r).stat().st_mode)==0o700 for r in h.ROOTS);results.append({'control':'all-eight-new-roots-created-private700-first','pass':True});assert restore(Q,b,True)['changed']==0;results.append({'control':'root-private-idempotence','pass':True})
b=T/'Git755';b.mkdir();fd=h.directory(b/r0,True);os.close(fd);assert stat.S_IMODE((b/r0).stat().st_mode)==0o755;res=restore(Q,b,True);assert res['changed']==1 and stat.S_IMODE((b/r0).stat().st_mode)==0o700;results.append({'control':'Git755-root-to-original700-with-identity-evidence','pass':True})
b=T/'bad-mode';b.mkdir();fd=h.directory(b/r0,True);os.close(fd);fd=h.directory(b/r1,True);os.close(fd);os.chmod(b/r1,0o777);reject('all-directory-preflight-before-any-chmod',lambda:restore(Q,b,True));assert stat.S_IMODE((b/r0).stat().st_mode)==0o755
b=T/'wrong-owner';b.mkdir();fd=h.directory(b/r0,True);os.close(fd);getuid=os.geteuid;uid=getuid();os.geteuid=lambda:uid+1
try:reject('directory-owner-deny-before-mutation',lambda:restore(Q,b,True))
finally:os.geteuid=getuid
assert stat.S_IMODE((b/r0).stat().st_mode)==0o755
b=T/'unknown-directory';b.mkdir();fd=h.directory(b/(r0+'/UNMAPPED'),True);os.close(fd);reject('unknown-directory-deny-before-mutation',lambda:restore(Q,b,True));assert stat.S_IMODE((b/r0).stat().st_mode)==0o755
b=T/'symlink-root';b.mkdir();fd=h.directory(b/Path(r0).parent,True);os.close(fd);foreign=T/'foreign';foreign.mkdir();os.chmod(foreign,0o755);(b/r0).symlink_to(foreign,target_is_directory=True);reject('symlink-root-and-foreign-target-never-followed',lambda:restore(Q,b,True));assert stat.S_IMODE(foreign.stat().st_mode)==0o755
b=T/'wrong-type';b.mkdir();fd=h.directory(b/Path(r0).parent,True);os.close(fd);(b/r0).write_bytes(b'X');reject('directory-regular-type-collision',lambda:restore(Q,b,True));assert (b/r0).read_bytes()==b'X'
link=next(r for r in h.load(Q)[2] if r['kind']=='literal-symlink');b=T/'literal';b.mkdir();h.create(b,link);literal=os.readlink(os.fsencode(b/link['path']));res=restore(Q,b,True);assert os.readlink(os.fsencode(b/link['path']))==literal;results.append({'control':'literal-terminal-link-never-directory-followed','pass':True})
(Q/'directory-controls-results.json').write_text(json.dumps({'status':'PASS','total':len(results),'controls':results,'scope':'current recovered source directory metadata, ordinary nofollow descriptors only'},indent=2)+'\n');print(json.dumps({'directoryControls':len(results),'status':'PASS'}))
