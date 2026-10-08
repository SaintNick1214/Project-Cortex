from pathlib import Path
import hashlib,json,datetime,os,uuid,stat
q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c1');now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();start=now();effects=[]
for p in sorted((q/'preimages').rglob('*')):
 if not p.is_file() or p.is_symlink() or p.stat().st_nlink<=1:continue
 old=p.stat();b=p.read_bytes();h=hashlib.sha256(b).hexdigest();tmp=p.with_name(p.name+'.unique-'+uuid.uuid4().hex)
 with tmp.open('xb') as f:f.write(b)
 os.chmod(tmp,stat.S_IMODE(old.st_mode))
 assert tmp.stat().st_nlink==1 and tmp.read_bytes()==b
 os.replace(tmp,p);after=p.stat();assert after.st_nlink==1 and hashlib.sha256(p.read_bytes()).hexdigest()==h
 effects.append({'path':str(p.relative_to(q)),'effectUtc':now(),'rawSha256':h,'bytes':len(b),'beforeInode':old.st_ino,'beforeNlink':old.st_nlink,'afterInode':after.st_ino,'afterNlink':after.st_nlink,'mode':stat.S_IMODE(after.st_mode)})
remaining=[str(p.relative_to(q)) for p in (q/'preimages').rglob('*') if p.is_file() and p.stat().st_nlink!=1]
assert not remaining
operative=[p for d in ['fixture','fixture-vm','regression'] for p in (q/d).rglob('*') if p.is_file()]
assert all(p.stat().st_nlink==1 and not p.is_symlink() for p in operative)
result={'startUtc':start,'endUtc':now(),'scope':'Only owned unsealed archival preimages; byte+mode equality, unique nlink1 restored; original inode/metadata NOT restored; historical hardlink action retained','replacedPaths':len(effects),'allArchivalNlink1':True,'operativeAllNlink1':True,'effects':effects}
(q/'archive-restoration.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='effects'}))
