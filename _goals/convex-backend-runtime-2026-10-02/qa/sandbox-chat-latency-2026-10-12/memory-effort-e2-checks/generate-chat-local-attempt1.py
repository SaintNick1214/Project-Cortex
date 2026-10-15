import os,subprocess,tempfile
from pathlib import Path
q=Path(__file__).resolve().parent
with tempfile.TemporaryDirectory(prefix="cortex-effort-local-codegen-") as temporary:
 task_root=Path(temporary);(task_root/'home').mkdir();env_file=task_root/'empty.env';env_file.write_text('')
 environment={key:value for key,value in os.environ.items() if not key.startswith(('CONVEX_','CORTEX_AUTH','LOCAL_CONVEX_','CLOUD_CONVEX_'))}
 environment['HOME']=str(task_root/'home')
 result=subprocess.run(['node','--import','tsx',str(q/'local-chat-codegen.mts'),str(env_file)],env=environment)
 raise SystemExit(result.returncode)
