import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
const Q='_goals/convex-backend-runtime-2026-10-02/qa/task05-current-seam-refresh-c1-fresh-review/preimages/';
const ledger=fs.readFileSync(Q+'convex-dev--runtimeModelPolicy.ts','utf8');const gateway=fs.readFileSync(Q+'convex-dev--runtimeGateway.ts','utf8');
const ast=s=>ts.createSourceFile('source.ts',s,ts.ScriptTarget.Latest,true);
function decl(s,name){const node=ast(s).statements.find(n=>n.name?.text===name||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText()===name)));assert(node,name);return node.getText();}
let groups=0;
function check(name,source,guard,remove){guard(source);const changed=remove(source);assert.notEqual(changed,source);assert.throws(()=>guard(changed));console.log(`PASS ${++groups}: actual source guard rejects ${name} omission in local string only`);}
check('required terminal sink',decl(gateway,'GatewayComposition'),s=>assert.match(s,/terminalSink: DurableTerminalEvidenceSink/),s=>s.replace('terminalSink: DurableTerminalEvidenceSink','removedSink: unknown'));
check('attachment ledger member',decl(gateway,'GatewayLedgerPort'),s=>assert.match(s,/attachTerminalResult\(args:/),s=>s.replace('attachTerminalResult(args:','removedAttachment(args:'));
const capture=decl(ledger,'captureTerminalEvidence');
assert.doesNotMatch(capture.slice(0,capture.indexOf('handler:')),/privateResultCanonical/);
check('internal capture registration',capture,s=>assert.match(s,/= internalMutation\(/),s=>s.replace('= internalMutation(','= mutation('));
check('captured evidence hash',capture,s=>assert.match(s,/terminalEvidenceHash: receiptHash/),s=>s.replace('terminalEvidenceHash: receiptHash','removedHash: receiptHash'));
const attachment=decl(ledger,'attachTerminalResult');
check('original authority fence',attachment,s=>assert.match(s,/sameAuthority\(args.reference, operation.reference\)/),s=>s.replace('sameAuthority(args.reference, operation.reference)','true'));
check('closed result cannot reopen',attachment,s=>assert.match(s,/if \(attempt.resultAttachmentState === "closed"\) return \{ attached: false, resultWithheld: true \}/),s=>s.replace('attempt.resultAttachmentState === "closed"','false'));
check('current attachment fence',attachment,s=>assert.match(s,/await permittedAttachment\(ctx, args.reference, state\)/),s=>s.replace('await permittedAttachment(ctx, args.reference, state)','true'));
check('pending owned capture visibility',gateway,s=>assert.match(s,/track\("capture", \(\) => capture\(detached\(evidence\)\)\)/),s=>s.replace('track("capture", () => capture(detached(evidence)))','capture(detached(evidence))'));
console.log(JSON.stringify({staticNegativeGroups:groups,classification:'SOURCE_CONTRACT_GUARD_SENSITIVITY_ONLY; local string omissions, no product mutation, no runtime/native acceptance',skips:[]}));
