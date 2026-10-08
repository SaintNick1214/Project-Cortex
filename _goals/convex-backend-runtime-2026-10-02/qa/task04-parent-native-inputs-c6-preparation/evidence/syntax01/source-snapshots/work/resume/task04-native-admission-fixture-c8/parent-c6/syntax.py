from pathlib import Path
import subprocess
paths=['work/resume/task04-native-c8-parent-inputs.mjs','work/resume/task04-native-current-inputs-c6.mjs','work/resume/task04-native-admission-fixture-c8/parent-c6/offline.mjs']
for p in paths:subprocess.run(['node','--check',p],check=True)
print('PASS syntax3; real signing/network/credential reads0; nativeNOT_RUN')
