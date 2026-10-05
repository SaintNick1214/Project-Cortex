import subprocess,sys,json,datetime,pathlib
p=pathlib.Path('/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-convex-money-public-c2-fresh-review')
argv=sys.argv[1:]
pre=datetime.datetime.now(datetime.timezone.utc).isoformat()
r=subprocess.run(argv,cwd='/workspace/Project-Cortex',capture_output=True,text=True)
post=datetime.datetime.now(datetime.timezone.utc).isoformat()
n=len(list(p.glob('command-*.json')))+1
(p/f'command-{n:03}.json').write_text(json.dumps(dict(preUTC=pre,postUTC=post,rawArgv=argv,cwd='/workspace/Project-Cortex',exitCode=r.returncode,stdout=r.stdout,stderr=r.stderr),indent=2)+'\n')
print(r.stdout);print(r.stderr,file=sys.stderr);sys.exit(r.returncode)
