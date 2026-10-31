"""Declared original113 subset validation, not a new113 filesystem acceptance."""
import types
from pathlib import Path
import source_contract as C

ROOT = Path(__file__).resolve().parents[1]
U4 = ROOT.parent/'task03-attempt6-actual-public-entry-compatibility-repair4'


def prepare():
    ledger = C.Ledger()
    headers = C.Cohort([
        {'path': str(ROOT/'source-carry-manifest.json'), 'bytes': 304101,
         'sha256': '6ac78014272c41ec7038cf4ed3f565d2a8d5708602bc0a4ea74d7e9c08fcbe97'},
        {'path': str(U4/'source-run1-receipt.json'), 'bytes': 227982,
         'sha256': '79d4f5f1a04f972ad3282b781a4f5e93dfac13c0927ba207f6c6aed395bbf685',
         'expectedNine': {'ctime_ns': '1791401615454145092', 'dev': '16777234', 'gid': '20', 'ino': '92901491',
            'mode': '33152', 'mtime_ns': '1791401494940865123', 'nlink': '1', 'size': '227982', 'uid': '501'}}],
        ledger, owner=(501, 20), maturity_ns=240000000000)
    whole = None; error = None; result = None
    try:
        headers.open_all(); bodies = headers.read_all()
        carry = C.strict(bodies[str(ROOT/'source-carry-manifest.json')])
        source_row = next(row for row in carry['members'] if row['actualMacPath'] == str(U4/'source-inputs-plan.json'))
        rows = list(headers.rows)+[{'path': source_row['actualMacPath'], 'bytes': source_row['bytes'],
            'sha256': source_row['sha256'], 'expectedNine': source_row['historicalMacNine']}]
        whole = C.Cohort(rows, ledger, owner=(501, 20), maturity_ns=240000000000)
        whole.open_all(); data = whole.read_all()
        receipt = C.strict(data[str(U4/'source-run1-receipt.json')])
        plan = C.strict(data[str(U4/'source-inputs-plan.json')])
        module = {'C': C, '__name__': 'source_preparation_only'}
        # This author-only definition load is not source eligibility. Actual
        # fixture entry uses the independently reviewed held-source bootstrap.
        text = (ROOT/'adapter/lineage_validator.py').read_bytes()
        exec(compile(text, str(ROOT/'adapter/lineage_validator.py'), 'exec', dont_inherit=True), module)
        result = module['original113'](carry, receipt, plan)
        result['receiptSource'] = rows[1]
        result['planSource'] = rows[2]
        result['carrySha256'] = C.digest(C.encoded(carry))
    except BaseException as failure:
        error = failure
    checks = []
    if whole:
        checks.append(whole.final_and_close(error))
    checks.append(headers.final_and_close(error))
    failures = [value for check in checks for value in check['closeErrors']]
    C.durable_new(ROOT/'original113-proof-document-acquisition1.json', C.encoded({'intervals': checks,
        'oneLedger': ledger.snapshot(), 'sourceCodeAccepted': False, 'effects': 0}))
    if failures:
        raise C.SourceFailure(failures)
    C.durable_new(ROOT/'original113-subset-proof.json', C.encoded(result))
    return {'scope': 'DECLARED_113_SUBSET_ONLY_SOURCE_PREPARATION', 'matched': 113,
            'sourceEligibility': False, 'effects': 0}


if __name__ == '__main__':
    print(C.encoded(prepare()).decode(), end='')
