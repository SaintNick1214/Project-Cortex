"""Finite mature author replay. Bootstrap is ordinary debt, never self-approved."""
import hashlib
import json
import os
import stat
import sys
import time
import types
from pathlib import Path


FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')


def nine(value):
    return {key: str(getattr(value, 'st_' + key)) for key in FIELDS}


def body(fd):
    data = bytearray()
    digest = hashlib.sha256()
    while True:
        chunk = os.read(fd, 65536)
        if not chunk:
            break
        data.extend(chunk)
        digest.update(chunk)
    return bytes(data), digest.hexdigest()


def run(directory, expected_plan, expected_stop, output):
    directory = Path(directory)
    opened = []
    rows = []
    closes = []
    errors = []
    result = {'scope': 'REPAIR2_AUTHOR_FINITE_SOURCE_MOCK_ONLY',
              'bootstrapOrdinaryReadDebt': True, 'sourceEligibility': False,
              'runtimeAuthority': False, 'fullTask03': False, 'fullGoal': False,
              'actualDockerEffects': 0, 'serviceEffects': 0, 'privateReads': 0,
              'allMemberFDsBeforeFirstMemberBody': False,
              'allFDsBeforeFirstHeaderDiscoveryBody': False}
    now = time.time_ns()
    ages = []

    def acquire(path, size=None, digest=None, pin=None):
        value = os.lstat(path)
        observed = nine(value)
        age = (now - max(value.st_mtime_ns, value.st_ctime_ns)) / 1e9
        ages.append(age)
        if age < 240:
            raise ValueError('CURRENT_240_SECOND_MATURITY: ' + str(path) + ' ' + str(age))
        if not stat.S_ISREG(value.st_mode) or value.st_size > 16777216:
            raise ValueError('FINITE_REGULAR_FILE_CAP')
        if pin is not None and observed != pin:
            raise ValueError('ORIGINAL_DECLARED_NINE_NOT_REFRESHED: ' + str(path))
        if size is not None and value.st_size != size:
            raise ValueError('DECLARED_SIZE')
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        opened.append({'path': str(path), 'fd': fd, 'PRE9': observed,
                       'bytes': value.st_size, 'sha256': digest})
        if nine(os.fstat(fd)) != observed:
            raise ValueError('OPEN_NINE')
        return opened[-1]

    def read(row):
        os.lseek(row['fd'], 0, os.SEEK_SET)
        raw, digest = body(row['fd'])
        if len(raw) != row['bytes'] or (row['sha256'] and digest != row['sha256']):
            raise ValueError('FULL_EOF_SIZE_HASH')
        if nine(os.fstat(row['fd'])) != row['PRE9'] or nine(os.lstat(row['path'])) != row['PRE9']:
            raise ValueError('POST_PATH_LITERAL_NINE')
        return raw, digest

    try:
        plan_row = acquire(directory / 'source-input-plan3.json', digest=expected_plan)
        stop_row = acquire(directory / 'source-writers-stopped3.json', digest=expected_stop)
        plan = json.loads(read(plan_row)[0])
        stop = json.loads(read(stop_row)[0])
        assert stop['remainingWrites'] == [] and stop['sourceWriters'] == 'STOPPED'
        assert stop['planSha256'] == expected_plan
        assert sum(row['bytes'] for row in plan['members']) + plan_row['bytes'] + stop_row['bytes'] <= 16777216
        assert len({row['path'] for row in plan['members']}) == len(plan['members'])
        for row in plan['members']:
            acquire(row['path'], row['bytes'], row['sha256'], row['PRE9'])
        result['allMemberFDsBeforeFirstMemberBody'] = True
        values = {}
        for spec, row in zip(plan['members'], opened[2:]):
            values[spec['name']] = read(row)[0]
        sources = {name: raw for name, raw in values.items()}
        # Original controls distinguish raw payload keys from executable names.
        sources.update(carryRaw=sources['carry'], wireRaw=sources['wire'], proofRaw=sources['proof'])
        carry = json.loads(sources['carry'])
        wire = json.loads(sources['wire'])
        proof = json.loads(sources['proof'])

        def module(name):
            value = types.ModuleType('held_repair2_' + name)
            value.__file__ = next(row['path'] for row in plan['members'] if row['name'] == name)
            exec(compile(sources[name], value.__file__, 'exec', dont_inherit=True), value.__dict__)
            return value

        result['admissionControls'] = module('N').run(sources, carry, wire, proof)
        result['originalRegressionControls'] = module('F').run(sources, carry, wire, proof)
        assert result['admissionControls']['failed'] == 0
        assert result['originalRegressionControls']['failed'] == 0
        for row in opened:
            raw, digest = read(row)
            rows.append({key: row[key] for key in ('path', 'PRE9', 'bytes')} |
                        {'OPEN9': row['PRE9'], 'POST9': nine(os.fstat(row['fd'])),
                         'sha256': digest, 'fullEOF': True})
        for row, record in zip(opened, rows):
            final = nine(os.fstat(row['fd']))
            assert final == row['PRE9'] == nine(os.lstat(row['path']))
            record['FINAL9'] = final
        result['result'] = 'PASS_AUTHOR_FINITE_SOURCE_MOCK_ONLY'
    except BaseException as error:
        errors.append({'type': type(error).__name__, 'error': str(error)})
        result['result'] = 'FAILED_UNKNOWN_NO_ADOPTION'
    finally:
        for row in opened:
            try:
                os.close(row['fd'])
                closes.append({'path': row['path'], 'attempt': 1, 'error': None})
            except BaseException as error:
                closes.append({'path': row['path'], 'attempt': 1, 'error': str(error)})
                errors.append({'type': type(error).__name__, 'close': row['path']})
    result.update(rows=rows, closeAttempts=closes, errors=errors, opened=len(opened),
                  minimumCurrentAgeSeconds=min(ages) if ages else None,
                  startedUnixNs=str(now), finishedUnixNs=str(time.time_ns()))
    Path(output).write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'result': result['result'], 'opened': len(opened), 'errors': errors,
                      'admissionPassed': result.get('admissionControls', {}).get('passed'),
                      'regressionPassed': result.get('originalRegressionControls', {}).get('passed')}))
    return 0 if not errors else 1


if __name__ == '__main__':
    raise SystemExit(run(*sys.argv[1:]))
