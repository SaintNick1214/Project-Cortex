from pathlib import Path
r=Path.cwd(); b=r/'_goals/convex-backend-runtime-2026-10-02/qa'; p=b/'task04-parent-native-inputs-c6-preparation'; q=b/'task04-parent-native-inputs-c6-review'; w=r/'work/resume/task04-parent-native-inputs-c6-review'
s=(p/'offline.mjs.text').read_text().replace("'../../../../_goals/", "'/workspace/Project-Cortex/_goals/")
s=s.replace("qa=path.resolve('_goals/convex-backend-runtime-2026-10-02/qa/task04-parent-native-inputs-c6-preparation')", "qa=path.resolve('_goals/convex-backend-runtime-2026-10-02/qa/task04-parent-native-inputs-c6-review')")
s=s.replace("work=path.resolve('work/resume/task04-native-admission-fixture-c8/parent-c6')", "work=path.resolve('work/resume/task04-parent-native-inputs-c6-review')")
s=s.replace("'results-final02.json'", "'fresh62-results.json'")
s=s.replace("let preflightCalls=0,signatures=0", "let preservationCalls=0;let preflightCalls=0,signatures=0")
s=s.replace("preservationPreflight:()=>({offlineBoundary:true})", "preservationPreflight:()=>{preservationCalls++;if(change.scanDelay)clock+=change.scanDelay;if(change.scanFailure)throw Error('INDEPENDENT_PRESERVATION_DENIAL');return {offlineBoundary:true};}")
s=s.replace("return{preflightCalls,signatures", "return{preservationCalls,preflightCalls,signatures")
s=s.replace("const final={utc:", """await watcherProbe('entry-scan-charged-to-total-deadline',{scanDelay:120001});
await watcherProbe('end-scan-charged-to-total-deadline',{scanDelay:60001});
await watcherProbe('entry-preservation-denial-before-any-output',{scanFailure:true});
const final={utc:""")
(w/'fresh.mjs').write_text(s);(q/'fresh.mjs.text').write_text(s)
(q/'prior-review-results.json').write_bytes((p/'prior-review-results.json').read_bytes())
