"""Read-only check of owned Linux seal; no candidate evaluation or writes."""
import json,os,sys,time
from pathlib import Path
sys.path.insert(0,'/repair/finish-tools')
from acquire_lib import held,identity,read_json
started=time.monotonic()
def resource():
 b={n:Path('/sys/fs/cgroup',n).read_text() for n in ('memory.max','memory.current','memory.events')}
 maximum=b['memory.max'].strip();current=b['memory.current'].strip()
 if not maximum.isdecimal() or not current.isdecimal() or int(maximum)-int(current)<134217728:raise ValueError('FRESH_MEASURED_RESERVE_HOLD')
 disk=os.statvfs('/repair')
 return {'memory':b,'reserveBytes':int(maximum)-int(current),'requiredReserveBytes':134217728,'diskAvailableBytes':disk.f_bavail*disk.f_frsize}
pre=resource()
tool=held(Path(__file__).resolve(),lambda _:None)
python=held(Path(sys.executable).resolve(),lambda _:None)
manifest,proof=read_json(Path('/repair/final-linux-packet-manifest.json'))
if proof['sha256']!='2e55621b73fed30c608559d76f215b1f5ccf8cda72857d5122acb4ea9d7f79c6' or proof['bytes']!=1031477:raise ValueError('EXTERNAL_SEAL_CONTENT_PIN')
for row in manifest['files']:
 now=held(Path(row['path']),lambda _:None)
 if row!=now:raise ValueError('OWNED_SOURCE_SEAL_NINE_OR_CONTENT_DRIFT:'+row['path'])
for row in manifest['literalDirectories']:
 p=Path(row['path']);now=identity(os.lstat(p))
 if row['PRE']!=row['POST'] or now!=row['POST'] or sorted(os.listdir(p))!=row['members']:raise ValueError('SEALED_LITERAL_DIRECTORY_DRIFT:'+str(p))
post=resource()
if tool!=held(Path(__file__).resolve(),lambda _:None) or python!=held(Path(sys.executable).resolve(),lambda _:None):raise ValueError('READ_ONLY_HELPER_OR_CURRENT_INTERPRETER_DRIFT')
print(json.dumps({'status':'PASS_OWN_READONLY_SOURCE_SEAL_EQUALITY_NOT_INDEPENDENT_REVIEW','seal':proof,'files':len(manifest['files']),'directories':len(manifest['literalDirectories']),'fileBytes':sum(r['bytes'] for r in manifest['files']),'elapsedSeconds':time.monotonic()-started,'resourcePRE':pre,'resourcePOST':post,'helperContentTransportPREPOST':tool,'currentReadContainerInterpreterPREPOST':python,'pastContainerInterpreterPinAdopted':False,'subjectEvaluated':False,'volumeWrites':False,'ROOT':'ABSENT'}))
