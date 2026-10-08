import pathlib,json,hashlib,datetime,subprocess,os,sys
root=pathlib.Path.cwd();q=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-root-execution-c1';subject=q.parent/'task04-current-catalog-release-c4';label=sys.argv[1];argv=sys.argv[2:];run=q/'checks'/label;run.mkdir(parents=True);store=run/'source-pre';store.mkdir()
rows=json.loads((subject/'source-runtime.json').read_text())['sources'];paths={root/r['path'] for r in rows}|set(subject.glob('*.mjs'))|set(subject.glob('*.json'))|set(q.glob('*.mjs'))|{pathlib.Path(__file__).resolve()}
for name in ['tests/unit/runtimeAssetUnavailableAuth','tests/unit/runtimeWorkerAuth','tests/unit/runtimeArtifactAuth']:
 paths.update(p for p in (root/name).rglob('*') if p.is_file())
before=[]
for p in sorted(paths):
 b=p.read_bytes();h=hashlib.sha256(b).hexdigest();(store/h).write_bytes(b);before.append(dict(path=str(p.relative_to(root)),bytes=len(b),sha256=h))
(run/'source-before.json').write_text(json.dumps(before,indent=2)+'\n');start=datetime.datetime.now(datetime.timezone.utc).isoformat();env={'PATH':os.environ['PATH'],'LANG':'C.UTF-8','TZ':'UTC','CI':'1','NO_COLOR':'1'}
with (run/'stdout').open('xb') as out,(run/'stderr').open('xb') as err:
 try:result=subprocess.run(argv,cwd=root,env=env,stdout=out,stderr=err,timeout=300);code=result.returncode
 except subprocess.TimeoutExpired:code=124
end=datetime.datetime.now(datetime.timezone.utc).isoformat();after=[dict(path=str(p.relative_to(root)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(paths)];(run/'source-after.json').write_text(json.dumps(after,indent=2)+'\n');receipt=dict(argv=argv,cwd=str(root),start=start,end=end,exit=code,sourceBefore=before,sourceAfter=after,stable=before==after,environment='closed literal offline environment; no dotenv/auth/service values; direct transport guard; actual root test files and normal C4CLI');(run/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(dict(label=label,exit=code,sourceStable=before==after)));sys.exit(code if before==after else 2)
