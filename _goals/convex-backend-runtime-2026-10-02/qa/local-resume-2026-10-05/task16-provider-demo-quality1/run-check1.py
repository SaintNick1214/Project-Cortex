from pathlib import Path
import os,sys,json,subprocess,datetime,time,signal
q=Path(__file__).resolve().parent
r=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
tool=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin')
name,cwd,limit=sys.argv[1:4];command=sys.argv[4:]
env={'PATH':str(tool)+':/usr/bin:/bin:/usr/sbin:/sbin','HOME':str(Path.home()),'TMPDIR':os.environ.get('TMPDIR','/tmp'),'LANG':'en_US.UTF-8','NODE_OPTIONS':'--require '+str(q/'offline-guard1.cjs'),'NEXT_TELEMETRY_DISABLED':'1','CORTEX_TEST_ENV_MODE':'explicit','CONVEX_URL':'https://unit.invalid','NEXT_PUBLIC_CONVEX_URL':'https://unit.invalid','NEXT_PUBLIC_CORTEX_AGENT_ID':'source-quality-agent','CI':'true','npm_config_audit':'false','npm_config_fund':'false'}
started=datetime.datetime.now(datetime.timezone.utc).isoformat();tick=time.monotonic();log=q/(name+'.log');timed=False
with log.open('w') as stream:
 child=subprocess.Popen(command,cwd=cwd,env=env,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
 try: code=child.wait(timeout=int(limit))
 except subprocess.TimeoutExpired:
  timed=True;os.killpg(child.pid,signal.SIGTERM)
  try:code=child.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);code=child.wait(timeout=5)
 try:os.killpg(child.pid,0);groupPresent=True
 except ProcessLookupError:groupPresent=False
receipt={'name':name,'command':command,'cwd':cwd,'startedAtUtc':started,'closedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':round(time.monotonic()-tick,3),'pid':child.pid,'exit':code,'timeoutSeconds':int(limit),'timedOut':timed,'naturalExit':not timed,'ownedProcessGroupPresentAfterWait':groupPresent,'log':str(log),'node':'24.15.0','npm':'12.2.0','environment':{'minimal':True,'credentialNamesPassed':[],'sourceQualityUrl':'https://unit.invalid','fileAndNetworkGuard':str(q/'offline-guard1.cjs'),'CI':True},'sourceManifest':'source-manifest1.json','serviceAndModelExecutionAuthorized':False}
(q/(name+'-command.json')).write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2));print(log.read_text()[-3500:]);sys.exit(0)
