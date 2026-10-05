exec(compile(open('/workspace/Project-Cortex/work/resume/task04-c7-full-partial-review/inspect.py').read().split("if sys.argv[1]=='backing'")[0], 'inspect-definitions', 'exec'))
contract=R/'work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json'
audit=json.loads(contract.read_text());original={v['id']:v for v in audit['commands']}; results=[];pins=[]
replacements=[(b'/dev/shm/cortex-native-c6-closed-launcher-c6',str(T).encode()),(b'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6',b'work/resume/task04-c7-exact-identity-repair/candidate'),(b'task04-native-c6-closed-launcher-c6',b'task04-c7-exact-identity-repair')]
def bounded(p):
 p=Path(p);s=os.lstat(p);assert s.st_size<2097152
 data=p.read_bytes();assert ident(s)==ident(os.lstat(p));return data,ident(s)
def consume(k,v):
 if k=='nativeCodeRows':
  a,ai=bounded(v['source']['path']);b,bi=bounded(v['destination']['path']);c=a
  for x,y in replacements:c=c.replace(x,y)
  results.append({'source':v['source']['path'],'destination':v['destination']['path'],'sourceIdentity':ai,'destinationIdentity':bi,'sourceSHA256':hashlib.sha256(a).hexdigest(),'destinationSHA256':hashlib.sha256(b).hexdigest(),'recordedHashesEqual':hashlib.sha256(a).hexdigest()==v['source']['sha256'] and hashlib.sha256(b).hexdigest()==v['destination']['sha256'],'mechanicalNamespaceOnly':c==b})
 else:
  o=original[v['id']];e=next(x for x in o['proposedArgv'] if x.startswith('/workspace/'))
  data,identity=bounded(e)
  pins.append({'id':v['id'],'originalArgv':o['proposedArgv'],'recordedArgvEqual':v['originalArgv']==o['proposedArgv'],'entrySHA256':hashlib.sha256(data).hexdigest(),'pinEqual':hashlib.sha256(data).hexdigest()==o['entrySha256']==v['originalEntrySHA256'],'entryIdentity':identity})
with open(B/'source-conservation-static.json','rb') as f:
 reader=m.Reader(iter(lambda:f.read(16384),b''),valueLimit=2097152);header=reader.top(arrayKeys=('nativeCodeRows','commands'),item=consume)
out={'scope':'INDEPENDENT_STATIC_741_BODY_NAMESPACE_AND122_ORIGINAL_ARGV_PINS_ONLY','contract':str(contract),'contractIdentity':ident(os.lstat(contract)),'contractSHA256':digest(contract),'nativeRows':len(results),'commands':len(pins),'nativeAllMatch':all(x['recordedHashesEqual'] and x['mechanicalNamespaceOnly'] for x in results),'all122PinsMatch':len(pins)==122 and all(x['recordedArgvEqual'] and x['pinEqual'] for x in pins),'rows':results,'pins':pins,'runtime':'NOT_EXECUTED_NOT_QUALIFIED'}
(W/'independent-conservation.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:out[k] for k in ('scope','nativeRows','commands','nativeAllMatch','all122PinsMatch')}))
