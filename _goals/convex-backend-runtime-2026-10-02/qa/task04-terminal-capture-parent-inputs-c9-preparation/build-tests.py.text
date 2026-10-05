from pathlib import Path
r=Path('/workspace/Project-Cortex');w=r/'work/resume/task04-terminal-capture-parent-inputs-c9-preparation';old=r/'work/resume/task04-terminal-capture-parent-inputs-c8-preparation';q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-parent-inputs-c9-preparation'
for name in ['extension','regression']:
 for kind in ['offline','effect-matrix']:
  s=(old/f'{kind}-{name}.mjs').read_text().replace('parent-inputs-c8-preparation','parent-inputs-c9-preparation').replace('native-extension-preparation-c3','native-extension-preparation-c4').replace('native-extension-c3','native-extension-c4').replace('native-regression-c3','native-regression-c4')
  s=s.replace('exclusive:(p,v)=>{','exclusive:(p,v,privateFile,maxBytes,control)=>{if(control)control.beforeCreate();')
  needle="writes.push(path.basename(p));";s=s.replace(needle,"if(control)for(const phase of ['created','written','durable','closed'])control.observe(phase);"+needle)
  (w/f'{kind}-{name}.mjs').write_text(s)
 (w/name).mkdir(exist_ok=True)
for file in ['guard-controls.mjs','phase-controls.mjs','final-refresh.mjs']:(w/file).write_text((old/file).read_text().replace('parent-inputs-c8-preparation','parent-inputs-c9-preparation').replace('native-extension-preparation-c3','native-extension-preparation-c4'))
# Keep prior C7 requirement GREEN on C8/C7RED evidence reruns unchanged subject bodies; own output/scratch only relocated.
for name in ['extension','regression']:
 s=(old/f'reviewer-requirement-{name}.mjs').read_text().replace('work/resume/task04-terminal-capture-parent-inputs-c8-preparation/requirement-','work/resume/task04-terminal-capture-parent-inputs-c9-preparation/prior-requirement-');(w/f'prior-requirement-{name}.mjs').write_text(s);(w/f'prior-requirement-{name}').mkdir(exist_ok=True)
