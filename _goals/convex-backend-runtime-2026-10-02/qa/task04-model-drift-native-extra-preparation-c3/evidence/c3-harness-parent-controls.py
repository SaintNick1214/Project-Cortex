from pathlib import Path
import re,shutil,json
repo=Path('/workspace/Project-Cortex');q=repo/'_goals/convex-backend-runtime-2026-10-02/qa';old=q/'task04-terminal-capture-parent-inputs-c9-preparation';work=repo/'work/resume/task04-model-drift-native-preparation-c3'
for kind in ['extension','regression','extra']:
 root=q/f'task04-model-drift-native-{kind}-preparation-c3';scratch=work/kind/'parent-proof';scratch.mkdir(exist_ok=True);suffix='regression' if kind=='regression' else 'extension';src=(old/f'real-chain-{suffix}.mjs.text').read_text()
 # Remove historical subject selector; exact new public helpers are always consumed. DUMMY private fixtures stay inside own scratch.
 a=src.index('const subject=');b=src.index('const parentPath=',a)
 prefix="const repo=process.cwd(),qa="+json.dumps(str(root/'scripts'))+",work="+json.dumps(str(scratch))+",candidate="+json.dumps(str(root))+";const hash=x=>crypto.createHash('sha256').update(x).digest('hex');\n"
 src=src[:a]+prefix+src[b:]
 src=src.replace("const parentPath=path.join(qa,'parent-inputs-"+suffix+".mjs'),watchPath=path.join(qa,'current-inputs-"+suffix+".mjs')", "const parentPath=path.join(qa,'parent-inputs.mjs'),watchPath=path.join(qa,'current-inputs.mjs')")
 src=src.replace("fs.readFileSync(path.join(qa,'accepted-c6-prior-review-results.json'))", "fs.readFileSync("+json.dumps(str(old/'accepted-c6-prior-review-results.json'))+")")
 # Public static arguments import resolves own new packet, no old root-helper imports.
 src=re.sub(r"import \{argumentsFor\} from '[^']+';", "import {argumentsFor} from "+json.dumps(str(root/'scripts/arguments.mjs'))+";",src)
 src=src.replace("'work/backend-runtime/task04-terminal-capture-native-"+suffix+"-'+(subject==='c8'?'c3':'c4')",json.dumps('work/backend-runtime/task04-model-drift-native-'+kind+'-c1'))
 src=src.replace("'work/backend-runtime/task04-terminal-capture-native-extension-'+(subject==='c8'?'c3':'c4')",json.dumps('work/backend-runtime/task04-model-drift-native-'+kind+'-c1'))
 src=src.replace("spec.endsWith('parent-inputs-"+suffix+".mjs')", "spec.endsWith('parent-inputs.mjs')")
 src=src.replace("'task04-terminal-capture-native-extension-preparation-c4/regression'",json.dumps(root.name)).replace("'task04-terminal-capture-native-extension-preparation-c4'",json.dumps(root.name))
 # Preserve real SOURCE hashes; results only own evidence, never overwrite source helpers.
 src=src.replace("path.join(qa,'real-chain-"+suffix+".json')",json.dumps(str(root/'evidence/parent-chain.json')))
 (scratch/'actual-chain.mjs').write_text(src)
print('THREE_NEW_DUMMY_ONLY_PARENT_CHAIN_CONTROLS_PREPARED')
