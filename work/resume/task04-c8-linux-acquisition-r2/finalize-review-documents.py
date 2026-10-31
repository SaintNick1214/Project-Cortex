"""Copy finalized finite review documents to fresh owned Linux baselines."""
import json,os,sys
from pathlib import Path
sys.path.insert(0,'/repair/finish-tools')
from acquire_lib import held,identity
root=Path('/repair/review-documents')
if root.exists():raise ValueError('EXCLUSIVE_REVIEW_DOCUMENT_NAMESPACE')
maximum=Path('/sys/fs/cgroup/memory.max').read_text().strip();current=Path('/sys/fs/cgroup/memory.current').read_text().strip()
if not maximum.isdecimal() or not current.isdecimal() or int(maximum)-int(current)<134217728:raise ValueError('FRESH_RESOURCE_HOLD')
root.mkdir(mode=0o700)
rows=[]
for source in [Path('/tool-source/finalize-review-documents.py')]+[Path('/review-source')/name for name in ['report.md','runtime-lifecycle-and-review-recipe.md','runtime-version-disposition.json','six-route-catalog-and-demand.json','infrastructure-and-preserved-image-correction.json','helper-source-parse-checks.json']]:
 chunks=[];before=held(source,chunks.append);target=root/source.name
 with open(target,'xb') as stream:
  os.chmod(stream.name,0o600);stream.write(b''.join(chunks));stream.flush();os.fsync(stream.fileno())
 after=held(target,lambda _:None)
 if before['sha256']!=after['sha256'] or before['bytes']!=after['bytes']:raise ValueError('FINITE_FINAL_DOCUMENT_TRANSFER')
 rows.append({'hostContentTransport':before,'freshOwnedLinuxBaseline':after})
raw=(json.dumps({'files':rows,'freshCgroupReserveBytes':int(maximum)-int(current),'runtimeIdentityScope':'CURRENT_ACQUISITION_CONTAINER_ONLY; FUTURE_RUNTIME_NEEDS_FRESH_DISTINCT_BINDING_AND_REVIEW','volumeIdentity':identity(os.lstat('/repair')),'previousPinsModified':False,'ROOT':'ABSENT'},indent=2)+'\n').encode()
with open(root/'fresh-document-baselines.json','xb') as stream:
 os.chmod(stream.name,0o600);stream.write(raw);stream.flush();os.fsync(stream.fileno())
print(json.dumps({'status':'FINAL_REVIEW_DOCUMENT_BASELINES_CAPTURED','files':len(rows)}))
