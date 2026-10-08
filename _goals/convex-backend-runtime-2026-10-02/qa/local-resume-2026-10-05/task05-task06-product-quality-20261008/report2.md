# Task05/Task06 affected product quality

PASS under Node24.15.0/npm12.2.0. Root lint/typecheck, CJS/ESM/declaration build and packed/browser public contracts passed; the build generated the current additive backend bundle. This is offline quality, not Task06 live installation or Task07 model execution.

The selected product-source hashes in report2.json were unchanged during these checks. Author later fixed fixture-only lint warnings and has its own scoped final lint/type receipts.

The first ordinary lint command failed because eslint traversed temporary qualification copies in .codex/ that are outside the TypeScript project: 405 parsing errors and no other errors. The unchanged product check used the previously qualified `.codex/**` exclusion. The original report1/raw failure is retained; diagnosis2 corrects an initial warning-message parser count without changing raw results; no product assertion or registered endpoint was excluded.

See per-command JSON, stdout and stderr for exact commands, cwd, elapsed duration, exit and child closure. Required checks were all executed. Task05 acceptance remains the separate single non-author coherent source/test/live judgment; Task06 actual installed-host evidence remains pending.
