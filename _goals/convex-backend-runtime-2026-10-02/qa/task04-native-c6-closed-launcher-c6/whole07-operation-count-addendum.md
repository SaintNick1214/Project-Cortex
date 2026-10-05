The existing `whole07-timing-analysis.json` records the special historical full-closure unique-row difference as 3. That is an inventory difference, not a count of additional physical read operations.

The captured extension guard at lines 31–34 first reads every row of `previous` (80 for the special packet), then independently reads every row of `complete` (83) when the objects differ. The second loop includes 80 repeated paths and 3 new paths. Each is a separate fresh read; none may reuse an earlier parent, child, body or earlier-loop capture.

For the exact six-line whole body, the declared historical data-row baseline is `2 × (65585 + 59460 + 64054) = 378198`. Six preservation calls add `6 × 83 = 498` second-loop operations, yielding 378696 historical data-row read operations. This excludes packet-manifest reads (214), six full-index reads, current packet/metadata reads, filesystem membership checks, final outputs and delivery. It is a source-defined operation count, not observed completion or a timing lower bound.

Whole07 actually completed 2583 historical body consumption events before termination. All captured versions matched their audited declarations. The first preservation remained incomplete. The observed timeout establishes failure of this implementation/run under 120 seconds; it does not prove that every equivalent implementation must fail.

This addendum preserves the original analysis unchanged. Its held source pin/backing for the guard contains both exact loops and the original assertions.
