Fresh-host composer repair is source-complete. The selected functions root now gets Convex1.46/TypeScript6 defaults only when tsconfig.json is absent. Existing config bytes, custom functions directory and unrelated host files are preserved. Config observations use the existing staleness checks and symlink protections before any writes. All existing conflict/idempotence behavior remains in place.

Affected checks: 3 suites, 87/87 assertions, 0 skipped; CLI types/build/scoped lint exit0, natural completion. A real compiler control passes valid installed source and rejects a deliberate type error. Before product repair, the new/affected tests failed11/19; the original red is retained. Two file-count expectations increase by1 for the newly required config; no behavioral assertions removed.

Product source change: additive-backend.ts +21 lines. Tests: new additive-tsconfig.test.ts (10 causal controls), two installed-file counts, and two current runtime-composition assertions. See source-manifest1.json and product-source1.patch.

Original CI Basic/provider logs are unchanged and indexed by ci-diagnosis1.json. CLI113757495604 failed before assertions because --forceExit=false is rejected by the canonical runner; Root owns the workflow correction. No workflow edits by this author.

These are offline source and installed-controlled-host checks. Actual fresh-host Convex typecheck qualification and one non-author review remain owned by Root. No task acceptance or live service effect is claimed.
