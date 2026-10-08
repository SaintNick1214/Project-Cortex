"""A Linux artifact is lineage DATA; it cannot enable a Mac runtime source gate."""


def original113(carry, receipt, plan):
    rows = receipt['sourceRows']
    if len(rows) != 113 or len(receipt['allFinalChecks']) != 113 or len(receipt['allCloseCalls']) != 113:
        raise ValueError('EXACT_ORIGINAL_113_RECEIPT')
    if receipt['closeErrors'] or receipt['primaryFailure'] is not None:
        raise ValueError('ORIGINAL_113_RECEIPT_FAILURE')
    original = {row['logicalMacPath']: row for row in carry['members'] if row['original130']}
    if len(original) != 130 or len({row['path'] for row in rows}) != 113:
        raise ValueError('EXACT_130_AND_UNIQUE_113')
    indices = []
    final = {row['path']: row for row in receipt['allFinalChecks']}
    closes = {row['path']: row for row in receipt['allCloseCalls']}
    for row in rows:
        current = original[row['path']]
        if (row['actualPath'], row['sha256'], row['bytes'], row['PRE9']) != (
                current['actualMacPath'], current['sha256'], current['bytes'], current['historicalMacNine']):
            raise ValueError('ORIGINAL_113_EXACT_ROW_DIGEST_NINE')
        check = final[row['path']]
        if row['fullEOF'] is not True or row['closeAttempted'] is not True or check['fullEOF'] is not True or check['exact'] is not True:
            raise ValueError('ORIGINAL_113_EOF_FINAL_CLOSE')
        if check['before9'] != row['PRE9'] or check['after9'] != row['PRE9'] or check['pathAfter9'] != row['PRE9']:
            raise ValueError('ORIGINAL_113_FINAL_NINE')
        if closes[row['path']]['attempt'] != 1 or closes[row['path']]['error'] is not None:
            raise ValueError('ORIGINAL_113_ONCE_CLOSE')
        indices.append(current['index'])
    declared = plan['byReference'] + plan['ownInputs']
    names = [row['path'] if type(row) is dict else row for row in declared]
    if len(names) != 113 or set(names) != set(original[row['path']]['actualMacPath'] for row in rows):
        # The published plan's logical aliases must be compared explicitly by
        # the caller if they differ; no inferred normalization is accepted.
        if len(names) != 113 or set(names) != {row['path'] for row in rows}:
            raise ValueError('ORIGINAL_113_DECLARED_MANIFEST_SUBSET')
    return {'scope': 'ORIGINAL_113_DECLARED_ROW_CONSERVATION_ONLY', 'indices': indices,
        'rowDigest': C.digest(C.encoded(rows)), 'original113PhysicalIntervalAdopted': False,
        'sourceEligibility': False, 'macPhysicalGateStillRequired': True}


def validate_artifact(carry, wire, linux, sender, original_proof):
    if carry['scope'] != 'TASK03_U4_135_PUBLIC_CARRY_RECIPE_ONLY' or len(carry['members']) != 135:
        raise ValueError('CARRY_135_SCOPE')
    if original_proof['scope'] != 'ORIGINAL_113_DECLARED_ROW_CONSERVATION_ONLY' or len(set(original_proof['indices'])) != 113:
        raise ValueError('DECLARED_113_PROOF_REQUIRED')
    if linux['scope'] != 'NEW_LINUX_135_SOURCE_PHYSICAL_EPOCH_ONLY' or linux['kernel'] != 'linux':
        raise ValueError('ACTUAL_NEW_LINUX_SOURCE_ARTIFACT_REQUIRED')
    if linux['operation'] != C.OPERATION or linux['wireSha256'] != C.digest(C.encoded(wire)):
        raise ValueError('CURRENT_OPERATION_AND_WIRE_DIGEST')
    if linux['macCarrySha256'] != C.digest(C.encoded(carry)) or sender['macCarrySha256'] != linux['macCarrySha256']:
        raise ValueError('FULL_MAC_CARRY_MANIFEST_BINDING')
    if any(linux[key] is not False for key in ('oldMacCustodyRepaired', 'macSourceGatesReplaced', 'sourceEligibility', 'runtimeAuthority', 'fullTask03', 'fullGoal')):
        raise ValueError('LINUX_LINEAGE_CANNOT_GRANT_MAC_RUNTIME')
    close = linux['physicalSourceCohort']
    physical = {row['path']: row for row in close['members']}
    sent = {row['index']: row for row in sender['members']}
    if close['closeErrors'] or len(close['closeAttempts']) != len(close['members']) or close['allFDsBeforeBodies'] is not True:
        raise ValueError('ALL_NEW_LINUX_SOURCE_CLOSES_REQUIRED')
    if len(sent) != 135 or set(sent) != set(range(135)):
        raise ValueError('COMPLETE_ACTUAL_MAC_SENDER_COHORT')
    for row in carry['members']:
        actual = physical[row['linuxPath']]; mac = sent[row['index']]
        if (actual['bytes'], actual['sha256']) != (row['bytes'], row['sha256']):
            raise ValueError('LINUX_COPIED_BODY_CHANGED')
        if (mac['bytes'], mac['sha256']) != (row['bytes'], row['sha256']):
            raise ValueError('ACTUAL_MAC_SENDER_BODY_CHANGED')
        for observed in (actual, mac):
            pin = observed['PRE9']; C.valid_nine(pin)
            if observed['fullEOF'] is not True or any(observed[key] != pin for key in ('OPEN9', 'POST9', 'FINAL9')):
                raise ValueError('ACTUAL_FULL_EOF_ALL_NINE_REQUIRED')
        if actual['PRE9']['uid'] != '0' or actual['PRE9']['gid'] != '0' or actual['PRE9']['nlink'] != '1':
            raise ValueError('NEW_LINUX_ACTUAL_OWNER')
        if mac['PRE9']['uid'] != '501' or mac['PRE9']['gid'] != '20' or mac['PRE9']['nlink'] != '1':
            raise ValueError('ACTUAL_MAC_SOURCE_OWNER')
        if row['original130'] and mac['PRE9'] != row['historicalMacNine']:
            raise ValueError('ORIGINAL_MAC_130_PIN_CHANGED')
        if actual['PRE9'] == row['historicalMacNine']:
            raise ValueError('HISTORICAL_MAC_NINE_PROJECTED_ON_LINUX')
    return {'scope': 'LINUX_ARTIFACT_LINEAGE_ONLY_NOT_MAC_SOURCE_GATE', 'members': 135,
        'original130': 130, 'original113': 113, 'macEntry97Portable28Wiring16HighFD9Required': True,
        'macGAndB3AndRootSourceOwnerStillRequired': True, 'sourceEligibility': False,
        'runtimeAuthority': False, 'fullTask03': False, 'fullGoal': False}
