import os,subprocess
for argv in [['node','--version'],['/workspace/Project-Cortex/work/resume/toolchain-bin/npm','--version']]:
 subprocess.run(argv,check=True)
