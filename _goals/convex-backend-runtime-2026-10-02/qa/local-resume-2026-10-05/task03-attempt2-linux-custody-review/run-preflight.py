from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

ROOT=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
OUT=Path(__file__).resolve().parent
PREPARATION=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt2-2026-10-05'
IMAGE='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
VOLUME='cortex-task03-attempt2-fixture-20261005-511363b3'
DEPS='cortex-task03-deps-20261005-b681774e'
argv=['docker','run','--rm','-i','--network','none','--platform','linux/amd64','--memory','512m','--memory-swap','512m','--read-only','--user','501:20','--cap-drop','ALL','--security-opt','no-new-privileges','--tmpfs','/tmp:uid=501,gid=20,mode=0700,size=128m','--env','HOME=/tmp','--mount',f'type=bind,source={ROOT},target={ROOT},readonly','--mount',f'type=volume,source={DEPS},target={ROOT}/node_modules,readonly,volume-nocopy,volume-subpath=node_modules','--mount',f'type=volume,source={VOLUME},target={PREPARATION},readonly,volume-nocopy,volume-subpath=candidate','--workdir',str(ROOT),'--entrypoint','/usr/local/bin/node',IMAGE,'--input-type=module','-']
start=datetime.now(timezone.utc).isoformat()
data=(OUT/'source-preflight.mjs').read_bytes()
result=subprocess.run(argv,input=data,capture_output=True,cwd=ROOT,timeout=90)
(OUT/'actual-source-preflight.stdout').write_bytes(result.stdout)
(OUT/'actual-source-preflight.stderr').write_bytes(result.stderr)
receipt={'scope':'READONLY_ACTUAL_LINUX_SOURCE_PREFLIGHT','argv':argv,'start':start,'end':datetime.now(timezone.utc).isoformat(),'exitCode':result.returncode,'stdinSha256':hashlib.sha256(data).hexdigest(),'stdoutSha256':hashlib.sha256(result.stdout).hexdigest(),'stderrSha256':hashlib.sha256(result.stderr).hexdigest(),'officialCliInvocations':0,'compilerInvocations':0,'nativeSubjectImports':0,'serviceCalls':0,'privateBytesRead':False,'candidateOrVolumeWrites':0}
(OUT/'source-preflight-command.json').write_text(json.dumps(receipt,indent=2)+'\n')
assert result.returncode==0,'actual preflight failed; raw receipt preserved'
x=json.loads(result.stdout)
print(json.dumps({k:x[k] for k in ['verdict','node','npm','candidateFiles','productPins','productRootMembership','managedCopies','dependencies','memoryMax']}))
