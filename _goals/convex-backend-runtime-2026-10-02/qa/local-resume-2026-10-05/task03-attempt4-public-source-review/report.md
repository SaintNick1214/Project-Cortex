# Judgment: Task03 attempt4 public coordinator first-use sources

## Verdict: REJECT

Sources reviewed and retained byte-for-byte: common `46a02cf65d5e4e58e94a9c86d69130f5b0b0a9e6483b6acdd76f1b394de1ef9d`, public transfer `dbd8da0ae40f4023849628276081f2c76e939173b4d26864d84063ee4454fcbe`, public coordinator `e9c6776a102683f0d0284d655bb19372d0b0d8844eed231f0ca03f0867df6090`; parent controls `6dbeddc08877c5affbc7550c91ae188a3ed85a09861ea42041dd02d682371ad1`. No evolving private coordinator was reviewed or executed.

## Evidence review

Fresh independent rerun of the original nine actual HOST child/pipe outcomes plus four invalid-bound controls passed, with only review output placement adapted. They check262144 per stream,327692 input,12s stdin deadline, finite command deadlines, stdout/stderr overflow, partial output, nonzero exit, spawn failure and progress rejection. They do not cover a live descendant after its direct parent exits.

`owned-descendant-probe.py` then exercised two new actual owned host process groups against the exact common source. Both parent children exited0 while one same-group descendant stayed alive. In the closed-descendant-pipe case the function returned `terminal:true`, exit0 and `failureClass:null` despite the live descendant. In the open-descendant-pipe case it timed out, returned `terminal:true`, and left the descendant alive. Exact function receipts, public stdout IDs, before/after `ps` output and `owned-descendant-observations.json` retain actual observed groups. The judge killed only each exact owned group and verified both descendant and process-group absence; no residual test processes remain.

## Requirements review

| Requirement | Met? | Evidence |
|---|---|---|
| Exact parent source pins and separate ownership | Yes | Initial/final all-nine/full-byte source bindings and retained `.text` preimages; private evolving coordinator excluded |
| Bounded streams/input/deadlines and durable fixed receipts | Yes, bounded source controls | Fresh9+4 pass, exact existing limit assertions conserved; outputs/receipts exclusive0600 and fsync parent |
| Owned child-group terminality and resource reconciliation on success/failure | **No** | Two actual owned descendant cases; common source112–117 kills the group only while direct child is alive, source133 considers only the direct child terminal |
| Root has only empty owned volume and no host-private/source/export/ancestor bind | Yes, recipe source only | Public init's singlevolume/no-source-mount assertion, independently checked immutable Linuxamd64/networknone/read-only/512MiB+swap512MiB/501:20 copy recipe; no Docker was run by this judge |
| Public copy exact1345 candidate count and private/native/receipts initialized empty | Present in source, actual custody not certified | Public helper freezes1338 + freeze + review + five generated baselines, current generated pins and initial empty owned tree; actual public copying was not dispatched and remains a separate custody review |
| No real target/private bytes/services/CLI/native acceptance | Yes | Actual Docker/service/credential/CLI/native calls0; own tests contain only fixed public dummy data |

## Critical issue

`task03-attempt4-coordinate-common.py:112` skips `killpg` when the direct child has exited. `:133` reports terminality solely from that child. A descendant can retain resources, inherited pipes or sensitive future source descriptors after this receipt, including a false successful return when it closes stdout/stderr. Finite output and timeout controls cannot prove all owned child groups terminal.

Retain the rejected original and its probes. In a new bounded repair, establish owned group identity at spawn, observe/reconcile descendants and prove group absence before successful terminal status, including when the direct parent exited first. Failure and unknown state must remain sticky and prevent subsequent custody/management dispatch; do not blindly kill unknown foreign groups. Add both exited-parent descendant variants as meaningful success/failure regressions and obtain fresh independent judgment. Do not use this common source for public or private release while rejected.

## Dimension scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 2 | Explicit owned process-group terminality/resource gate fails |
| Code Quality | 2 | Direct-child-only cleanup leaks live descendants on two branches |
| Test Quality | 3 | Original9+4 have meaningful outcomes but omit live descendants after parent exit |
| Pattern Adherence | 5 | Source pins, no weakening, independent public-only proofs and exact owned cleanup preserved |
| Completeness | 2 | Shared run implementation cannot release a process-group terminal receipt safely |

Average: 2.8/5. Preparation schema REJECT and separate management helper source PASS remain distinct. Actual public/private custody, key/JWKS/env/current-target binding, CLI/native foundation and full original Task03/goal remain OPEN. No enabling attestation was written.
