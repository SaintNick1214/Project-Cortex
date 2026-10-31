"""Finite prospective copy; never repair a failed historical source pin."""
import hashlib,json,os,stat
from pathlib import Path
P=Path(__file__).resolve().parents[2]
OLD=P/'task04-current-producer-native-public-preparation1'
NEW=P/'task04-current-producer-native-public-repair1'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def dump(p,v):
 with open(p,'xb')as f:f.write((json.dumps(v,sort_keys=True,indent=2)+'\n').encode())
def read(p,pin=None):
 pre=ident(os.lstat(p)); fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  op=ident(os.fstat(fd));chunks=[];total=0;h=hashlib.sha256()
  while block:=os.read(fd,65536):
   total+=len(block)
   if total>16777216:raise ValueError('FINITE_SELECTIVE_SOURCE_BOUND')
   h.update(block);chunks.append(block)
  post=ident(os.fstat(fd));final=ident(os.lstat(p))
  if pre!=op or pre!=post or pre!=final:raise ValueError('CURRENT_NINE_DRIFT')
  if int(pre['fields']['mode'])&0o170000!=0o100000 or pre['fields']['nlink']!='1':raise ValueError('REGULAR_SINGLE_LINK')
  if pin and (pre!=pin['PRE']or total!=pin['bytes']or h.hexdigest()!=pin['sha256']):raise ValueError('LITERAL_EXISTING_PIN_MISMATCH')
  return b''.join(chunks),{'path':str(p),'PRE':pre,'OPEN':op,'POST':post,'pathFINAL':final,'bytes':total,'sha256':h.hexdigest(),'EOF':True}
 finally:os.close(fd)
metadata=[]
for rel,digest in [('closed-handoff.json','b718ebfd3962e0e81ebb0a03663c3debe78cabcae4cc8a73ae01be3ef57c7345'),('evidence/current-source-closure2.json','6555b2871fa239aab507c61531932b6419b170ccad712a43f60a93540abd4840'),('source/source-manifest.json','95c15859ebcbc2135c13f727e9b14894ca9f93cfd6bede99bc20a9e2da00364b')]:
 raw,row=read(OLD/rel)
 if row['sha256']!=digest:raise ValueError('EXACT_CLOSED_METADATA_SHA')
 metadata.append(row)
closure=json.loads(read(OLD/'evidence/current-source-closure2.json')[0]);pins={x['path']:x for x in closure['rows']}
manifest=json.loads(read(OLD/'source/source-manifest.json',pins[str(OLD/'source/source-manifest.json')])[0])
rows=[]
for entry in manifest['files']:
 src=OLD/'source'/entry['path'];raw,row=read(src,pins[str(src)])
 if(len(raw),row['sha256'])!=(entry['bytes'],entry['sha256']):raise ValueError('MANIFEST_BYTES')
 dst=NEW/'source'/entry['path'];dst.parent.mkdir(parents=True,exist_ok=True)
 with open(dst,'xb')as out:out.write(raw);out.flush();os.fsync(out.fileno())
 rows.append({**row,'newPath':'source/'+entry['path'],'copiedBytesExact':True})
if len(rows)!=111 or sum(x['bytes']for x in rows)!=2118876:raise ValueError('EXACT_N4_SOURCE_MEMBERSHIP')
dump(NEW/'evidence/selective-source-copy1.json',{'scope':'CURRENT_SELECTIVE_COPY_ONLY_NOT_HISTORICAL_CUSTODY','files':rows,'count':111,'bytes':2118876,'metadata':metadata,'originalN4Untouched':True})
print('copied111/2118876 fullEOF all9 matched prior distinct current-source2 pins')
