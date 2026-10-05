import assert from "node:assert/strict";
import { fixture } from "../../../../../tests/unit/runtimeMetadataAuth/fixture.ts";
import { update } from "../../../../../convex-dev/mutable.ts";
const f=fixture();f.seedMutable();let denied=false,error;
try { await f.run(update,{namespace:"counter",key:"one",operation:"increment",operand:null}); } catch(e) { denied=true; error=String(e); }
assert.equal(denied,true);assert.equal(f.db.attemptedWrites,0);assert.equal(f.db.table("mutable")[0].value,5);
console.log(JSON.stringify({name:"explicit null increment operand",denied,error,attemptedWrites:f.db.attemptedWrites,writes:f.db.writes,finalValue:f.db.table("mutable")[0].value},null,2));
