import subprocess,os,json,sys,time,datetime,signal
from pathlib import Path
name,cwd,*args=sys.argv[1:]
out=Path(__file__).resolve().parent
selected_env={'PATH':'/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin:/usr/bin:/bin:/usr/sbin:/sbin','HOME':str(Path.home()),'TMPDIR':os.environ.get('TMPDIR','/tmp'),'LANG':'en_US.UTF-8','NEXT_TELEMETRY_DISABLED':'1','CORTEX_TEST_ENV_MODE':'explicit','CI':'true','CONVEX_URL':'https://unit.invalid','CONVEX_URL_CLI':'https://unit.invalid','NEXT_PUBLIC_CONVEX_URL':'https://unit.invalid','NEXT_PUBLIC_CORTEX_HTTP_URL':'https://unit.invalid','NEXT_PUBLIC_CORTEX_AGENT_ID':'offline-agent','npm_config_audit':'false','npm_config_fund':'false'}
started=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
with (out/(name+'.log')).open('wb') as log:
 child=subprocess.Popen(args,cwd=cwd,env=selected_env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 try: code=child.wait(timeout=600)
 except subprocess.TimeoutExpired:
  os.killpg(child.pid,signal.SIGTERM)
  try:child.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
  code=124
receipt={'command':args,'cwd':cwd,'startUtc':started,'durationSeconds':round(time.monotonic()-t,3),'exitCode':code,'log':name+'.log','normalChildExit':code!=124,'node':'24.15.0','npm':'12.2.0'}
(out/(name+'.receipt.json')).write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt));sys.exit(code)
