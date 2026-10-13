import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { canonicalModelJson } from "../../../../src/domain/model-policy.ts";
import { semanticHash } from "../../../../src/domain/profile.ts";
import { OBSERVED_GATEWAY_POLICY_MANIFEST_V18 } from "../../../../convex-dev/runtimeGatewayMediaQualifications.ts";
import { fullRootProvenanceFor, rootProvenanceEncodings } from "../../../../convex-dev/runtimePolicySchema.ts";

const baseline = "3dd4542563ce9fcb2bbf7ab23741854600effdc3", cwd = new URL("../../../../", import.meta.url);
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const printer = ts.createPrinter({ removeComments: true });
function parsed(path, text) { return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS); }
function printed(node, source) { return printer.printNode(ts.EmitHint.Unspecified, node, source); }
function bodies(source) {
  const out = new Map();
  for (const node of source.statements) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) out.set(node.name.text, printed(node, source));
    if (ts.isVariableStatement(node)) for (const item of node.declarationList.declarations) {
      if (!ts.isIdentifier(item.name) || !item.initializer) continue;
      const value = item.initializer;
      if (ts.isCallExpression(value)) {
        const object = value.arguments.find(ts.isObjectLiteralExpression);
        const handler = object?.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(source) === "handler");
        if (handler) out.set(item.name.text, printed(handler, source));
      }
    }
  }
  return out;
}
function ioAndAuthority(source) {
  const sequence = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      if (callee.startsWith("ctx.db.") || callee === "ctx.runQuery" || callee === "ctx.runMutation" || callee === "ctx.runAction"
        || callee === "recheckAuthority" || callee === "guardAgentRunBudget" || callee === "readCurrentExecutableDefinition")
        sequence.push({ callee, arguments: node.arguments.map(argument => printed(argument, source)) });
    }
    ts.forEachChild(node, visit);
  }
  visit(source); return sequence;
}
const production = ["convex-dev/runtimePolicySchema.ts", "convex-dev/runtimeModelPolicy.ts", "convex-dev/agentDefinitions.ts"];
const changedBodies = { "convex-dev/runtimeModelPolicy.ts": new Set(["provenance", "trustedRoot", "activeRoot", "policies", "resolveCurrent", "bindTrustedBudget", "installDeploymentPolicy", "admitHandler"]),
  "convex-dev/agentDefinitions.ts": new Set(["narrowPolicies"]) };
const evidence = [];
for (const path of production) {
  const original = execFileSync("git", ["show", `${baseline}:${path}`], { cwd, encoding: "utf8" });
  const current = fs.readFileSync(new URL(path, cwd), "utf8"), oldTree = parsed(path, original), newTree = parsed(path, current);
  assert.deepEqual(ioAndAuthority(newTree), ioAndAuthority(oldTree), `${path}: original native DB/RPC/authority callsite sequence`);
  const before = bodies(oldTree), after = bodies(newTree), unchanged = [];
  for (const [name, body] of before) if (!changedBodies[path]?.has(name)) {
    assert.equal(after.get(name), body, `${path}:${name} original unchanged body`); unchanged.push({ name, normalizedSha256: hash(body) });
  }
  const unchangedSchemaInitializers = [];
  if (path.endsWith("runtimePolicySchema.ts")) {
    function initializer(source, name) {
      for (const statement of source.statements) if (ts.isVariableStatement(statement))
        for (const declaration of statement.declarationList.declarations) if (declaration.name.getText(source) === name) return printed(declaration.initializer, source);
      throw new Error(`Missing initializer ${name}`);
    }
    assert.equal(initializer(oldTree, "rootProvenance"), initializer(newTree, "fullRootProvenance"), "original full Convex object validator exact AST");
    for (const statement of oldTree.statements) if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations) {
        const name = declaration.name.getText(oldTree); if (name === "rootProvenance") continue;
        assert.equal(initializer(oldTree, name), initializer(newTree, name), `original schema/table/index initializer ${name}`);
        unchangedSchemaInitializers.push(name);
      }
  }
  evidence.push({ path, originalSha256: hash(original), currentSha256: hash(current), nativeIoAndAuthorityCalls: ioAndAuthority(newTree).length, unchangedBodies: unchanged, unchangedSchemaInitializers });
}
const appendOnly = [];
for (const path of ["tests/unit/runtime/model-policy-admission.test.ts", "tests/unit/runtime/profile-policy-selection.test.ts"]) {
  const original = execFileSync("git", ["show", `${baseline}:${path}`], { cwd, encoding: "utf8" });
  const current = fs.readFileSync(new URL(path, cwd), "utf8"); assert.ok(current.startsWith(original), `${path}: original assertions preserved byte exact`);
  appendOnly.push({ path, originalBytes: Buffer.byteLength(original), originalSha256: hash(original), currentSha256: hash(current) });
}
const manifest = OBSERVED_GATEWAY_POLICY_MANIFEST_V18, canonical = canonicalModelJson(manifest);
const encodings = rootProvenanceEncodings(fullRootProvenanceFor(manifest, canonical, await semanticHash(canonical)), canonicalModelJson);
const currentV18 = { manifestId: manifest.manifestId, revision: manifest.revision, classification: manifest.classification,
  deploymentPolicies: manifest.policies.filter(p => p.scope === "deployment").length, qualifications: manifest.qualifications.length,
  manifestCanonicalSha256: hash(canonical), manifestCanonicalUtf8Bytes: Buffer.byteLength(canonical),
  fullRootCanonicalUtf8Bytes: Buffer.byteLength(encodings.full), compactRootCanonicalUtf8Bytes: Buffer.byteLength(encodings.compact),
  serialization: "Production canonicalModelJson encoded UTF-8; explicit OBSERVED_GATEWAY_POLICY_MANIFEST_V18 source, not deployed K7/K6 records or Convex storage telemetry" };
const out = { baseline, node: process.version, kind: "source equivalence and explicit current compiled V18 serialization; no native deployment/OCC/SLO claim", evidence, appendOnly, currentV18 };
fs.writeFileSync(new URL("cloud-compact-policy-root-equivalence.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ unchangedBodies: evidence.reduce((n, file) => n + file.unchangedBodies.length, 0), nativeIoAndAuthorityCalls: evidence.reduce((n, file) => n + file.nativeIoAndAuthorityCalls, 0), appendOnly: appendOnly.length, currentV18 }));
