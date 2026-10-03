import fs from "node:fs";
import assert from "node:assert/strict";
const base="_goals/convex-backend-runtime-2026-10-02/qa/task03b2a/checks";
const ordinary=JSON.parse(fs.readFileSync(`${base}/cycle2-probes.log`,"utf8"));
const additional=JSON.parse(fs.readFileSync(`${base}/cycle2-additional-probes.log`,"utf8"));
assert.equal(ordinary.length,10);assert.equal(additional.length,8);
assert.equal(ordinary[0].read.accepted,false);assert.equal(ordinary[0].store.accepted,true);assert.equal(ordinary[0].leakedPriorValue,false);
assert.equal(Object.hasOwn(ordinary[0].store.result,"previousVersions"),false);
for(const row of ordinary.slice(1,9)) { assert.equal(row.accepted,false,row.name);assert.equal(row.writes,0,row.name);if(Object.hasOwn(row,"attemptedWrites"))assert.equal(row.attemptedWrites,0,row.name); }
assert.equal(ordinary[9].pass,true);
for(const row of additional) { assert.equal(row.accepted,false,row.name);if(Object.hasOwn(row,"writes"))assert.equal(row.writes,0,row.name); }
const numeric=JSON.parse(fs.readFileSync(`${base}/cycle2-numeric-probe.log`,"utf8"));assert.equal(numeric.denied,true);assert.equal(numeric.attemptedWrites,0);
console.log(JSON.stringify({observations:19,verified:true,source:"Cycle-one archived independent probe text copied unchanged, plus numeric rejection assertion adapted for the repaired behavior"}));
