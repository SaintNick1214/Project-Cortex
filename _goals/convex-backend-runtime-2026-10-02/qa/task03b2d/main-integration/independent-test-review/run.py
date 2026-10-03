import sys,subprocess,json,pathlib,datetime,time,hashlib
name=sys.argv[1];argv=sys.argv[2:];out=pathlib.Path(__file__).parent;root=pathlib.Path('/workspace/Project-Cortex')
started=datetime.datetime.now(datetime.timezone.utc).isoformat();begin=time.monotonic()
p=subprocess.run(argv,cwd=root,capture_output=True,text=True)
(out/(name+'.stdout.log')).write_text(p.stdout);(out/(name+'.stderr.log')).write_text(p.stderr)
receipt=dict(name=name,argv=argv,cwd=str(root),startedAt=started,completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),elapsedSeconds=time.monotonic()-begin,exitCode=p.returncode,stdout=str(out/(name+'.stdout.log')),stderr=str(out/(name+'.stderr.log')))
(out/(name+'.command.json')).write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
