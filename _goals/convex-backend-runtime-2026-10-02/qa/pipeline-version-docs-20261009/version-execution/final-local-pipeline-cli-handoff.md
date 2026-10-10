Current local pipeline and affected CLI qualification is complete. Final source is 7475c8049784b8435692e815fc37bd046d16b431. The clean unsynced checkout used Node 24.15.0 and npm 12.2.0; CI retains its Node 24.21.0 pin.

| Check | Source | Outcome | Natural elapsed |
| --- | --- | --- | --- |
| SDK full distribution build | 4de32f210 | PASS | 17.214s |
| CLI build | 4de32f210 | PASS | 1.515s |
| Packed public/browser contracts | 4de32f210 | PASS | 1.768s |
| Root TypeScript | 4de32f210 | PASS | 12.461s |
| CLI TypeScript | 4de32f210 | PASS | 3.063s |
| CLI ESLint | 4de32f210 | PASS | 3.001s |
| Changed pipeline and backend files ESLint | 4de32f210 | PASS | 2.452s |
| CI command/runtime helpers | 4de32f210 | 55/55 tests | 10.011s |
| Exact affected CLI nine-file discovery | 4de32f210 | PASS | 0.425s |
| Affected CLI source and installed binary assertions | 4de32f210 | 259/259 tests | 25.057s |
| Pipeline/release/security/managed contracts | 7475c8049 | 142/142 tests | 2.459s |
| Earlier equivalent catalog assertions | fc29f06e6 | 24/24 tests | 0.394s |
| Earlier equivalent current app install helper assertions | fc29f06e6 | 24/24 tests | 5.611s |

The current CLI receipt discovers exactly nine files and passes 259 cases with zero pending. It includes catalog 68, legacy composer 63, ownership 48, installed CLI 15, current quickstart 23, template integration 12, runtime backend 9, secure file 10, and real Node runtime 11. Actual Node 20.0.0 and 20.20.2 negative cases retain version/hash proofs and early refusal; the positive runtime is the selected supported local 24.15.0 binary.

The 187 regular SDK artifact hashes and dependency binding are preserved in final-repair-sdk-artifacts.json, final-repair-cli-input-receipt.json and final-repair-cli-input-binding.json. Both old and current owned fixture directories were removed with natural cleanup receipts. Parent receipts prove the obsolete pnpm hardlinks were removed without changing tracked bytes; strict single-link guards remain unchanged.

The original complete CLI red, two affected hardlink reds, interrupted synced Documents runs and final pipeline signing-fixture red remain available. The pipeline signing repair disables signing only inside its disposable test repository; the final pipeline passes 142/142. The JSON report contains exact commands, deadlines, source bindings and receipt names.

This report credits the current affected nine-suite CLI selection. It does not claim a new complete 63-suite run, refresh historical C7 custody, or refresh older 8ca live-service evidence. Root separately owns current Linux CI, canonical app checks and service evidence.
