# Task03C2-D manual governance client boundary

The original frozen03A inventory assigns `governance:enforce` the disposition
`internalize`. Reviewed03B2D implements it as an internal worker mutation. Its
current adapter records simulation audits with zero versions deleted, records
purged and bytes freed. Actual retention deletion is unimplemented.

The public SDK method retains its `EnforcementOptions` input and
`Promise<EnforcementResult>` declaration. It first runs the existing, unchanged
`validateEnforcementOptions`. Invalid requests retain their existing
`GovernanceValidationError`. Valid requests reject with the exported
`GovernanceCapabilityError`: `BACKEND_ENFORCEMENT_ONLY`, `retryable: false`,
`outcome: not_dispatched`, `requiredExecution: trusted_backend_worker`, and
`enforcementAdapter: SIMULATION`. The message identifies the required trusted
backend execution boundary and explains that automatic retention deletion is
unimplemented. It does not expose worker references, grant credentials, or
operator provisioning details.

`enforce` calls neither the transport nor the resilience layer. The obsolete
public mutation reference and its exclusive error conversion helper are removed.
Other governance methods, their validation, public function references, transport
and resilience behavior are unchanged. Backend visibility, schema, generated
bindings, other SDK areas, CLI/provider and existing integration/history sources
are outside this patch.

The class is exported from the governance module and re-exported from the root
SDK. It contains only an ordinary `Error` subclass and browser-safe literal
metadata. It introduces no Node dependency or backend/operator import.

Validation uses a disposable archive of reviewed commit
`a2c9827783e9dd49b9811a2899ba4acbeadc21cd` (including the independently reviewed
two-expression compiler fix), with only the client source, new test and local QA
files overlaid. No unreviewed main memory/fact/schema declarations are used as
accepted dependencies. No paid call, deployment, live backend operation or upstream
key provision is part of this closure.
