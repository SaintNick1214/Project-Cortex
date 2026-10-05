import pathlib,os,json,hashlib,datetime
R=pathlib.Path('/workspace/Project-Cortex');B=R/'work/resume/task04-c7-exact-identity-repair';C=B/'candidate';F=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns');checked={}
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in F}}
def read(path,pin=None):
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);chunks=[];h=hashlib.sha256()
  while x:=os.read(fd,262144):chunks.append(x);h.update(x)
  assert ident(a)==ident(os.fstat(fd))==ident(os.lstat(path));raw=b''.join(chunks)
  observed={'path':str(path),'bytes':len(raw),'sha256':h.hexdigest(),'identity':ident(a)}
  if pin:assert all(pin[k]==observed[k] for k in ('bytes','sha256','identity'))
  checked[str(path)]=observed;return raw
 finally:os.close(fd)
j=json.loads(read(B/'source-conservation-static.json'));read(j['map']['path'],j['map']);contract=json.loads(read(j['contract']['path'],j['contract']))
old='/dev/shm/cortex-native-c6-closed-launcher-c6';new='/dev/shm/cortex-native-c7-exact-identity-repair'
for row in j['nativeCodeRows']:
 a=read(row['source']['path'],row['source']);b=read(row['destination']['path'],row['destination']);assert a.replace(old.encode(),new.encode())==b
assert len(j['nativeCodeRows'])==741
commands={x['id']:x for x in contract['commands']};assert len(commands)==122 and len(j['commands'])==122
for row in j['commands']:
 original=commands[row['id']];assert original['proposedArgv']==row['originalArgv'] and original['entrySha256']==row['originalEntrySHA256']==row['mapOriginalEntrySHA256']
 argv=[x.replace(str(R),new+'/mirror',1) if x.startswith(str(R)+'/') else x for x in original['proposedArgv']];assert argv==row['prospectiveArgv']
a=read(R/'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6/compiler-recipes.mjs').decode();b=read(C/'compiler-recipes.mjs').decode()
expected="import identity from './fs-identity.cjs';\n"+a.replace(old,new).replace('r.identity&&Object.keys(r.identity).some(k=>snap.identity[k]!==r.identity[k])','!identity.same(snap.identity,r.identity)').replace('JSON.parse(read(root+', 'identity.parse(read(root+')
expected=expected.replace(r'\/tmp\/cortex-native-c6-independent-review-',r'\/dev\/shm\/cortex-native-c7-exact-identity-repair\/independent-review-');assert expected==b
recipe=json.loads(read(B/'eight-recipe-source-conservation-static.json'));assert len(set(recipe['originalCompilerIds']))==8 and recipe['originalSHA256']==hashlib.sha256(a.encode()).hexdigest() and recipe['currentSHA256']==hashlib.sha256(b.encode()).hexdigest()
prepared=json.loads(read(C/'prepared-source-inputs.json'));assert len(prepared['files'])==7
for pin in prepared['files']:read(pin['path'],pin)
result={'scope':'ROOT_STATIC_SOURCE_CONSERVATION_CURRENT_BINDINGS_ONLY_NOT_AST_OR_EXECUTION','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'nativeSourceBodies':741,'originalCommands':122,'compilerRecipes':8,'currentPreparedPins':7,'checkedFiles':len(checked),'fullCompilerSourceEqualAfterExplicitFourEdits':True,'original122':'HELD','whole120':'UNQUALIFIED','sourcePins':checked}
p=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-source-conservation-root-inspection.json';assert not p.exists();p.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='sourcePins'}))
