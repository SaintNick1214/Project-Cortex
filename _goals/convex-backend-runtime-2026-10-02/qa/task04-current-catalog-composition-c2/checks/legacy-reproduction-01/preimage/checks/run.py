import pathlib,subprocess,json,hashlib,datetime,sys,shutil
b=pathlib.Path(__file__).resolve().parent.parent;r=b.parents[3];folder=b/'checks'/sys.argv[1];folder.mkdir(exist_ok=False);argv=sys.argv[2:]
pins=json.loads((b/'source-pre.json').read_text())['sources']
def hashes():
 rows=[dict(p,postSHA256=hashlib.sha256((r/p['path']).read_bytes()).hexdigest()) for p in pins]
 assert all(row['postSHA256']==row['sha256'] for row in rows);return rows
pre=hashes();(folder/'protected-pre.json').write_text(json.dumps(pre,indent=2)+'\n')
for name in ['current-compose.mjs','private-compose.mjs','containment.mjs','containment-controls.mjs','socket-proof.mjs','native-probe.mts','offline-guard.mjs','jest.config.mjs','setup.mjs','adverse.mjs','copies','proposed-four-file-minimal.patch','approved-additions.json','source-pre.json','package.json','tsconfig.json','eslint.config.mjs','checks/make-copies.py','checks/run.py']:
 p=b/name
 if p.exists():
  if p.is_dir():shutil.copytree(p,folder/'preimage'/name)
  else:(folder/'preimage'/name).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,folder/'preimage'/name)
start=datetime.datetime.now(datetime.timezone.utc).isoformat();result=subprocess.run(argv,cwd=r,capture_output=True,env={'PATH':'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin','TSX_DISABLE_CACHE':'1','NODE_OPTIONS':'--import '+str(b/'offline-guard.mjs')});end=datetime.datetime.now(datetime.timezone.utc).isoformat()
(folder/'stdout').write_bytes(result.stdout);(folder/'stderr').write_bytes(result.stderr);post=hashes();(folder/'protected-post.json').write_text(json.dumps(post,indent=2)+'\n');(folder/'receipt.json').write_text(json.dumps({'argv':argv,'cwd':str(r),'startUTC':start,'endUTC':end,'exit':result.returncode,'environment':'closed literal offline process environment, no service values/.env loading','protected':len(pins)},indent=2)+'\n');print(json.dumps({'check':sys.argv[1],'exit':result.returncode,'stdout':result.stdout.decode(),'stderr':result.stderr.decode()}));sys.exit(result.returncode)
