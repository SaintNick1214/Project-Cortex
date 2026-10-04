import datetime,gzip,hashlib,json,os,stat
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');R=Path.cwd();i=json.loads((Q/'index.json').read_bytes());roots=[p['root'] for p in i['sourcePins']];rows=[];start=datetime.datetime.now(datetime.timezone.utc).isoformat()
for root in roots:
 for dp,dns,fns in os.walk(R/root,followlinks=False):
  for n in list(dns):
   if (Path(dp)/n).is_symlink():dns.remove(n)
  s=os.stat(dp,follow_symlinks=False);assert stat.S_ISDIR(s.st_mode);rows.append({'path':str(Path(dp).relative_to(R)),'mode':stat.S_IMODE(s.st_mode),'sourceUid':s.st_uid,'sourceDev':s.st_dev,'sourceIno':s.st_ino,'sourceNlink':s.st_nlink,'sourceMtimeNs':s.st_mtime_ns,'sourceCtimeNs':s.st_ctime_ns})
rows.sort(key=lambda r:r['path']);modes={}
for r in rows:modes[str(r['mode'])]=modes.get(str(r['mode']),0)+1
raw=json.dumps({'format':'cortex-c4-exact-directory-modes-v1','roots':roots,'directories':rows,'capture':'Prospective current original metadata after ROOT incident recovery; no historical preincident directory-mode capture is invented'},separators=(',',':')).encode();encoded=gzip.compress(raw,mtime=0)
assert len(encoded)<=5*1024*1024 and set(modes)<=set(['448','493']),modes
(Q/'directory-modes.json.gz').write_bytes(encoded);result={'utcPRE':start,'utcPOST':datetime.datetime.now(datetime.timezone.utc).isoformat(),'count':len(rows),'modes':modes,'encodedBytes':len(encoded),'encodedSha256':hashlib.sha256(encoded).hexdigest(),'decodedExactBytes':len(raw),'decodedSha256':hashlib.sha256(raw).hexdigest(),'eightOriginalManifestPinsUnchanged':i['sourcePins'],'limitation':'Directory metadata only newly captured after incident recovery; original directory inode/time/topology not reconstructed; exact source file/literal archive and original eight manifests unchanged'}
(Q/'directory-source-before.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
