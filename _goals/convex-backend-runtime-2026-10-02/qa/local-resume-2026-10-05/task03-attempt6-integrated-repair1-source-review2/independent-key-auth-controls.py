import ast,pathlib,json,sys,types
R=pathlib.Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');F=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-integrated-repair1';J=F.parent/'task03-attempt6-integrated-repair1-source-review2';t=ast.parse((F/'reuse-private-key-final.py').read_bytes());fn=next(x for x in t.body if isinstance(x,ast.FunctionDef)and x.name=='main');boundary=next(i for i,x in enumerate(fn.body)if isinstance(x,ast.Assert)and 'OLD.resolve' in ast.unparse(x));prefix=ast.FunctionDef(name='auth_prefix',args=fn.args,body=fn.body[:boundary],decorator_list=[]);ast.fix_missing_locations(prefix);code=compile(ast.Module(body=[prefix],type_ignores=[]),'exact-key-before-first-private-stat','exec');OP='c9fbaa34-8ca8-4153-b8bd-1cfe60a8241f';results=[]
for field,value in [(None,None),('operation','foreign'),('authorizedByRoot',1),('sourceApprovalSha256','foreign'),('sourceManifestSha256','foreign'),('purpose','foreign'),('extra','unreviewed')]:
 auth={'operation':OP,'authorizedByRoot':True,'sourceApprovalSha256':'approval','sourceManifestSha256':'manifest','purpose':'EXACT_SINGLE_REUSED_KEY_FRESH_PROSPECTIVE_CUSTODY'}
 if field:auth[field]=value
 calls=[];g=types.SimpleNamespace(qualify_sources=lambda:({},'approval','manifest'),strict=lambda x:x,read=lambda p:{'operation':OP}if p.name=='prospective-binding-final.json'else auth)
 env={'P':F,'load_module':lambda *a:g,'sys':types.SimpleNamespace(dont_write_bytecode=True),'os':types.SimpleNamespace(getuid=lambda:501,getgid=lambda:20)};exec(code,env);accepted=True
 try:env['auth_prefix']()
 except (AssertionError,KeyError):accepted=False
 assert accepted is (field is None);results.append({'id':'key-auth-'+str(field),'status':'PASS','accepted':accepted,'privatePathStatOrRead':False})
with (J/'independent-key-auth-results.json').open('x')as f:json.dump({'scope':'EXACT_KEY_AUTH_PREFIX_BEFORE_FIRST_PRIVATE_STAT_AST_ONLY','count':len(results),'status':'PASS','rows':results,'privateReads':0,'realEffects':0},f,indent=2);f.write('\n')
print(json.dumps({'controls':len(results),'status':'PASS','privateReads':0}))
