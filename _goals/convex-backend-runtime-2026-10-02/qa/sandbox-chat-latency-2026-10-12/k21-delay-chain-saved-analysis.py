"""Bounded saved-only K21 analysis. No service, model, or repository writes."""
import datetime
import hashlib
import json
from pathlib import Path

Q = Path(__file__).resolve().parent
SNAPSHOT = 'service-log-snapshot-k21-cli-post-pair-1791977411449.json'
CHAINS = [
    ('browser-first', 'k21-run-chain-adbf43990b15-1791977198614.json'),
    ('browser-warm', 'k21-run-chain-f8e28f17b947-1791977203761.json'),
    ('cli-first', 'k21-run-chain-5d99aef64116-1791977208716.json'),
    ('cli-warm', 'k21-run-chain-d1e1e5ca8ac4-1791977213710.json'),
]

def read(name):
    return json.loads((Q / name).read_text())

def digest(name):
    p = Q / name
    return {'path': name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes': p.stat().st_size}

def decoded_logs(name):
    return [json.loads(e['message']) for e in read(name)]

snapshot = read(SNAPSHOT)
executions = [e for e in snapshot['executions'] if e.get('identifier')]
phases = snapshot['phases']
cli = read('k21-cli-pure-timing.json')
browser = decoded_logs('browser/k21-browser-pair-logs.json')
client = decoded_logs('browser/k21-client-pair-logs.json')
previous = read('k20-whole-path-delay-diagnosis.json')

def scalar_node(e):
    return {
        'function': e['identifier'], 'component': e.get('componentPath'),
        'requestId': e.get('requestId'), 'executionId': e.get('executionId'),
        'invocationTimestampMs': e.get('executionTimestamp', 0) * 1000,
        'completionLogTimestampMs': e.get('timestamp', 0) * 1000,
        'engineMs': e.get('executionTime', 0) * 1000,
        'ownUserMs': e.get('userExecutionTime', 0) * 1000,
        'readDocuments': e.get('usage', {}).get('databaseReadDocuments'),
        'writeDocuments': e.get('usage', {}).get('databaseWriteDocuments'),
        'cachedResult': e.get('cachedResult'), 'errorPresent': e.get('errorPresent'),
        'willRetry': e.get('willRetry'), 'occRetryCount': e.get('occRetryCount'),
        'occInfo': e.get('occInfo'),
    }

SELECTED = {
    'runtimeClient:submitAndStartEnvelope', 'runtimeAgent:prepareDirectTurnV8',
    'runtimeAgent:contextInputsV8', 'runtimeAgentQueryEmbedding:prepare',
    'runtimeAgentQueryEmbedding:admit', 'runtimeAgentRecall:prepareReads',
    'runtimeAgentRecall:readMatches', 'runtimeMemory:finalDelivery',
    'runtimeAgent:saveAndPrepareContextV8', 'runtimeAgent:hydrateExecution',
    'runtimeAgent:admitPreparedModelOperation', 'runtimeModelPolicy:markVisible',
    'runtimeModelPolicy:captureTerminalEvidence', 'runtimeModelPolicy:attachTerminalResult',
    'runtimeAgent:recordOutput', 'runtimeAgent:finalize',
}

samples = []
for label, name in CHAINS:
    chain = read(name)
    run = chain['run']['runId']
    budget = chain['runBudgetId']
    created = chain['run']['createdAt']
    rp = [p for p in phases if p.get('runId') == run]
    gp = [p for p in phases if p.get('runId') == budget]

    def phase(name, op=None):
        rows = gp if op else rp
        found = [p for p in rows if p['phase'] == name and (op is None or p.get('operationKey') == op)]
        return min(found, key=lambda p: p['at']) if found else None

    def at(name, op=None):
        p = phase(name, op)
        return p['at'] if p else None

    def span(a, b, op=None):
        x, y = at(a, op), at(b, op)
        return y - x if x is not None and y is not None else None

    entry = phase('direct.prepare.begin')
    action_id = entry['executionId']
    action = next(e for e in executions if e.get('executionId') == action_id)
    admission_id = phase('admission.start.begin')['executionId']
    admission = next(e for e in executions if e.get('executionId') == admission_id)
    reqs = {action['requestId'], admission['requestId']}
    native = [e for e in executions if e.get('requestId') in reqs]
    prospective = {
        p['phase']: p['durationMs'] for p in phases
        if p.get('executionId') == admission_id and p.get('durationMs') is not None
    }
    first_output = next(row for row in chain['stages']['durable'] if row.get('nonemptyText'))
    output_execution = next(e for e in native if e['identifier'] == 'runtimeAgent:recordOutput'
                            and round(e['executionTimestamp'] * 1000) == first_output['createdAt'])
    first_output_completion = output_execution['timestamp'] * 1000
    prepare_end = at('turn.prepare.end') or at('direct.prepare.end')
    first_text = at('gateway.native.stream.first-text', 'agent.respond')
    visibility_end = at('gateway.ledger.visibility.end', 'agent.respond')
    checkpoints = [
        ('run-created', created), ('direct-prepare-begin', at('direct.prepare.begin')),
        ('direct-prepare-end', at('direct.prepare.end')),
    ]
    if at('context.recall.begin') is not None:
        checkpoints += [
            ('recall-begin', at('context.recall.begin')),
            ('query-embedding-begin', at('gateway.native.embed.begin', 'embedding.query')),
            ('query-embedding-ready', at('gateway.native.embed.ready', 'embedding.query')),
            ('recall-end', at('context.recall.end')), ('turn-prepare-end', prepare_end),
        ]
    checkpoints += [
        ('main-admission-begin', at('gateway.ledger.admit-checkpoint.begin', 'agent.respond')),
        ('main-stream-dispatch', at('gateway.native.stream.begin', 'agent.respond')),
        ('main-first-text', first_text), ('first-visibility-end', visibility_end),
        ('first-output-mutation-stamp', first_output['createdAt']),
    ]
    assert all(t is not None for _, t in checkpoints), label
    assert all(a[1] <= b[1] for a, b in zip(checkpoints, checkpoints[1:])), label
    segments = [{'from': a[0], 'to': b[0], 'durationMs': b[1] - a[1]}
                for a, b in zip(checkpoints, checkpoints[1:])]
    assert sum(s['durationMs'] for s in segments) == first_output['createdAt'] - created
    bh = hashlib.sha256(budget.encode()).hexdigest()
    bounds = [b for b in snapshot['modelBounds']
              if b.get('runBudgetIdHash') == bh and b.get('identifier') == 'runtimeAgent:executeDirectV8'
              and b.get('stage') == 'native']
    assert len(bounds) == 1, label

    if label.startswith('browser'):
        events = [e for e in browser if e.get('runId') == run]
        timing = {e['phase']: e['elapsedMs'] for e in events}
        admission_done = timing['admission.delivered']
        visible = timing['first-text.after-paint']
        # Find the envelope RPC preceding this sample's corresponding post-session RPC.
        pos = 0 if label == 'browser-first' else 1
        env = [e for e in client if e['phase'] == 'rpc.end'
               and e.get('method') == 'runtimeClient:submitAndStartEnvelope'][pos]
        after = next(e for e in client if e['phase'] == 'rpc.end' and e.get('rpcId') == env['rpcId'] + 1)
        prefix = {'auth': 'Completed during Connect before sample; excluded from chat latency',
                  'envelopeRpcMs': env['durationMs'], 'freshPostSessionRpcMs': after['durationMs'],
                  'admissionDeliveredMs': admission_done, 'browserMarkersMs': timing}
    else:
        command_id = 1 if label == 'cli-first' else 2
        start_idx = next(i for i, e in enumerate(cli['events'])
                         if e.get('phase') == 'submit.begin' and e.get('commandId') == command_id)
        end_idx = next(i for i, e in enumerate(cli['events'][start_idx:], start_idx)
                       if e.get('phase') == 'answer.first_printed' and e.get('commandId') == command_id)
        ev = cli['events'][start_idx:end_idx + 1]
        auth_begin = next(e['atMs'] for e in ev if e['phase'] == 'auth.begin')
        auth_ready = next(e['atMs'] for e in ev if e['phase'] == 'auth.ready')
        rpc = [e for e in ev if e['phase'] == 'rpc.end']
        assert [e.get('method') for e in rpc[:3]] == [
            'runtimeClient:session', 'runtimeClient:submitAndStartEnvelope', 'runtimeClient:session']
        prefix = {'authMs': auth_ready - auth_begin, 'freshPreSessionRpcMs': rpc[0]['durationMs'],
                  'envelopeRpcMs': rpc[1]['durationMs'], 'freshPostSessionRpcMs': rpc[2]['durationMs'],
                  'submissionToFreshAdmissionReturnMs': rpc[2]['atMs'] - ev[0]['atMs'],
                  'admissionCallbackMarker': 'Unavailable; return boundary from retained rpc.end'}
        visible = ev[-1]['durationMs']

    recall = None
    if at('context.recall.begin') is not None:
        recall = {
            'totalMs': span('context.recall.begin', 'context.recall.end'),
            'beforeEmbeddingMs': at('gateway.native.embed.begin', 'embedding.query') - at('context.recall.begin'),
            'embeddingAcquisitionMs': span('gateway.native.embed.begin', 'gateway.native.embed.ready', 'embedding.query'),
            'afterEmbeddingMs': at('context.recall.end') - at('gateway.native.embed.ready', 'embedding.query'),
            'embeddingAdmitCheckpointMs': span('gateway.ledger.admit-checkpoint.begin', 'gateway.ledger.admit-checkpoint.end', 'embedding.query'),
            'embeddingCaptureMs': span('gateway.ledger.capture.begin', 'gateway.ledger.capture.end', 'embedding.query'),
            'embeddingAttachMs': span('gateway.ledger.attach.begin', 'gateway.ledger.attach.end', 'embedding.query'),
            'scope': 'Private Agent recall only; not public runtimeSDK.recall or legacy memory.recall',
        }
        assert recall['totalMs'] == recall['beforeEmbeddingMs'] + recall['embeddingAcquisitionMs'] + recall['afterEmbeddingMs']
    samples.append({
        'label': label, 'runId': run, 'runBudgetId': budget, 'createdAt': created,
        'responseStatus': chain['run']['responseStatus'], 'executionMode': chain['execution']['executionMode'],
        'ordinaryTurnJournalCount': chain['orchestration']['ordinaryTurnJournalCount'],
        'submissionToVisibleMs': visible, 'under1000Ms': visible < 1000,
        'clientPrefix': prefix, 'admissionMutationSpansMs': prospective,
        'admissionClaimSpanIsIncludedInStartSpan': True,
        'createdToMainDispatchMs': at('gateway.native.stream.begin', 'agent.respond') - created,
        'directPrepareMs': span('direct.prepare.begin', 'direct.prepare.end'),
        'wholeActionPrepareMs': prepare_end - at('direct.prepare.begin'),
        'gatewayMainDispatchToProcessedFirstTextMs': span('gateway.native.stream.begin', 'gateway.native.stream.first-text', 'agent.respond'),
        'firstVisibilityMs': span('gateway.ledger.visibility.begin', 'gateway.ledger.visibility.end', 'agent.respond'),
        'firstTextToFirstOutputMutationStampMs': first_output['createdAt'] - first_text,
        'firstOutputNativeEngineMs': output_execution['executionTime'] * 1000,
        'createdToFirstOutputNativeCompletionLogMs': first_output_completion - created,
        'disjointActionClockChain': segments,
        'chainEndsAtFixedMutationStampNotCommitVisibility': True,
        'recall': recall,
        'currentSelectedMessageCount': None, 'currentSelectedMemoryFactPendingCounts': None,
        'assembledContextBytes': None,
        'selectionUnavailabilityReason': 'Not retained by original scalar trace/model-bound projections',
        'qualifiedMainBounds': {k: bounds[0][k] for k in ['dimensions', 'limits', 'exceeded']},
        'requestIds': sorted(reqs),
        'nativeAdmissionToPrepareClock': {
            'createdToAdmissionCompletionLogMs': admission['timestamp'] * 1000 - created,
            'admissionCompletionLogToActionExecutionTimestampMs': action['executionTimestamp'] * 1000 - admission['timestamp'] * 1000,
            'actionExecutionTimestampToDirectPrepareBeginMs': at('direct.prepare.begin') - action['executionTimestamp'] * 1000,
            'note': 'Native timestamps only; the middle interval does not isolate pure scheduler overhead',
        },
        'selectedNativeNodes': [scalar_node(e) for e in native if e['identifier'] in SELECTED],
        'recordedConflicts': [scalar_node(e) for e in native if e.get('willRetry') or e.get('occInfo')],
        'largestRetainedOfficialComponentChildren': [scalar_node(e) for e in sorted(
            [e for e in native if e.get('componentPath')], key=lambda e: e['executionTime'], reverse=True)[:5]],
        'rawChain': digest(name),
    })

expected_roots = [
    'runtimeAgent:executeDirectV8', 'runtimeAgent:prepareDirectTurnV8',
    'runtimeClient:submitAndStartEnvelope', 'runtimeAgent:admitPreparedModelOperation',
    'runtimeAgentRecall:prepareReads', 'runtimeAgentRecall:readMatches',
    'runtimeAgentQueryEmbedding:prepare', 'runtimeAgentQueryEmbedding:admit',
    'runtimeAgent:saveAndPrepareContextV8', 'runtimeAgent:contextSourceBatch', 'runtimeAgent:contextSource',
    'runtimeAgent:prepareTurnModelV8', 'runtimeAgent:prepareResolvedModelCandidateV8',
]
packet = {
    'kind': 'Saved-only native diagnosis; no new functional, source, or SLO acceptance',
    'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'repository': 'SaintNick1214/Project-Cortex',
    'sourceCommit': '03256989da22bde35dff78023c1c3962391a68c6',
    'target': {'sessionId': '2d6e9566-0948-4dd7-8df5-5d7626598a60', 'name': 'next-turtle-281', 'id': 6164369},
    'samples': samples,
    'slo': {'targetMs': 1000, 'pass': 0, 'fail': 4, 'completeReplies': 4, 'paidRetry': 0, 'cliDeadlineMs': 30000},
    'collection': {'runChainInvocations': 4, 'oneOfficialLogGet': 1, 'retry': 0,
                   'allBClientsClosed': True, 'mutations': 0, 'paidCalls': 0},
    'nativeRootCompletionCounts': {n: sum(e['identifier'] == n for e in executions) for n in expected_roots},
    'rootCountCaveat': 'Bounded snapshot counts, not proof of endpoint absence; inline helpers have no separate outer completion',
    'snapshot': {'phaseCount': len(phases), 'executionProjectionCount': len(snapshot['executions']),
                 'executionCap': 1000, 'capReached': len(snapshot['executions']) == 1000,
                 'responseByteCount': snapshot['byteCount'], 'logGetDeadlineMs': 30000,
                 'byteCap': 16777216, 'perTablePageCap': 256,
                 'errorLeafReason': 'Unavailable; original projection retained errorPresent only'},
    'previousK20': [{k: row[k] for k in ['label', 'submissionToVisibleMs', 'createdToAnswerDispatchMs',
                                         'nativeDispatchToProcessedTextMs', 'firstVisibilityMs', 'mainInputTokens']}
                    for row in previous['samples']],
    'comparisonCaveat': 'Different disposable source, data, auth lifecycle and concurrent jobs; no causal speedup or historical 0.35/0.37 ratio',
    'clockLimits': [
        'Browser/CLI monotonic durations are separate from server epoch phases; do not subtract them.',
        'Date.now is fixed in queries/mutations; native durationMs is the opt-in performance.now measurement.',
        'Parent native engine durations may include children; own-user duration and child engine are not additive.',
        'Output row createdAt identifies mutation snapshot start, not physical commit or client-visible time.',
        'Gateway dispatch-to-first-text includes Gateway/network/provider acquisition; component TTFB and provider-only time are unavailable.',
        'Watcher wakes do not prove concurrent observer acquisition; response content was not retained to identify which observer delivered first text.',
        'Selected input counts/bytes are unavailable; inputTokens is the qualified conservative request dimension, not provider-reported token usage.',
        'Titles and post-first-text capture/attachment/finalization do not add to first-text latency merely because they share a budget or request.',
    ],
    'inputs': [digest(n) for n in [SNAPSHOT, 'browser/k21-pair-outcome.json', 'browser/k21-client-pair-logs.json',
                                 'browser/k21-browser-pair-logs.json', 'k21-cli-pure-timing.json',
                                 'k20-whole-path-delay-diagnosis.json', 'k21-run-chain-collector-exits.json',
                                 'k21-memory-native-v2-four-run-verification-1791977137881.json',
                                 'k21-auth-http-readonly-1791977130467.json']],
    'diagnosisPercent': 100, 'overallLatencyFollowupPercent': 50, 'nativeSLOAccepted': False, 'fullGoalAccepted': False,
}
(Q / 'k21-whole-path-delay-diagnosis.json').write_text(json.dumps(packet, indent=2) + '\n')
print(json.dumps({'status': 'SAVED_ANALYSIS_COMPLETE', 'samples': 4,
                  'report': 'k21-whole-path-delay-diagnosis.json',
                  'sha256': hashlib.sha256((Q / 'k21-whole-path-delay-diagnosis.json').read_bytes()).hexdigest()}))
