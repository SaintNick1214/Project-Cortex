"""Transfer finalized finite source-inspection helper, leave prior tools intact."""
import json,os,sys
from pathlib import Path
sys.path.insert(0,'/repair/finish-tools')
from acquire_lib import held
root=Path('/repair/version-tools')
if root.exists():raise ValueError('EXCLUSIVE_VERSION_HELPER_NAMESPACE')
maximum=Path('/sys/fs/cgroup/memory.max').read_text().strip();current=Path('/sys/fs/cgroup/memory.current').read_text().strip()
if not maximum.isdecimal() or not current.isdecimal() or int(maximum)-int(current)<134217728:raise ValueError('FRESH_RESERVE_HOLD')
root.mkdir(mode=0o700)
chunks=[]
source=held(Path('/tool-source/version-disposition.py'),chunks.append)
with open(root/'version-disposition.py','xb') as stream:
 os.chmod(stream.name,0o600);stream.write(b''.join(chunks));stream.flush();os.fsync(stream.fileno())
target=held(root/'version-disposition.py',lambda _:None)
if source['sha256']!=target['sha256'] or source['bytes']!=target['bytes']:raise ValueError('SOURCE_TRANSFER')
raw=(json.dumps({'source':source,'ownedLinuxBaseline':target,'priorToolsEdited':False},indent=2)+'\n').encode()
with open(root/'initialization.json','xb') as stream:
 os.chmod(stream.name,0o600);stream.write(raw);stream.flush();os.fsync(stream.fileno())
print('VERSION_SOURCE_HELPER_TRANSFER_PASS')
