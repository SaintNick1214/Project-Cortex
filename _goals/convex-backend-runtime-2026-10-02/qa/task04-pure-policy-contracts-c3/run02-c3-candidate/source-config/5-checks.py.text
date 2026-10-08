import pathlib, subprocess, hashlib, json, datetime, sys
root = pathlib.Path('/workspace/Project-Cortex')
qa = root / '_goals/convex-backend-runtime-2026-10-02/qa/task04-pure-policy-contracts-c3'
phase = sys.argv[1]
run = qa / sys.argv[2]
run.mkdir()  # Refuse reuse; no historical receipt is overwritten.
source_paths = ['src/domain/model-policy.ts', 'src/domain/index.ts', 'tests/unit/domain/model-policy.test.ts']
config_paths = [str((qa / name).relative_to(root)) for name in ['tsconfig.scoped.json', 'jest.scoped.mjs', 'checks.py']]
paths = source_paths + config_paths

def fingerprints():
    return [{'path': p, 'sha256': hashlib.sha256((root / p).read_bytes()).hexdigest(), 'bytes': (root / p).stat().st_size} for p in paths]

(run / 'source-config').mkdir()
for ordinal, path in enumerate(paths):
    with (run / 'source-config' / f'{ordinal}-{pathlib.Path(path).name}.text').open('xb') as stream:
        stream.write((root / path).read_bytes())
with (run / 'source-config-manifest.json').open('x') as stream:
    json.dump({'observedAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'files': fingerprints()}, stream, indent=2)
    stream.write('\n')

def check(name, argv):
    before = fingerprints()
    start = datetime.datetime.now(datetime.timezone.utc).isoformat()
    started = {'command': argv, 'cwd': str(root), 'startedAtUTC': start, 'sourceAndConfigBefore': before,
               'environmentLoaders': False, 'phase': phase}
    with (run / (name + '.started.json')).open('x') as stream:
        json.dump(started, stream, indent=2); stream.write('\n')
    with (run / (name + '.stdout')).open('x') as stdout, (run / (name + '.stderr')).open('x') as stderr:
        result = subprocess.run(argv, cwd=root, stdout=stdout, stderr=stderr)
    receipt = {**started, 'finishedAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'exitCode': result.returncode, 'sourceAndConfigAfter': fingerprints()}
    assert receipt['sourceAndConfigAfter'] == before
    with (run / (name + '.receipt.json')).open('x') as stream:
        json.dump(receipt, stream, indent=2); stream.write('\n')
    print(name, result.returncode, flush=True)
    return result.returncode

config = str((qa / 'jest.scoped.mjs').relative_to(root))
type_config = str((qa / 'tsconfig.scoped.json').relative_to(root))
check('affected-types', ['node', 'node_modules/typescript/bin/tsc', '--project', type_config, '--noEmit'])
check('unit', ['node', '--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--config', config,
               '--runInBand', '--json', '--outputFile', str(run / 'unit.result.json')])
if phase == 'final':
    check('node', ['node', '--version'])
    npm_cli = '/home/agent/.npm/_npx/1106a35d869e25fb/node_modules/npm/bin/npm-cli.js'
    check('npm', ['node', npm_cli, '--version'])
    check('scoped-lint', ['node', 'node_modules/eslint/bin/eslint.js', *source_paths, '--report-unused-disable-directives', '--max-warnings=0'])
    check('discovery', ['node', '--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--config', config, '--listTests', '--runInBand'])
    check('root-build', ['node', npm_cli, 'run', 'build'])
    check('public-contracts', ['node', npm_cli, 'run', 'test:contracts'])
    check('domain-browser', ['node', 'work/resume/task04-pure-policy-c3/browser-contract.mjs'])
