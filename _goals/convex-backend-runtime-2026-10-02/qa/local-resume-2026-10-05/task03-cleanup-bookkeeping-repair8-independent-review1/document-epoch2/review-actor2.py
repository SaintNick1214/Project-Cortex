"""Independent R8 held-byte actor; original controls unchanged, own fixtures only."""
import contextlib,hashlib,io,json,sys,types
from pathlib import Path
def run(ctx):
 body=ctx['bodies'];J=Path(ctx['J']);D=Path(ctx['D']);P=Path(ctx['P'])
 plan=json.loads(body[str(J/'document-epoch2/review-source-inputs-plan2.json')])
 binding=plan['reviewProgramBindings']
 assert binding['candidatePath']==str(D/'phase_partition6.py')
 assert binding['candidateSha256']=='28df882bbf563f19d01fac3e0209e857d2f9decfae3564ac0dab48ef6ceb4c66'
 assert binding['preimagePath']==str(P/'task03-f2-registration-fence-repair7/phase_partition5.py')
 assert binding['preimageSha256']=='e4e35ac0b7089b8db8e2d2a99cdf39374bd415c9bc4c76a52ab6ed9e0b776a4b'
 assert len(binding['authorControlPaths'])==2 and len(set(binding['authorControlPaths']))==2
 for key,digest in [('candidatePath','candidateSha256'),('preimagePath','preimageSha256')]:
  assert hashlib.sha256(body[binding[key]]).hexdigest()==binding[digest]
 def pick(suffix):
  matches=[k for k in body if k.endswith(suffix)];assert len(matches)==1
  return matches[0]
 def module(name,path):
  m=types.ModuleType(name);m.__file__=path;sys.modules[name]=m
  exec(compile(body[path],path,'exec'),m.__dict__);return m
 M=module('independent_R8_actual_phase',binding['candidatePath'])
 Own=module('independent_R8_new_oracles',str(J/'independent-controls1.py'))
 old=body[binding['preimagePath']]
 original_phase=body[pick('/task03-f2-phase-partition-repair4/phase_partition2.py')]
 original_controls=body[pick('/task03-f2-phase-partition-repair4/partition_controls2.py')]
 fixture=J/'fixture-original165';fixture.mkdir(mode=0o700,exist_ok=False)
 data={'original_phase2':original_phase,'original_controls2':original_controls,'partition_controls2.py':original_controls}
 mods={'phase_candidate':M};summaries=[];capture=io.StringIO();author=[]
 with contextlib.redirect_stdout(capture):
  for name,key in [('independent_cases1.py','summary'),('independent_additional_cases1.py','result'),('independent_close_fence_cases1.py','result')]:
   path=pick('/task03-phase-partition-independent-review3/'+name)
   ns={'mods':mods,'data':data,'D':fixture,'A':D,'ORIGINAL':P/'task03-f2-phase-partition-repair4','json':json,'Path':Path}
   exec(compile(body[path],path,'exec'),ns);summaries.append(ns[key])
  for i,path in enumerate(binding['authorControlPaths']):
   assert path in body
   control=module('independent_R8_author_regression_'+str(i),path)
   author.append({'path':path,'result':control.run(M)})
  own=Own.run(M,old,body[binding['candidatePath']])
 stdout=capture.getvalue();assert len(stdout.encode())<=262144
 (J/'independent-control-stdout1.txt').write_text(stdout)
 first=summaries[0];original=first['original97']
 count=original['discovered']+first['discovered']-1+sum(s['discovered']for s in summaries[1:])
 failed=original['failed']+first['failed']+sum(s['failed']for s in summaries[1:])
 assert count==165
 for a in author:assert a['result']['passed']+a['result']['failed']==48
 assert own['discovered']==own['executed']==129
 author_pass=sum(a['result']['passed']for a in author);author_fail=sum(a['result']['failed']for a in author)
 result={'scope':'INDEPENDENT_R8_CODE_HOST_ONLY','original165':{'discovered':count,'passed':count-failed,'failed':failed,
  'raw36HasOriginal97WrapperCountedOnce':True,'blocks':summaries},'author96ScopedRegressions':author,'freshIndependent':own,
  'discovered':165+96+own['discovered'],'executed':165+96+own['executed'],'passed':165-failed+author_pass+own['passed'],
  'failed':failed+author_fail+own['failed'],'skipped':0,'candidateSha256':binding['candidateSha256'],'candidateCodeBytesUnmodified':True,
  'fixtureAndOutputOnlyHarnessBinding':str(fixture),'SourceEligibility':False,'functionalAcceptance':False,'effects':0,'python':sys.version}
 (J/'independent-control-results1.json').write_text(json.dumps(result,indent=2,sort_keys=True)+'\n')
 return result
