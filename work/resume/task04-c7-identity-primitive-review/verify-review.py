import os,json,stat,hashlib,zlib
from pathlib import Path
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-c7-identity-primitive-review'
def ident(s):
 return {k:str(getattr(s,'st_'+k)) for k in ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')}
def held(p):
 p=str(p); l=os.lstat(p);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);a=os.fstat(fd)
 try:
  assert stat.S_ISREG(a.st_mode) and ident(l)==ident(a)
  chunks=[]
  while True:
   b=os.read(fd,65536)
   if not b:break
   chunks.append(b)
  data=b''.join(chunks);assert ident(a)==ident(os.fstat(fd))==ident(os.lstat(p))
 finally:os.close(fd)
 return data,{'path':p,'identity':ident(a),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
root=json.loads(held(W/'root-inspection.json')[0]);evidence=[]
for row in [root['pre'],root['receipt'],*root['raws']]:
 d,e=held(row['path']);assert e['bytes']==row['bytes'] and e['sha256']==row['sha256'];assert e['identity']==row['currentIdentity'];evidence.append(e)
 (W/Path(row['path']).name).write_bytes(d)
pre=json.loads(held(W/'controls-PRE.json')[0]);receipt=json.loads(held(W/'controls-receipt.json')[0]);post={r['path']:r for r in receipt['sourceToolPOST']}
for old in json.loads(held(W/'capture-verification.json')[0]):
 row=old['reference']; encoded,b=held(row['beforeByteBacking']['path']);bb=row['beforeByteBacking'];assert b['bytes']==bb['bytes'] and b['sha256']==bb['sha256'];assert b['identity']==old['heldBackingIdentity'];z=zlib.decompressobj(31);decoded=z.decompress(encoded)+z.flush();assert z.eof and not z.unused_data and not z.unconsumed_tail;d,e=held(R/old['copy']);assert d==decoded and e['bytes']==row['bytes'] and e['sha256']==row['sha256'];p=post[row['path']];assert p['equal'] and p['identity']==row['identity'] and p['sha256']==row['sha256'] and p['bytes']==row['bytes'];evidence.append({'currentEncoded':b,'currentCopy':e,'recordedPREPOSTExact':True,'gzipFullEOF':True})
assert receipt['actualExit']==0 and receipt['timeout'] is False and receipt['deadlineSeconds']==90
stdout=json.loads(held(W/'controls.stdout')[0]);assert len(stdout['results'])==20 and all(r['status']=='PASS' for r in stdout['results']);assert receipt['elapsedSeconds']<90
(W/'review-evidence.json').write_text(json.dumps({'scope':'INITIAL_CAPTURED_SOURCE_ONLY_NO_CANDIDATE_DISPATCH','heldVerifications':evidence,'recordedResults':stdout,'receiptFacts':{k:receipt[k] for k in ('actualExit','elapsedSeconds','deadlineSeconds','timeout','groupEmpty')},'freshMicrocontrols':'NOT_RUN','limits':['Recorded groupEmpty Boolean only; no actual initial PID/startTime/PGID/argv census binding','Current gzip identity does not establish earlier backing custody','No current candidate certification','No full501 audit, newproducerbindings, whole120, original122, compiler, native, private, paid or Task04 acceptance']},indent=2))
print(json.dumps({'ownedSourceCopies':len(evidence)-4,'initial20RecordedPASS':True,'initialRawExit':receipt['actualExit'],'freshCandidateExecution':False}))
