The installed-host Gateway compiler mismatch is repaired in types only. `languageParams` and `nativeLanguage` now return `Omit<LanguageModelV4CallOptions, "reasoning">`, reflecting the freshly constructed native envelope. Their original input type and every runtime guard/expression remain unchanged. There are no casts, dependency/lock changes, or disabled typechecks.

Before/after emitted JavaScript is exactly equal: 56,952 bytes, SHA256 `db59ac80d01fac8af7dd724bd4df896bf41dfda3a847d44ee983732a3a447b7c` (TypeScript 6.0.3, ES2021/ESNext). This preserves the runtime qualification, cost, auth and delivery behavior.

Three selected current Gateway/memory suites passed **260/260** with no skips. Two new conditions submit the newer provider's `reasoning: "max"` value through generate and stream paths; both deny before admission, checkpoint, token mint, native effects, terminal evidence or private attachment, and explicitly finish owned lifecycles. Root and backend typechecks, scoped lint, whitespace check and default backend rebuild passed under Node 24.15.0. The first service-config Jest invocation exited before test results; its untouched empty streams and exit are preserved separately. The offline rerun only removes service setup while retaining the normal transform.

The rebuilt 61-file manifest is 18,313 bytes, SHA256 `5803f6aa2eebf0fda6f373760503330fbeecea269151bed5786831a4ee6d1990`. Distribution writers are stopped and released to the actual executor. The installed provider-version compiler red remains preserved; the corrected packed host must still pass enabled typecheck and live checks in the same verified disposable fixture. This author report does not grant Task06 acceptance.

Exact commands, source hashes and raw receipts are in `report1.json`.
