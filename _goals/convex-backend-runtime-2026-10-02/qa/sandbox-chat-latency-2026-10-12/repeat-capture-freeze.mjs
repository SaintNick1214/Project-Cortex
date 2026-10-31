import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const Q = dirname(fileURLToPath(import.meta.url));
const R = resolve(Q, '../../../..');
const baseline = '03256989da22bde35dff78023c1c3962391a68c6';
const require = createRequire(resolve(R, 'package.json'));
const ts = require('typescript');
const hash = value => createHash('sha256').update(value).digest('hex');
const files = ['convex-dev/runtimeModelPolicy.ts', 'convex-dev/runtimeIngestion.ts', 'convex-dev/runtimeIngestionSchema.ts',
  'convex-dev/runtimeBeliefs.ts', 'tests/unit/runtimeIngestion/fixture.ts', 'tests/unit/runtimeIngestion/repeat-capture.test.ts',
  'tests/unit/runtime/model-policy-admission.test.ts'];
const old = path => execFileSync('git', ['show', `${baseline}:${path}`], { cwd: R, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
function declarations(source) {
  const sf = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true);
  const entries = new Map();
  for (const node of sf.statements) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) entries.set(node.name.text, node.body.getText(sf));
    if (ts.isVariableStatement(node)) for (const item of node.declarationList.declarations) {
      if (ts.isIdentifier(item.name) && item.initializer) entries.set(item.name.text, item.initializer.getText(sf));
    }
  }
  return entries;
}
const guarded = {
  'convex-dev/runtimeModelPolicy.ts': ['heldCapacity', 'checkpointHandler', 'currentAuthority', 'currentOperation', 'resolveCurrent', 'resolveHandler', 'runAccount', 'checkSource', 'finalActor', 'assertIngestionPolicyPin'],
  'convex-dev/runtimeIngestion.ts': ['writeStage', 'readiness', 'readEventCurrent', 'requireStageLease', 'requireStageCommit', 'guardIngestionRunBudget', 'assertIngestionPolicyPin', 'persistStage', 'persistDraft', 'commitVectors', 'retry', 'reconcile', 'finishBeliefStage'],
  'convex-dev/runtimeBeliefs.ts': ['commitBeliefPlan', 'commit'],
};
const comparisons = [];
for (const [path, names] of Object.entries(guarded)) {
  const prior = declarations(old(path)), current = declarations(readFileSync(resolve(R, path), 'utf8'));
  for (const name of names) {
    // Imported helpers have no local body; only compare original local declarations.
    if (!prior.has(name)) continue;
    const entry = { path, name, before: hash(prior.get(name)), after: hash(current.get(name) ?? ''), equal: prior.get(name) === current.get(name) };
    comparisons.push(entry); if (!entry.equal) throw new Error(`Guard body changed: ${path}:${name}`);
  }
}
const policyBefore = declarations(old(files[0])).get('admitHandler');
const policyAfter = declarations(readFileSync(resolve(R, files[0]), 'utf8')).get('admitHandler');
const inserted = /  const admission = \{ version: 1 as const, origin: "unreserved-admission" as const, operationKey: args\.operationKey,\n    runBudgetId: args\.runBudgetId, semanticId: args\.semanticId, ordinal: args\.ordinal \};\n  capacity\(tenant, ceiling, effectiveSnapshot\.limits\.tenantBudgetUnits, effectiveSnapshot\.limits\.concurrency, admission\);\n  capacity\(run, ceiling, effectiveSnapshot\.limits\.runBudgetUnits, effectiveSnapshot\.limits\.concurrency, admission\);/;
const restored = policyAfter.replace(inserted, '  capacity(tenant, ceiling, effectiveSnapshot.limits.tenantBudgetUnits, effectiveSnapshot.limits.concurrency);\n  capacity(run, ceiling, effectiveSnapshot.limits.runBudgetUnits, effectiveSnapshot.limits.concurrency);');
if (restored !== policyBefore) throw new Error('Admission differs beyond the classified capacity boundary');
const equivalence = { baseline, comparisons, admissionDiagnosticInverse: { equal: true, originalBodySha256: hash(policyBefore), inverseBodySha256: hash(restored) },
  limits: 'Literal body/inverse comparisons only; not native OCC or service acceptance.' };
writeFileSync(resolve(Q, 'repeat-capture-equivalence.json'), JSON.stringify(equivalence, null, 2) + '\n');
const receipts = ['repeat-capture-focused-v1', 'repeat-capture-focused-v2', 'repeat-capture-focused-v3', 'repeat-capture-affected-v1',
  'repeat-capture-affected-v2', 'repeat-capture-expiry-final', 'repeat-capture-gateway-isolated'];
const checks = receipts.map(name => {
  const data = JSON.parse(readFileSync(resolve(Q, `${name}.json`), 'utf8'));
  return { name, exit: Number(readFileSync(resolve(Q, `${name}.exit`), 'utf8')), tests: data.numTotalTests,
    passed: data.numPassedTests, failed: data.numFailedTests, skipped: data.numPendingTests, todo: data.numTodoTests,
    suites: data.numTotalTestSuites, passedSuites: data.numPassedTestSuites, failedSuites: data.numFailedTestSuites,
    paths: data.testResults.map(result => result.name), logSha256: hash(readFileSync(resolve(Q, `${name}.log`))),
    jsonSha256: hash(readFileSync(resolve(Q, `${name}.json`))) };
});
const typesLint = ['repeat-capture-backend-types-v1', 'repeat-capture-backend-types-v2', 'repeat-capture-root-types-v1',
  'repeat-capture-root-types-v2', 'repeat-capture-lint-types-v1', 'repeat-capture-scoped-lint-v1', 'repeat-capture-scoped-lint-v2',
  'repeat-capture-expiry-lint-final'].map(name => ({ name, exit: Number(readFileSync(resolve(Q, `${name}.exit`), 'utf8')),
    logSha256: hash(readFileSync(resolve(Q, `${name}.log`))) }));
const freeze = { baseline, observedHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: R }).toString().trim(), node: process.version,
  files: files.map(path => ({ path, sha256: hash(readFileSync(resolve(R, path))),
    beforeSha256: path.endsWith('/repeat-capture.test.ts') ? null : hash(old(path)) })),
  checks, typesLint, equivalenceSha256: hash(readFileSync(resolve(Q, 'repeat-capture-equivalence.json'))),
  finalCombinedTypesBuildContracts: 'Pending coordinator shared gate after A/B freezes; no SDK build/pack/service by this author.',
  outcome: 'Source implementation frozen, original failures retained; no native/SLO acceptance.' };
writeFileSync(resolve(Q, 'repeat-capture-source-freeze.json'), JSON.stringify(freeze, null, 2) + '\n');
console.log(JSON.stringify({ files: freeze.files, comparisons: comparisons.length, checks: checks.map(({ name, exit, tests, passed, skipped, todo, suites }) => ({ name, exit, tests, passed, skipped, todo, suites })),
  freezeSha256: hash(readFileSync(resolve(Q, 'repeat-capture-source-freeze.json'))), equivalenceSha256: freeze.equivalenceSha256 }));
