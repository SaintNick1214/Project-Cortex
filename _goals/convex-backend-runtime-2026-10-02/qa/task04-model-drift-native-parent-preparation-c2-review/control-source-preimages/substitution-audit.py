from pathlib import Path
import re,json,hashlib
r=Path.cwd();w=r/'work/resume/task04-model-drift-native-parent-preparation-c2-review';own=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-parent-preparation-c2-review';source=(w/'final-control-inputs/scripts/parent-inputs.mjs').read_text();names=['historicalSources','historicalLocatorHashes'];original={name:re.search(r'export const '+name+r'=Object.freeze\(\{[\s\S]*?\}\);',source).group(0) for name in names};rows=[];H=lambda b:hashlib.sha256(b).hexdigest()
for p in sorted((w/'final-control-cases').rglob('vm-parent-DUMMY-source.mjs')):
 vm=p.read_text();restored=vm;decl=[]
 for name in names:
  pattern=r'export const '+name+r'=Object.freeze\(\{[\s\S]*?\}\);';match=re.search(pattern,vm);assert match
  restored=re.sub(pattern,lambda _:original[name],restored,count=1)
  decl.append({'name':name,'originalDeclarationSHA256':H(original[name].encode()),'DUMMYDeclarationSHA256':H(match.group(0).encode())})
 assert restored==source,str(p)+' only two allowed DUMMY substitutions'
 rows.append({'path':str(p.relative_to(r)),'originalRuntimeSHA256':H(source.encode()),'DUMMYVMSourceSHA256':H(vm.encode()),'onlyTwoAllowedDeclarationsChanged':True,'declarations':decl})
assert len(rows)>=139
(own/'DUMMY-substitution-audit.json').write_text(json.dumps({'status':'PASS','cases':len(rows),'exactSourceRestorationProven':True,'actualC11PrivateInputs':'NEVER_READ','rows':rows},indent=2)+'\n');print(json.dumps({'status':'PASS','DUMMYcasesVerified':len(rows)}))
