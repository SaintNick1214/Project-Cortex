from pathlib import Path
import datetime,json,os,subprocess,sys,time
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
W=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-docs')
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12'
mode=sys.argv[1]
commands={
 'examples':(['node',str(R/'node_modules/typescript/bin/tsc'),'-p',str(Q/'docs-memory-effort-tsconfig.json')],R,45),
 'typecheck':(['npm','run','typecheck'],W/'docs-site',60),
 'build':(['npm','run','build'],W/'docs-site',120),
 'whitespace':(['git','diff','--check'],W,20),
}
command,cwd,timeout=commands[mode]
env=os.environ.copy();env['PATH']='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin:'+env['PATH']
log=Q/f'docs-memory-effort-{mode}.log'
started=time.monotonic();result={'command':command,'cwd':str(cwd),'timeoutSeconds':timeout,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
with log.open('w') as output:
 try:
  completed=subprocess.run(command,cwd=cwd,env=env,stdout=output,stderr=subprocess.STDOUT,timeout=timeout)
  result['exitCode']=completed.returncode
 except subprocess.TimeoutExpired:
  result['exitCode']=None;result['timedOut']=True
result['durationSeconds']=round(time.monotonic()-started,3);result['log']=str(log)
(Q/f'docs-memory-effort-{mode}-result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
sys.exit(0 if result.get('exitCode')==0 else 1)
