"""Static public carry recipe creation; no source body copying or effects."""
from pathlib import Path
from source_contract import Cohort, Ledger, SourceFailure, digest, durable_new, encoded, strict, OPERATION

ROOT = Path(__file__).resolve().parents[1]
E2 = ROOT.parent / 'task03-attempt6-actual-public-entry-compatibility-repair4/publication-epoch2'
DOCUMENTS = {
    'source-replacement-conservation.json': ('1670a9f4c686c7d9e39d802cb005c717dc22570480bdb45925cfb6d9e42acf8b', 74347),
    'closed-source-reference-manifest.json': ('4a6742666e34ca7d8d728738c7e5633f29b6b4bad3487f3f12b8d74ee20b7608', 117404),
    'preparation-report.md': ('9d09d7a8d5fad826df5cc15d45f2c357609cef72171baf3bd29ea6cade6df183', 2412),
    'final-held-source-close-receipt.json': ('51adfb198467f9655f40ce88bb86641bff9fb9e4f229df0071c42f9d71be4f75', 91422),
    'final-writer-stop.json': ('010423ee294f7758e6053c6e7dbd6f8a6d580ea8d750f7f55ec0df7c7acfcfed', 2994),
}


def prepare():
    ledger = Ledger()
    rows = [{'path': str(E2/name), 'sha256': pin[0], 'bytes': pin[1], 'kind': 'FRESH_DOCUMENT_ONLY'}
            for name, pin in DOCUMENTS.items()]
    cohort = Cohort(rows, ledger, owner=(501, 20), maturity_ns=240000000000)
    primary = None; bodies = {}
    try:
        cohort.open_all(); bodies = cohort.read_all()
        mf = strict(bodies[str(E2/'closed-source-reference-manifest.json')])
        proof = strict(bodies[str(E2/'source-replacement-conservation.json')])
        stop = strict(bodies[str(E2/'final-writer-stop.json')])
        assert len(mf['inputs']) == 135 and sum(row['bytes'] for row in mf['inputs']) == 2628874
        assert proof['unchangedOriginalCount'] == 130 and len(proof['unchangedOriginalRows']) == 130
        assert proof['original113Count'] == 113 and proof['original113Preserved'] is True
        assert proof['runtimeBytesChanged'] is False and proof['observerCommonBytesChanged'] is False
        assert stop['stickyFailureChain'] and stop['sourceEligibility'] is False
        originals = {row['path']: row for row in proof['unchangedOriginalRows']}
        carry = []
        for index, row in enumerate(mf['inputs']):
            original = originals.get(row['path'])
            if original:
                assert all(row[key] == original[key] for key in ('sha256', 'bytes', 'PRE9'))
            carry.append({'index': index, 'logicalMacPath': row['path'], 'actualMacPath': row['actualPath'],
                'bytes': row['bytes'], 'sha256': row['sha256'], 'historicalMacNine': row['PRE9'],
                'linuxPath': '/source-epoch/inputs/%04d.bin' % index,
                'original130': original is not None,
                'senderNinePolicy': 'EXACT_ORIGINAL_MAC_NINE' if original else 'DISTINCT_ROOT_PROSPECTIVE_SENDER_NINE'})
        assert sum(row['original130'] for row in carry) == 130
        # Preserve all prior admissions. These are declared historical charges,
        # not a claim that old failed descriptors remain held or were reopened.
        prior = list(mf['inputs']) + proof['oldTwoRejectedNonoperativePreimageRows']
        assert len(prior) == 137 and sum(row['bytes'] for row in prior) == 2646825
        result = {'scope': 'TASK03_U4_135_PUBLIC_CARRY_RECIPE_ONLY', 'operation': OPERATION,
            'members': carry, 'memberCount': 135, 'memberBytes': 2628874,
            'originalMac130': proof['unchangedOriginalRows'], 'originalMac113Count': 113,
            'originalMac113Preserved': True, 'activeRuntimeSources': mf['activeRuntimeSources'],
            'sourceDocuments': rows, 'historicalPriorAdmissions': prior,
            'oldE2Interval': 'FAILED_UNKNOWN_CTIME_ACTOR', 'oldE2CustodyRepaired': False,
            'linuxPhysicalNine': 'CAPTURE_PROSPECTIVELY_ONLY_AFTER_STOP_AND_60S',
            'macGatesReplaced': False, 'sourceEligibility': False, 'runtimeAuthority': False,
            'futureMacEntryInterpreterChecks': 'INDEPENDENT_MAC_3_9_AND_3_14_REQUIRED',
            'futureMacOriginal97Portable28Wiring16HighFD9Required': True}
    except BaseException as error:
        primary = error
    receipt = cohort.final_and_close(primary)
    durable_new(ROOT/'carry-map-document-acquisition1.json', encoded(receipt))
    if receipt['closeErrors']:
        raise SourceFailure(receipt['closeErrors'])
    raw = encoded(result)
    durable_new(ROOT/'source-carry-manifest.json', raw)
    return {'bytes': len(raw), 'sha256': digest(raw), 'members': 135, 'effects': 0,
            'sourceEligibility': False, 'runtimeAuthority': False}


if __name__ == '__main__':
    print(encoded(prepare()).decode(), end='')
