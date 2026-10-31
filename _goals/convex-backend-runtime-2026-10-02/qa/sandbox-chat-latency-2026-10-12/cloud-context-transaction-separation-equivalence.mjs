import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import ts from "typescript";
const q = new URL("./", import.meta.url), root = new URL("../../../../", q);
const oldText = fs.readFileSync(new URL("cloud-context-transaction-separation-preimage.ts", q), "utf8");
const newText = fs.readFileSync(new URL("convex-dev/runtimeAgent.ts", root), "utf8");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
function declarations(text) {
  const source = ts.createSourceFile("runtimeAgent.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), result = new Map();
  for (const node of source.statements) {
    if (ts.isFunctionDeclaration(node) && node.name) result.set(node.name.text, node.getText(source));
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations)
      result.set(declaration.name.getText(source), declaration.getText(source));
  }
  return result;
}
const old = declarations(oldText), current = declarations(newText), originalBodies = [];
for (const [name, text] of old) {
  if (name === "startExecution") {
    assert.equal(current.get(name), text.replace('"runtimeAgent:executeTurnV2"', '"runtimeAgent:executeTurnV3"'), "Only fresh dispatcher reference changes");
  } else {
    assert.equal(current.get(name), text, `Original declaration byte equality: ${name}`);
    originalBodies.push({ name, sha256: sha(text) });
  }
}
assert.deepEqual([...current.keys()].filter(name => !old.has(name)), ["executeTurnV3"]);
const inline = 'EmptyContextResult>("mutation", "runtimeAgent:prepareEmptyContext"), args, { inline: true });';
assert.equal(current.get("executeTurnV3"), old.get("executeTurnV2").replace("executeTurnV2 =", "executeTurnV3 =").replace(inline, inline.replace("inline: true", "inline: false")), "V3 exact V2 body with one scheduling option changed");
const sources = ["node_modules/@convex-dev/workflow/src/client/workflowContext.ts", "node_modules/@convex-dev/workflow/src/client/step.ts", "node_modules/@convex-dev/workpool/src/component/worker.ts"];
const contracts = sources.map(file => {
  const text = fs.readFileSync(new URL(file, root), "utf8"), lines = text.split("\n");
  const bounds = file.endsWith("workflowContext.ts") ? [[54, 74], [289, 299]] : file.endsWith("step.ts") ? [[160, 199]] : [[56, 66]];
  return { file, sha256: sha(text), excerpts: bounds.map(([start, end]) => ({ start, end, text: lines.slice(start - 1, end).join("\n") })) };
});
const result = { kind: "Source equality plus actual installed primary contract excerpts; runtime behavior tested separately", node: process.version,
  preimageSha256: sha(oldText), currentSha256: sha(newText), unchangedOriginalDeclarations: originalBodies,
  dispatcherChange: "Fresh starts routeV3; startAsync/onComplete/attempt arguments unchanged", addedDeclaration: "executeTurnV3",
  singleLayoutDifference: "prepareEmptyContext inline:true→inline:false; original handler and all other V2 layout bytes retained", contracts };
fs.writeFileSync(new URL("cloud-context-transaction-separation-equivalence.json", q), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ currentSha256: result.currentSha256, unchangedOriginalDeclarations: originalBodies.length,
  executeTurnSha256: sha(old.get("executeTurn")), executeTurnV2Sha256: sha(old.get("executeTurnV2")), contracts: contracts.length }));
