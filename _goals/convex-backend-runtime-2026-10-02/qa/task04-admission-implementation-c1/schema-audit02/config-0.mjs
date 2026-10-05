import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const root = process.cwd(); const require = createRequire(path.join(root,"package.json")); const ts = require("typescript");
const qa = path.join(root,"_goals/convex-backend-runtime-2026-10-02/qa/task04-admission-implementation-c1");
function loadSchema(before) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file,module);
    const source = before && file === path.join(root,"convex-dev/schema.ts") ? fs.readFileSync(path.join(qa,"schema.ts.before.text"),"utf8") : fs.readFileSync(file,"utf8");
    const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const localRequire = (id) => {
      if (!id.startsWith(".")) return require(id);
      const base = path.resolve(path.dirname(file),id.replace(/\.js$/,""));
      const target = [base+".ts",base+".js",path.join(base,"index.ts")].find((candidate) => fs.existsSync(candidate));
      if (!target) throw new Error("Missing static import "+id); return load(target);
    };
    const fn = vm.runInThisContext("(function(require,module,exports){"+code+"\n})",{filename:file}); fn(localRequire,module,module.exports); return module.exports;
  }
  return load(path.join(root,"convex-dev/schema.ts")).default;
}
function exported(schema) { return Object.fromEntries(Object.entries(schema.tables).map(([name, table]) => [name,table.export()])); }
const old = exported(loadSchema(true)); const current = exported(loadSchema(false));
assert.equal(Object.keys(old).length,26); assert.equal(Object.keys(current).length,31);
for (const [name,definition] of Object.entries(old)) assert.deepEqual(current[name],definition,"Old native schema changed: "+name);
for (const [name,definition] of Object.entries(current)) {
  const fields = definition.indexes.map((index) => JSON.stringify(index.fields)); assert.equal(new Set(fields).size,fields.length,"Duplicate index fields: "+name);
}
const strip = fs.readFileSync(path.join(root,"convex-dev/schema.ts"),"utf8").replace('import { runtimePolicyTables } from "./runtimePolicySchema";\n',"").replace('  ...runtimePolicyTables,\n',"");
assert.equal(strip,fs.readFileSync(path.join(qa,"schema.ts.before.text"),"utf8"));
const counts = (definitions) => ({tables:Object.keys(definitions).length, normal:Object.values(definitions).reduce((n,table)=>n+table.indexes.length,0),searchVector:Object.values(definitions).reduce((n,table)=>n+table.searchIndexes.length+table.vectorIndexes.length,0)});
const report = {status:"PASS",old:counts(old),current:counts(current),oldDefinitionsEqual:true,exactSchemaBytesExceptImportSpread:true,oldDefinitions:old,currentDefinitions:current};
fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+"\n",{flag:"wx"}); console.log(JSON.stringify({status:report.status,old:report.old,current:report.current}));
