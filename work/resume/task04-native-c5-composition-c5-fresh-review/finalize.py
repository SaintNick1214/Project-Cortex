import pathlib,importlib.util,json,gzip,os,time,stat
s=importlib.util.spec_from_file_location('review',pathlib.Path(__file__).with_name('review.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m);q=m.R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-composition-c5-fresh-review';w=pathlib.Path(__file__).parent
labels=['exact-seam','exact-seam-complete-custody','fresh-adverse','vm-original-shape'];runs=[];groups=set()
for label in labels:
 a=m.load(m.OWN/(label+'-PRE.json.gz'));b=m.load(m.OWN/(label+'-POST.json.gz'));r=m.load(m.OWN/(label+'-execution.json.gz'));groups.add(r['pid']);assert m.load(a['original8']['path'])['files']==m.load(b['original8']['path'])['files'];assert all(not x['errors'] for x in a['subjects']+b['subjects']);assert [(x['path'],x['bytes'],x['sha256'],x['identity']) for x in a['sources']]==[(x['path'],x['bytes'],x['sha256'],x['identity']) for x in b['sources']];runs.append({'label':label,'execution':r,'sourceRows':len(a['sources']),'sourceFullPREPOSTEqual':True,'subjectsFullPREPOSTEqual':True,'original8FullPREPOSTEqual':True,'original8PRE':a['original8'],'original8POST':b['original8']})
for p in m.OWN.glob('child-*/receipt.json'):groups.add(m.load(p)['ownedGroup']['pgid'])
obs=[]
for attempt in range(2):
 rows=[]
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   text=(p/'stat').read_text();fields=text[text.rindex(')')+2:].split();pg=int(fields[2]);cmd=(p/'cmdline').read_bytes()
   if pg in groups:rows.append({'pid':int(p.name),'pgid':pg,'state':fields[0],'startTime':fields[19],'stat':text})
   elif str(m.OWN).encode() in cmd and b'/node\0' in cmd:rows.append({'pid':int(p.name),'pgid':pg,'state':fields[0],'startTime':fields[19],'cmdline':cmd.decode(errors='replace')})
  except (FileNotFoundError,ProcessLookupError,PermissionError):pass
 obs.append({'utc':m.utc(),'rows':rows});time.sleep(.1)
assert all(not x['rows'] for x in obs);m.save('final-preservation-and-quiescence',{'runs':runs,'ownedGroups':sorted(groups),'observations':obs,'quiescent':True,'historicalCustody':'BROKEN_FOREVER','original122':'HELD'})
# Relevant exact raw/capture/backing references; entire membership is bound by the forthcoming own literal seals.
refs=[]
for p in sorted(m.OWN.glob('*')):
 if p.is_file():
  row,b=m.held(p)
  if p.suffix=='.gz':raw=gzip.decompress(b);row.update(decodedBytes=len(raw),decodedSHA256=m.H(raw),encoding='LOSSLESS_GZIP')
  refs.append(row)
index={'verdict':'REJECT','scope':'ORIGINAL_FULL_FINITE_LAUNCHER_COMPOSITION','dimensions':{'requirementFulfillment':2,'codeQuality':3,'testQuality':4,'patternAdherence':4,'completeness':2},'average':3.0,'ownRoot':str(m.OWN),'references':refs,'subjectSeals':[m.held(m.Q/'selfseal.json')[0],m.held(m.W/'selfseal.json')[0],m.held(m.T/'selfseal.json.gz')[0],m.held(m.E/'selfseal.json.gz')[0]],'report':m.held(q/'report.md')[0],'original122':'HELD','actualApprovalsCreated':0,'nativePrivatePaidGit':'NONE','remaining':['body VM constructor semantics','actual generated in-memory VM before-consumer custody/exact recipes','whole freeze-route120s execution/timing','unexecuted full setup/rollback fault branches']}
(q/'evidence-index.json').write_text(json.dumps(index,indent=2)+'\n');(w/'resume.json').write_text(json.dumps({'verdict':'REJECT','ownRoot':str(m.OWN),'report':str(q/'report.md'),'ownExecutions':labels,'original122':'HELD','actualApprovalsCreated':0,'subjectNamespacesUnchanged':True,'handoff':'fix subject only in next authorized candidate namespace and obtain fresh full review'},indent=2)+'\n')

def seal(root,filename,references=[]):
 p=root/filename;p.write_bytes(b'placeholder\n');rows=[]
 for dp,dn,fn in os.walk(root,followlinks=False):
  d=pathlib.Path(dp);rows.append({'path':str(d.relative_to(root)),'kind':'directory','identity':m.ident(d.lstat()),'members':sorted(os.listdir(d))})
  for n in fn+[n for n in dn if (d/n).is_symlink()]:
   x=d/n
   if x==p:continue
   st=x.lstat();rel=str(x.relative_to(root))
   if stat.S_ISLNK(st.st_mode):rows.append({'path':rel,'kind':'symlink','identity':m.ident(st),'target':os.readlink(x)})
   else:rr,_=m.held(x);rows.append({**rr,'path':rel,'kind':'file'})
 raw=json.dumps({'root':str(root),'excludedSelfOnly':[filename],'rows':rows,'references':references,'status':'FROZEN_INDEPENDENT_REJECT_NOT_ORIGINAL_ACCEPTANCE'},sort_keys=True,separators=(',',':')).encode()+b'\n';p.write_bytes(gzip.compress(raw,mtime=0) if filename.endswith('.gz') else raw);rr,b=m.held(p);rr['membershipRows']=len(rows)
 if filename.endswith('.gz'):rr.update(decodedBytes=len(raw),decodedSHA256=m.H(raw))
 # verify own literal membership and every recorded identity/byte now, no imported acceptance.
 actual=set()
 for dp,dn,fn in os.walk(root,followlinks=False):actual.add(str(pathlib.Path(dp).relative_to(root)));actual.update(str((pathlib.Path(dp)/n).relative_to(root)) for n in fn+[n for n in dn if (pathlib.Path(dp)/n).is_symlink()])
 assert actual-{filename}=={r['path'] for r in rows}
 for r in rows:
  x=root/r['path'];assert m.ident(x.lstat())==r['identity']
  if r['kind']=='file':assert m.held(x)[0]['sha256']==r['sha256']
  elif r['kind']=='directory':assert sorted(os.listdir(x))==r['members']
  else:assert os.readlink(x)==r['target']
 return rr
tr=seal(m.OWN,'selfseal.json.gz',index['subjectSeals']);wr=seal(w,'selfseal.json',[tr]);qr=seal(q,'selfseal.json',[wr,tr]+index['subjectSeals']);print(json.dumps({'Q':qr,'W':wr,'OWN':tr},indent=2))
