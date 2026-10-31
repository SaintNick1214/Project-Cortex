import argparse,subprocess,os,signal,time,json,datetime,pathlib
p=argparse.ArgumentParser();p.add_argument('--cwd',required=True);p.add_argument('--log',required=True);p.add_argument('--seconds',type=int,required=True);p.add_argument('command',nargs=argparse.REMAINDER);a=p.parse_args();cmd=a.command[1:] if a.command[0]=='--' else a.command
start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic();timed=False
with open(a.log,'wb') as log:
 child=subprocess.Popen(cmd,cwd=a.cwd,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 try: code=child.wait(timeout=a.seconds)
 except subprocess.TimeoutExpired:
  timed=True;os.killpg(child.pid,signal.SIGTERM)
  try:code=child.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);code=child.wait()
receipt={'command':cmd,'cwd':a.cwd,'startedAt':start,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':round(time.monotonic()-t,3),'deadlineSeconds':a.seconds,'timedOut':timed,'exitCode':code,'passed':code==0 and not timed,'log':a.log}
pathlib.Path(a.log+'.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt));raise SystemExit(code if code>=0 and not timed else 124)
