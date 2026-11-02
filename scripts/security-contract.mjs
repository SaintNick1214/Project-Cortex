import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const semgrepVersion = '1.179.0';
const scanJobs = ['codeql-analysis', 'dependency-scan', 'secret-scan', 'api-security'];
const events = ['pull_request', 'push', 'schedule', 'workflow_dispatch'];

/** PR uploads are supported even for read-only fork/Dependabot tokens by GitHub. */
export function securityPolicy({ eventName, actor }) {
  if (!events.includes(eventName)) throw new Error(`Unsupported security event: ${eventName}`);
  const scorecardAnalysisExpected = eventName === 'pull_request' || eventName === 'workflow_dispatch';
  return {
    required: [...scanJobs, ...(eventName === 'pull_request' ? ['dependency-review'] : []), ...(scorecardAnalysisExpected ? ['scorecard-analysis'] : [])],
    skipped: [...(eventName === 'pull_request' ? [] : ['dependency-review']), ...(scorecardAnalysisExpected ? [] : ['scorecard-analysis'])],
    uploadRequired: eventName === 'pull_request' || actor !== 'dependabot[bot]',
  };
}

/** Every mandatory job must complete successfully, including scan and required upload. */
export function securitySummary(context, needs) {
  const policy = securityPolicy(context);
  const failures = [], rows = [];
  for (const job of policy.required) {
    const result = needs?.[job]?.result;
    rows.push(`${job}: ${result ?? 'missing'} (required execution/finding policy)`);
    if (result !== 'success') failures.push(`${job}: ${result ?? 'missing'}`);
  }
  for (const job of policy.skipped) {
    const result = needs?.[job]?.result;
    const reason = job === 'dependency-review' ? 'dependency review applies only to PRs' : 'Scorecard PR/manual analysis does not apply to this event';
    rows.push(`${job}: ${result ?? 'missing'} (expected skip: ${reason})`);
    if (result !== 'skipped') failures.push(`${job}: expected skipped, got ${result ?? 'missing'}`);
  }
  rows.push('Scorecard external publishing runs in the separate advisory Scorecard Publishing workflow; its outcome is not observed by this security summary.');
  rows.push(policy.uploadRequired
    ? 'CodeQL, Trivy and Semgrep SARIF upload required; PR uploads support read-only fork/bot tokens.'
    : 'SARIF upload unavailable: non-PR Dependabot token is read-only. Local scan/results required; uploaded alert coverage is incomplete.');
  rows.push('Scorecard PR/manual coverage requires source checks before/after analysis and before upload, a scan, valid Scorecard SARIF and successful GitHub upload; scores remain advisory.');
  rows.push('Upstream Scorecard PR/manual support is experimental; fork repositories are unsupported; non-PR runs require the default branch.');
  rows.push('Findings: Gitleaks blocks secrets; PR Dependency Review blocks reviewed high-severity/license additions.');
  rows.push('CodeQL/Trivy/Semgrep findings use existing GitHub code-scanning alert rules. Semgrep CLI reports findings without a new exit-code threshold; Scorecard scores are advisory.');
  rows.push('Semgrep native SARIF tool is Semgrep OSS; branch alert policy must cover that identity at the existing thresholds.');
  const semgrep = needs?.['api-security']?.outputs;
  if (semgrep) rows.push(`Semgrep CE: ${semgrep.scanned ?? 'unknown'} files, ${semgrep.findings ?? 'unknown'} findings, ${semgrep.partial_parsing ?? 'unknown'} PartialParsing warnings (affected lines lack parser coverage; see scanner summary/artifact).`);
  rows.push('Execution success does not certify zero vulnerabilities or satisfy the separate Snyk release gate.');
  return { ok: failures.length === 0, failures, rows };
}

/** Read-only source fences: no retries, ref mutation, metadata overrides or PAT. */
export function checkScorecardSource({ eventName, repository, ref, sha }, { spawn = spawnSync, token = process.env.GH_TOKEN } = {}) {
  if (!['pull_request', 'workflow_dispatch'].includes(eventName) || typeof repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || repository.split('/').some(part => part === '.' || part === '..') || !/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('Exact GitHub Scorecard event, repository and SHA are required');
  if (eventName === 'pull_request' ? !/^refs\/pull\/\d+\/merge$/.test(ref ?? '') : !/^refs\/heads\/.+/.test(ref ?? '')) throw new Error('Scorecard requires the normal PR merge ref or a manual branch ref');
  const read = (executable, args) => {
    const outcome = spawn(executable, args, {
      encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024,
      env: executable === 'gh' ? { ...process.env, GH_TOKEN: token } : process.env,
    });
    if (outcome.error || outcome.signal || outcome.status !== 0 || typeof outcome.stdout !== 'string') throw new Error(`Scorecard source observation failed (${executable}: ${outcome.signal ?? outcome.status ?? 'unavailable'})`);
    return outcome.stdout.trim();
  };
  const checkoutSha = read('git', ['rev-parse', '--verify', 'HEAD']);
  if (checkoutSha !== sha) throw new Error('Scorecard checkout HEAD does not match the workflow SHA');
  if (eventName === 'pull_request') return { eventName, ref, sha, checkoutSha, source: 'normal-pr-merge-checkout' };
  if (typeof token !== 'string' || !token.trim()) throw new Error('The default GH_TOKEN is required for read-only manual Scorecard source checks');
  const get = endpoint => {
    const value = read('gh', ['api', '--hostname', 'github.com', '--method', 'GET', endpoint]);
    try { return JSON.parse(value); } catch { throw new Error('Invalid GitHub JSON in Scorecard source observation'); }
  };
  const metadata = get(`repos/${repository}`);
  const defaultBranch = metadata?.default_branch;
  if (typeof defaultBranch !== 'string' || !defaultBranch || /[\0\r\n]/.test(defaultBranch)) throw new Error('GitHub did not report a valid repository default branch');
  const defaultRef = `refs/heads/${defaultBranch}`;
  if (ref !== defaultRef) throw new Error('Manual Scorecard source must use the repository default branch');
  const remote = get(`repos/${repository}/git/ref/heads/${defaultBranch.split('/').map(encodeURIComponent).join('/')}`);
  if (remote?.ref !== defaultRef || remote.object?.type !== 'commit' || remote.object.sha !== sha) throw new Error('Remote default branch no longer matches the manual dispatch SHA');
  // Re-read the checkout after the bounded GETs; never accept a moving local HEAD.
  if (read('git', ['rev-parse', '--verify', 'HEAD']) !== sha) throw new Error('Scorecard checkout HEAD moved during the source check');
  return { eventName, ref, sha, checkoutSha, source: 'remote-default-head', defaultBranch, remoteSha: remote.object.sha };
}

/** Validate the uploadable SARIF envelope/results and reject reported execution errors. */
export function validateSarif(value, expectedTool) {
  if (value?.version !== '2.1.0' || !Array.isArray(value.runs) || value.runs.length === 0) throw new Error('Invalid SARIF 2.1.0 runs');
  let findings = 0;
  for (const run of value.runs) {
    if (typeof run?.tool?.driver?.name !== 'string' || run.tool.driver.name.toLowerCase() !== expectedTool.toLowerCase()) throw new Error(`Unexpected SARIF tool; expected ${expectedTool}`);
    if (!Array.isArray(run.results)) throw new Error('Missing SARIF results');
    for (const result of run.results) {
      if (typeof result?.ruleId !== 'string' || result.ruleId.length === 0 || ![result.message?.text, result.message?.markdown].some(message => typeof message === 'string' && message.length > 0)) throw new Error('Invalid SARIF finding');
      if (!Array.isArray(result.locations) || !result.locations.some(location => typeof location?.physicalLocation?.artifactLocation?.uri === 'string')) throw new Error('Missing SARIF finding location');
    }
    for (const invocation of run.invocations ?? []) {
      if (invocation.executionSuccessful === false || invocation.toolExecutionNotifications?.some(notification => notification.level === 'error')) throw new Error('SARIF reports scanner execution errors');
    }
    findings += run.results.length;
  }
  return { findings };
}

export function validateSemgrepResults({ status, signal, error, json, sarif }) {
  if (error || signal || status !== 0) throw new Error(`Semgrep execution failed: ${error?.message ?? signal ?? status ?? 'no exit status'}`);
  if (json?.version !== semgrepVersion || !Array.isArray(json.results) || !Array.isArray(json.errors) || !Array.isArray(json.paths?.scanned)) throw new Error('Invalid Semgrep JSON/version/coverage');
  // CE may partially parse modern TypeScript. Preserve/report those warnings;
  // all other config, engine, timeout and unclassified errors remain fatal.
  const partialParsing = json.errors.filter(issue => issue?.code === 3 && issue.level === 'warn' && issue.type?.[0] === 'PartialParsing' && typeof issue.path === 'string' && issue.path.length > 0);
  if (partialParsing.length !== json.errors.length) throw new Error(`Semgrep reported ${json.errors.length - partialParsing.length} fatal/unclassified scan errors`);
  if (json.paths.scanned.length === 0) throw new Error('Semgrep scanned no source files');
  if (!json.paths.scanned.every(path => typeof path === 'string' && path.length > 0)) throw new Error('Invalid Semgrep scanned paths');
  const result = validateSarif(sarif, 'Semgrep OSS');
  if (result.findings !== json.results.length) throw new Error('Semgrep JSON/SARIF finding counts differ');
  return { ...result, scanned: json.paths.scanned.length, version: json.version, partialParsing: partialParsing.map(issue => issue.path), findingPolicy: 'GitHub code-scanning alert rules; native CLI report-only' };
}

export function semgrepArguments({ jsonPath = 'semgrep.json', sarifPath = 'semgrep.sarif' } = {}) {
  const configs = ['p/security-audit', 'p/secrets', 'p/owasp-top-ten', 'p/nodejs', 'p/typescript'];
  // Frozen captures/archives are not active source; include active JS/TS backend and applications.
  const excluded = ['_goals', '_research', 'work', '_DEPRECATED', 'node_modules', 'dist', 'build', 'coverage', '.next', '.git'];
  const included = ['*.js', '*.jsx', '*.ts', '*.tsx', '*.mjs', '*.cjs', '*.mts', '*.cts'];
  return ['scan', '--no-strict', '--oss-only', '--metrics=off', '--disable-version-check', '--json', '--output', jsonPath,
    '--sarif-output', sarifPath, ...configs.flatMap(config => ['--config', config]),
    ...excluded.flatMap(path => ['--exclude', path]), ...included.flatMap(path => ['--include', path]), '.'];
}

/** Delete stale outputs before running; a successful wrapper cannot hide a crashed/empty scan. */
export function runSemgrep({ executable = 'semgrep', cwd = process.cwd(), jsonPath = 'semgrep.json', sarifPath = 'semgrep.sarif', spawn = spawnSync } = {}) {
  const jsonFile = resolve(cwd, jsonPath), sarifFile = resolve(cwd, sarifPath);
  rmSync(jsonFile, { force: true });
  rmSync(sarifFile, { force: true });
  const outcome = spawn(executable, semgrepArguments({ jsonPath, sarifPath }), { cwd, stdio: 'inherit' });
  // Check the actual process first so malformed crash output does not mask its exit code.
  if (outcome.error || outcome.signal || outcome.status !== 0) validateSemgrepResults(outcome);
  const json = JSON.parse(readFileSync(jsonFile, 'utf8'));
  const sarif = JSON.parse(readFileSync(sarifFile, 'utf8'));
  return validateSemgrepResults({ ...outcome, json, sarif });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const command = process.argv[2];
    if (command === 'semgrep') {
      const result = runSemgrep();
      console.log(JSON.stringify(result));
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `scanned=${result.scanned}\nfindings=${result.findings}\npartial_parsing=${result.partialParsing.length}\n`);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        `### Semgrep CE coverage\n\nVersion ${result.version}; ${result.scanned} files scanned; ${result.findings} findings (native CLI report-only; uploaded alert policy remains separate).\n\n${result.partialParsing.length} PartialParsing warnings: affected lines have incomplete parser coverage; no source/rules were excluded to silence these warnings.\n\n\`\`\`text\n${result.partialParsing.join('\n')}\n\`\`\`\n`);
    } else if (command === 'scorecard-source') {
      console.log(JSON.stringify(checkScorecardSource({ eventName: process.env.GITHUB_EVENT_NAME, repository: process.env.GITHUB_REPOSITORY, ref: process.env.GITHUB_REF, sha: process.env.GITHUB_SHA })));
    } else if (command === 'sarif') {
      console.log(JSON.stringify(validateSarif(JSON.parse(readFileSync(process.argv[3], 'utf8')), process.argv[4])));
    } else if (command === 'summary') {
      const result = securitySummary({ eventName: process.env.GITHUB_EVENT_NAME, actor: process.env.GITHUB_ACTOR, ref: process.env.GITHUB_REF }, JSON.parse(process.env.SECURITY_NEEDS ?? '{}'));
      const message = `${result.rows.join('\n')}\n${result.ok ? 'Required security execution and declared policy passed.' : `Mandatory security coverage failed: ${result.failures.join('; ')}`}\n`;
      console.log(message);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Security coverage\n\n\`\`\`text\n${message}\`\`\`\n`);
      if (!result.ok) process.exitCode = 1;
    } else {
      throw new Error('Expected semgrep, sarif <file> <tool>, scorecard-source, or summary command');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
