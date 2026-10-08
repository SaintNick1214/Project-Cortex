import pathlib,json,re,difflib
root=pathlib.Path('/workspace/Project-Cortex');b=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-composition-c2';runner='_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-composition-c2/current-compose.mjs';scratch=root/'work/resume/task04-current-catalog-composition-c2/test-scratch';scratch.mkdir(exist_ok=True)
patch=[];mapping=[]
for name in json.loads((b/'original-tests.json').read_text()):
 before=(root/name).read_text();proposal=before.replace('_goals/convex-backend-runtime-2026-10-02/qa/task03-artifact-schema-index-repair/strict-compose.mjs',runner).replace('_goals/convex-backend-runtime-2026-10-02/qa/task03b2d/inventory.mjs',runner)
 # Isolated execution directs otherwise-temporary writes into its owned workspace.
 copy=proposal.replace('os.tmpdir()',json.dumps(str(scratch)))
 if name.endswith('schema-indexes.test.ts'):
  addition='''import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
'''
  proposal=proposal.replace('import schema from "../../../convex-dev/schema";', 'import schema from "../../../convex-dev/schema";\n'+addition)
  old='    expect(Object.keys(schema.tables)).toHaveLength(26);'
  new='''    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-current-schema-composition-"));
    let baselineNames: string[];
    try {
      const composition = JSON.parse(execFileSync(process.execPath, ["RUNNER", directory], { encoding: "utf8" }));
      const baseline = JSON.parse(fs.readFileSync(composition.exactCurrentRepair.nativeWitness, "utf8"));
      baselineNames = baseline.definitions.map((row: { table: string }) => row.table);
      expect(composition.currentComposition.baselineProjectionHash).toBe("07df1b0be4647848a3e9fbd1eb9d27d81ad78194f77d3c447c7ee4f2de419b1d");
      expect(composition.currentComposition.totals).toEqual({ baselineTables: 26, additiveTables: 5, currentTables: 31, indexes: 184, policyInternal: 16 });
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
    expect(fs.existsSync(directory)).toBe(false);
    expect(baselineNames!).toHaveLength(26);
    expect(Object.keys(schema.tables).filter(table => baselineNames!.includes(table))).toEqual(baselineNames!);'''.replace('RUNNER',runner)
  assert proposal.count(old)==1;proposal=proposal.replace(old,new);copy=proposal.replace('os.tmpdir()',json.dumps(str(scratch)))
 # Proposed root splice uses only its owned scratch, matching runner destination fences.
 proposal=proposal.replace('os.tmpdir()', 'path.resolve("work/resume/task04-current-catalog-composition-c2/test-scratch")')
 proposal=proposal.replace("import os from 'node:os';\n",'').replace('import os from "node:os";\n','')
 proposal=proposal.replace('const directory = fs.mkdtempSync(', 'fs.mkdirSync(path.resolve("work/resume/task04-current-catalog-composition-c2/test-scratch"), { recursive: true });\n  const directory = fs.mkdtempSync(').replace('const target = fs.mkdtempSync(', 'fs.mkdirSync(path.resolve("work/resume/task04-current-catalog-composition-c2/test-scratch"), { recursive: true });\n    const target = fs.mkdtempSync(')
 copy=proposal
 # Only import routing differs from proposed root test changes, original dependency fixtures stay exact.
 def imports(match):
  prefix,spec,suffix=match.groups()
  if not spec.startswith('.'):return match.group(0)
  resolved=(root/name).parent/spec
  return prefix+str(resolved.resolve())+suffix
 copy=re.sub(r'((?:from\s+|import\s*)[\'\"])(\.[^\'\"]+)([\'\"])',imports,copy)
 target=b/'copies'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(copy)
 patch.extend(difflib.unified_diff(before.splitlines(True),proposal.splitlines(True),fromfile='a/'+name,tofile='b/'+name))
 mapping.append({'original':name,'isolatedCopy':str(target.relative_to(b)),'rootPatch':'runner selection and exact-baseline/current additive checks only','copyOnlyChanges':'absolute public imports only; owned scratch routing is also explicit in proposed root patch; no changed native/closedauthority assertions'})
(b/'proposed-four-file-minimal.patch').write_text(''.join(patch));(b/'copy-map.json').write_text(json.dumps(mapping,indent=2)+'\n')
