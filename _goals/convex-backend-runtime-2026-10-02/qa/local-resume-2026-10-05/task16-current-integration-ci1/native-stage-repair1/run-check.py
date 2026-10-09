import subprocess,os,json,sys,time,datetime,signal
from pathlib import Path
name,cwd,*args=sys.argv[1:]
out=Path(__file__).resolve().parent
selected_env=dict(os.environ)
for key in list(selected_env):
 if key.startswith(('CONVEX_', 'CLOUD_CONVEX_', 'LOCAL_CONVEX_', 'CORTEX_CI_', 'CORTEX_TEST_')) or key in ['OPENAI_API_KEY','ANTHROPIC_API_KEY','AI_GATEWAY_API_KEY','CORTEX_APP_DEPLOYMENT_ADMIN_KEY','CORTEX_APP_SETUP_TOKEN','NEXT_PUBLIC_CONVEX_URL','NEXT_PUBLIC_CORTEX_HTTP_URL','NEXT_PUBLIC_CORTEX_AGENT_ID']:
  selected_env.pop(key,None)
selected_env.update({'CI':'true','CORTEX_TEST_ENV_MODE':'explicit','CONVEX_URL':'https://unit.invalid','CONVEX_URL_CLI':'https://unit.invalid','NEXT_PUBLIC_CONVEX_URL':'https://unit.invalid','NEXT_PUBLIC_CORTEX_HTTP_URL':'https://unit.invalid','NEXT_PUBLIC_CORTEX_AGENT_ID':'offline-agent','NEXT_TELEMETRY_DISABLED':'1'})
selected_env['PATH']='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin:'+selected_env['PATH']
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
