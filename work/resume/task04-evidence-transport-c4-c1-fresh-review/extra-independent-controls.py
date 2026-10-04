import gzip,json,os,resource,runpy,stat,sys,zlib
from pathlib import Path
e=runpy.run_path(str(Path(__file__).parent/'review.py'));C=e['C'];Q=e['Q'];T=e['T']/'independent-controls';T.mkdir();M=e['M'];save=e['save'];h,idx,m,rows=e['load']();results=[]
def reject(name,fn):
 try:fn()
 except (ValueError,OSError,AssertionError,zlib.error) as ex:results.append({'name':name,'expected':'reject','actual':'reject','error':str(ex)});return
 raise AssertionError(name+' accepted')
def passed(name,fn):fn();results.append({'name':name,'expected':'pass','actual':'pass'})
# Production cap, with a small encoded bomb and positive bounded calls. No cap is raised.
c=zlib.compressobj(wbits=31);out=[];left=h.MAP_LIMIT+1
while left:
 n=min(left,1048576);out.append(c.compress(b'A'*n));left-=n
out.append(c.flush());encoded=b''.join(out)
def actual_map_bomb():
 d=h.Decode([encoded],h.MAP_LIMIT);left=h.MAP_LIMIT
 while left:n=min(left,1048576);d.read(n);left-=n
 d.finish()
reject('actual-production-map-max-plus-one-bounded-gzip',actual_map_bomb)
oversize=T/'sparse-object-max-plus-one'
with oversize.open('xb') as f:f.truncate(h.OBJECT_LIMIT+1)
reject('actual-production-object-max-plus-one-before-read',lambda:h.exactread(T,oversize.name,h.OBJECT_LIMIT+1))
# Byte zero/empty transport and segmented gzip boundaries are meaningful stream cases.
enc=zlib.compress(b'',wbits=31);passed('empty-gzip-zero-ceiling',lambda:h.Decode([enc],0).finish())
enc=zlib.compress(b'boundary',wbits=31)
def segmented():
 d=h.Decode([enc[i:i+1] for i in range(len(enc))],8);assert d.read(8)==b'boundary';d.finish()
passed('gzip-every-encoded-byte-separate-boundary',segmented)
reject('bool-is-not-decoded-bound',lambda:h.Decode([enc],True))
# Directory all-preflight protects first valid root and prevents creation of other missing roots.
d=e['module']('restore-directory-modes.py');restore=d['restore'];r0=h.ROOTS[0];r1=h.ROOTS[1]
b=T/'directory-late-invalid';b.mkdir();fd=h.directory(b/r0,True);os.close(fd);os.chmod(b/r0,0o755);fd=h.directory(b/r1,True);os.close(fd);os.chmod(b/r1,0o750)
reject('directory0750-no-first-chmod-no-missing-root-mkdir',lambda:restore(C,b,True));assert stat.S_IMODE((b/r0).stat().st_mode)==0o755 and all(not (b/r).exists() for r in h.ROOTS[2:])
# Real complete directory idempotence under an explicitly small FD limit.
resource.setrlimit(resource.RLIMIT_NOFILE,(64,resource.getrlimit(resource.RLIMIT_NOFILE)[1]));res=restore(C,M);assert res['changed']==0 and res['created']==0 and res['directoriesVerified']==62205
results.append({'name':'complete62205directory-idempotence-real-FDlimit64','expected':'pass','actual':'pass','resultCounts':{k:res[k] for k in ['changed','created','directoriesVerified']}})
save(Q/'extra-independent-controls-results.json',{'status':'PASS','controls':results,'total':len(results),'actualProductionMapCap':h.MAP_LIMIT,'bombEncodedBytes':len(encoded),'actualObjectCap':h.OBJECT_LIMIT,'allFixturesOwned':str(T)});print(json.dumps({'status':'PASS','total':len(results)}))
