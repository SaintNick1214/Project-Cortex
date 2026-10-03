# Independent bounded48 repair review evidence

These files preserve the actual prior independent review, not a new judge cycle. All test identities and raw outcomes are retained. `commands.json` records exact observed commands and exit codes. Empty `types.txt` and `lint.txt` are the actual successful no-output receipts.

- `rejected330.json` / `.txt`: frozen rejected source,328 pass and exactly2 original foreign-tombstone failures.
- `current330.json` / `.txt` and `original330.test.ts`: same byte-identical original330 assertions,330 pass on repaired code.
- `native1124.json` / `.txt`:1124 native outcomes; `supporting/native-closure.test.ts` preserves executed test source and fixture.
- `fresh451.json` / `.txt` and `fresh.test.ts`:451 new independent accessor/Proxy, late authority deletion, source nondisclosure and final-await expiry outcomes. `fresh410` is the earlier observed410-case receipt before41 expiry probes were appended; the final451 source is retained.
- `positive48.json`, `verification.json`, `verify.mjs`, `verify.txt`, `baseline-head.json`: healthy controls, SHA256/AST/catalog preservation verification and original-source equality to HEAD.
- `inventory/`: actual import-aware current registration catalog.

Original configs retain the exact executed work-directory paths and imports. Supporting executor configs and typecheck config preserve referenced local configuration; the actual raw results do not depend on those work paths remaining present. To rerun the original commands from the repository root, restore the original configs/probes to their recorded `work/resume/transcript-repair-judge` paths and retain the recorded executor configs, frozen rejected source and shared dependencies. Replaying later changed sources requires a new affected review and is not implied by this evidence.

No caches, node_modules, environment files or credentials are copied. Fixture strings such as SECRET are synthetic nondisclosure markers. Manifest hashes bind every retained evidence file.
