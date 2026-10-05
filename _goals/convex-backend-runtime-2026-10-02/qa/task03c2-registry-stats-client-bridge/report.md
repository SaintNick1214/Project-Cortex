# Task03C2 optional statistics client bridge

Status: implemented, offline checks PASS, fresh independent review pending. Functional canonical statistics and full Task03/live acceptance remain pending.

The earlier six-file SDK maintenance bridge received fresh independent PASS4.4. Its six frozen files were hash-verified against its sources.json and copied under prior/ before this followup changed any file. Existing prior receipts remain historical evidence.

## Bounded behavior

- Register/get/update return the readable official registry row without requesting optional statistics. RegisteredAgent.stats remains optional and absent; no default counts/profile fields are invented. Register still performs its existing official-row graph sync; READ-less committed receipts still reject before all graph/stat poststeps outside resilience.
- Statistics are requested only by explicit export(includeStats:true). The query gets tenantId/memorySpaceId from each selected official agent row, with configured tenant mismatch rejection. Export without stats remains profile-only.
- MemorySpacesAPI.getStats now has an optional tenantId selector and resolves it against configured auth before any dispatch. No other memory-space method changed.
- Both explicit stats paths preserve an exact native ConvexError CAPABILITY_NOT_READY envelope through enabled resilience using a transport sentinel, then throw the original typed error outside resilience. Recognition requires native prototype/marker/name, static own data descriptors, exactly the five expected enumerable fields and values (version1, codeCAPABILITY_NOT_READY, messageAccess denied or invalid registry input, retryablefalse, outcomenot_dispatched), and a matching canonical wrapper message. Private extras, symbols, malformed/code-only envelopes, data/field getters, changed messages and descriptor/proxy failures are rejected. Native lazy stack is intentionally not read. No capability exception becomes fake statistics.
- Other exceptions retain existing resilience/infrastructure handling. The new classifier never invokes malformed getters; global ResilienceLayer's existing handling of rejected malformed error.data accessors remains outside this bounded predicate and was not changed or certified. Ordinary infrastructure-error propagation, no retries/mutations for explicit unready, circuit hooks and public serialized unready diagnostics are covered.

## Observed final checks

Actual root noEmit and lint-config noEmit PASS. Scoped ESLint --max-warnings0 PASS. npm12.2 ESM/CJS/DTS root build PASS. Standard packed ESM/CJS declarations/browser execution PASS. Two focused suites:76 passed,0 failed/skipped. Disabled Convex clients and an inert bootstrap URL were used; no network/service/model/cleanup/deploy operations occurred.

The original39 test outcomes remain present. Only six readable register/update positive cases changed their enrichment expectation: the complete original official profile and graph behavior remain asserted, while optional stats are absent and the unavailable-query mock receives zero calls. All other prior33 cases retain their original expectations. New tests add readable get/no implicit stats, explicit export/no-stats and unready/mismatch selectors, memory-space tenant/validation/unready behavior, infrastructure errors, hooks/serialized diagnostics, and static adverse envelope inspection. This is an authorized semantic change because backend cross-data stats now explicitly report CAPABILITY_NOT_READY until canonical source readiness; restoring implicit stats would incorrectly turn committed readable writes into apparent failures.

commands.json records six observed exit0 checks; raw/ holds logs and Jest outcomes; sources.json freezes the six followup-owned files. The helper is imported only by the two explicit stats paths and is not added to root public exports. Backend registry stats/policies/schema/auth/ResilienceLayer were not modified by this executor.
