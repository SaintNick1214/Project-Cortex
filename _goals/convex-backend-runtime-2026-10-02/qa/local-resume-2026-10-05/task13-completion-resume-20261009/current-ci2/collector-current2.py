from pathlib import Path, PurePosixPath
from concurrent.futures import ThreadPoolExecutor
import argparse, collections, datetime, hashlib, io, json, re, subprocess, zipfile
Q=Path(__file__).resolve().parent
REPO='SaintNick1214/Project-Cortex'
HEAD='8ca8f15c96900a4824298c7b63eee02fab0b7ea5'
RUNS={'pr':37999830726,'security':37999830718}
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def gh(args):
 p=subprocess.run(['gh',*args],capture_output=True,timeout=60)
 if p.returncode: raise RuntimeError(p.stderr.decode(errors='replace')[:1500])
 return p.stdout
RULES=[('pem',re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----')),
 ('jwt',re.compile(r'\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b')),
 ('convex-key',re.compile(r'\b(?:dev|prod|preview):[a-z0-9-]+\|[A-Za-z0-9+/=_-]+')),
 ('credential-url',re.compile(r'(?<=://)([^\s/@:]+):[^\s/@]+@')),
 ('credential-assignment',re.compile(r'((?:CONVEX_DEPLOY_KEY(?:_CLI)?|CORTEX_TEST_(?:AUTH|READER|OUTSIDER)_TOKEN|CORTEX_CI_(?:ISSUER_PRIVATE_KEY|AUTH_PRIVATE_KEY)|OPENAI_API_KEY|NEO4J_PASSWORD|MEMGRAPH_PASSWORD)\s*[:=]\s*)(?!\$|\*|<|\[)[^\s,}\"]+'))]
def redact(raw):
 counts={}; text=raw.decode(errors='replace')
 for name,pattern in RULES:
  text,count=pattern.subn(lambda m: (m.group(1) if name=='credential-assignment' else '')+'[REDACTED_'+name.upper()+']',text)
  if count: counts[name]=count
 return text.encode(),counts
def write_json(path,obj): path.write_text(json.dumps(obj,indent=2)+'\n')
def poll():
 def fetch(item):
  kind,run=item
  d=json.loads(gh(['run','view',str(run),'--repo',REPO,'--json','databaseId,name,headSha,status,conclusion,createdAt,updatedAt,url,jobs']))
  if d['headSha']!=HEAD: raise RuntimeError('HEAD mismatch')
  return kind,d
 rows=dict(ThreadPoolExecutor(2).map(fetch,RUNS.items()))
 index=len(list((Q/'polls').glob('collector-*.json')))//2+1
 for kind,d in rows.items(): write_json(Q/'polls'/f'collector-{kind}-{index:03}.json',{'capturedAt':now(),'run':d})
 compact={kind:{'status':d['status'],'conclusion':d['conclusion'],'jobs':[{'id':j['databaseId'],'name':j['name'],'status':j['status'],'conclusion':j['conclusion'],'active':[s['name'] for s in j['steps'] if s['status']=='in_progress']} for j in d['jobs']]} for kind,d in rows.items()}
 previous={}
 if (Q/'collector-progress1.jsonl').exists():
  previous=json.loads((Q/'collector-progress1.jsonl').read_text().splitlines()[-1])
 changed={kind:{'status':item['status'],'conclusion':item['conclusion'],'jobStates':dict(collections.Counter(j['conclusion'] or j['status'] for j in item['jobs'])),'changedJobs':[j for j in item['jobs'] if j not in previous.get(kind,{}).get('jobs',[])]} for kind,item in compact.items()}
 with (Q/'collector-progress1.jsonl').open('a') as f: f.write(json.dumps({'capturedAt':now(),**compact})+'\n')
 print(json.dumps(changed)); return rows

def logs(rows):
 tasks=[]
 for kind,d in rows.items():
  for j in d['jobs']:
   if j['status']!='completed' or j['conclusion']=='skipped': continue
   if j['name'] in ['Detect File Changes','All Checks Passed']: continue
   path=Q/'logs'/f'collector-{kind}-job-{j["databaseId"]}.log'
   if path.exists(): continue
   tasks.append((kind,j,path))
 def fetch(item):
  kind,j,path=item
  try:
   raw=gh(['api','--allow-escape-sequences',f'repos/{REPO}/actions/jobs/{j["databaseId"]}/logs'])
   safe,counts=redact(raw); path.write_bytes(safe)
   return {'kind':kind,'jobId':j['databaseId'],'name':j['name'],'conclusion':j['conclusion'],'path':str(path.relative_to(Q)),'bytes':len(safe),'sha256':hashlib.sha256(safe).hexdigest(),'redactions':counts,'capturedAt':now()}
  except Exception as e: return {'kind':kind,'jobId':j['databaseId'],'name':j['name'],'error':str(e),'capturedAt':now()}
 fetched=list(ThreadPoolExecutor(3).map(fetch,tasks))
 with (Q/'collector-log-downloads1.jsonl').open('a') as f:
  for item in fetched: f.write(json.dumps(item)+'\n')
 print(json.dumps({'downloadedLogs':len(fetched),'errors':[x for x in fetched if 'error' in x]}))

def artifacts():
 d=json.loads(gh(['api',f'repos/{REPO}/actions/runs/{RUNS["pr"]}/artifacts?per_page=100']))
 idx=len(list(Q.glob('collector-artifact-index-*.json')))+1; write_json(Q/f'collector-artifact-index-{idx:03}.json',d)
 selected=[]
 for a in d['artifacts']:
  if not re.fullmatch(r'ci-(?:sdk-discovery-and-runtime-[1-5]|cli-discovery-and-runtime|provider-discovery-and-runtime|runtime-(?:cleanup|fixture)-receipts)',a['name']): continue
  destination=Q/'artifacts'/a['name']
  if destination.exists(): continue
  if a.get('expired') or a['workflow_run']['head_sha']!=HEAD: raise RuntimeError('Artifact scope/expiry mismatch')
  raw=gh(['api',f'repos/{REPO}/actions/artifacts/{a["id"]}/zip'])
  digest=hashlib.sha256(raw).hexdigest()
  if a.get('digest') and a['digest']!='sha256:'+digest: raise RuntimeError('Artifact digest mismatch')
  if len(raw)>5_000_000: raise RuntimeError('Unexpected selected artifact size')
  extracted=[]; destination.mkdir()
  for z in zipfile.ZipFile(io.BytesIO(raw)).infolist():
   path=PurePosixPath(z.filename)
   if z.is_dir(): continue
   if path.is_absolute() or '..' in path.parts or ((z.external_attr>>16)&0o170000)==0o120000: raise RuntimeError('Unsafe artifact member')
   if path.suffix not in ['.json','.log','.txt']: raise RuntimeError('Unexpected selected artifact member type')
   value=zipfile.ZipFile(io.BytesIO(raw)).read(z); safe,counts=redact(value); out=destination.joinpath(*path.parts); out.parent.mkdir(parents=True,exist_ok=True); out.write_bytes(safe)
   extracted.append({'path':str(out.relative_to(Q)),'bytes':len(safe),'sha256':hashlib.sha256(safe).hexdigest(),'redactions':counts})
  selected.append({'id':a['id'],'name':a['name'],'downloadedZipSha256':digest,'remoteDigest':a.get('digest'),'selectedEntries':extracted,'capturedAt':now()})
 with (Q/'collector-artifact-downloads1.jsonl').open('a') as f:
  for item in selected: f.write(json.dumps(item)+'\n')
 print(json.dumps({'availableArtifacts':d['total_count'],'selectedDownloaded':len(selected),'names':[a['name'] for a in d['artifacts']]}))

if __name__=='__main__':
 parser=argparse.ArgumentParser(); parser.add_argument('mode',choices=['poll','collect','artifacts']); mode=parser.parse_args().mode
 if mode=='artifacts': artifacts()
 else:
  rows=poll()
  if mode=='collect': logs(rows); artifacts()
