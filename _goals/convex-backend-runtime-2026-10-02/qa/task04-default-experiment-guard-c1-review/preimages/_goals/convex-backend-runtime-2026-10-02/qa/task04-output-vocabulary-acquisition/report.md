# Exact output-vocabulary acquisition

Status: EXACT_ARTIFACT_ACQUIRED_AND_EXHAUSTIVELY_SCANNED. Source/model serving-encoding, output-cap enforcement, complete private-result envelope and actual Gateway/cost qualification **NOT_RUN**. Existing input/result-bound research and structured preparation remain unchanged. No product/config/test/existing-QA/Git/service/target changes, dependency installation, credentials, token issuance, private access, API POST or model calls. Proxy/TLS policy unchanged.

Local installed/workspace/temporary encoding-asset filenames were inspected first; the searched roots contained documentation/source snapshots but no usable exact o200k artifact. The earlier official OpenAI blob GET's proxy403 remains intact in its original receipt. No attempt was made to bypass that policy or repeat the blocked request.

One additional public GET succeeded, timeout15seconds,2325457raw bytes(<16MiB):

`https://unpkg.com/tiktoken@1.0.22/encoders/o200k_base.json`

This is an **alternate packaged origin**, not OpenAI's publication or an installed dependency. Its identity/name is not the trust basis. The JSON bpe_ranks field is one `! 0` marker followed by base64 tokens in ascending rank. The bounded reconstruction script validates canonical base64/unique token bytes, removes that compression marker and serializes every row as original `base64 SPACE decimal-rank LF`. No downloaded JavaScript/Python/package code executes. The reconstructed3613922bytes have **exact authoritative SHA256**:

`446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d`

That equals OpenAI's already verified tiktoken_ext/openai_public.py expected_hash for its official o200k_base URL, establishing byte identity despite the alternate delivery origin. The package's two specials also exactly match the official source, but the verifier reads its special-token truth from the frozen official source, not the package. Package payload, reconstruction script/receipt, exact artifact and official source hashes are recorded in source-evidence.json.

## Exhaustive result

The **unchanged previously frozen offline verifier** ran against the exact matching artifact. A byte-identical copy and its authoritative source are included here for reproducibility. The earlier metadata-only NOT_RUN receipt was preserved rather than rewritten.

| Scope | Exhaustive maximum |
|---|---:|
|199998unique contiguous mergeable ranks|128raw decoded bytes|
|Single mergeable token decoded with UTF8 replacement and re-encoded|128UTF8bytes|
|Official base special spellings|15UTF8bytes|
|Combined raw mergeable/special maximum B|128bytes|

The raw maximum witness is rank72056, exactly128ASCIIspaces; maximum-token-witness.bin contains those exact decoded bytes. Both result JSON and binary witness are fingerprinted. This scan covers **all artifact tokens**, not finite model-output samples. o200k_harmony/other model vocabularies are not substituted. The maximum of individual replacement-decoded token strings is recorded, but is not silently promoted into a proof about Gateway's cross-token decoder/normalization; the existing verifier deliberately uses the conservative general replacement formula below.

## Conditional canonical-text bounds

Let M be an actually qualified total generated-token maximum under the exact selected model/interface and let H bound every additional trusted envelope field/identifier/part/metadata byte. For one generated text string with no duplicated parsed/text representation, unchanged verifier formulas are:

- Entire token-byte concatenation known to be valid UTF8: `6*M*128+2+H`.
- Arbitrary malformed-byte replacement allowed: `18*M*128+2+H`.

These derive from maximum decoded token bytes, at most3UTF8bytes per offending raw byte under replacement, and ECMAScript JSON escaping at most6bytes per input UTF8byte plus two quotes. They are not guessed protocol/input framing overhead. Hidden output-format tokens can consume M without generating stored bytes; the total cap still must cover all visible text/tool-input content that is stored. Serving-model remapping/tokenizer drift, output transformations or provider content generated outside counted tokens need their own qualified bounds.

Diagnostic cases saved here:

| Conditional case | Valid UTF8 bound | General replacement bound |
|---|---:|---:|
|M64,H0|49154|147458|
|M64,H4096|53250|151554|
|M24,H4096|22530|59394|

The first valid-byte M64 case leaves10846bytes for H under60000. M64 cannot satisfy the general replacement formula even with H0; a smaller cap such asM24 **could** fit with actually proved H<=4096. These are conditional arithmetic results, **not installed limits or an attested4096byte envelope**. No default cap, bound rule or production manifest changed. A tighter cross-token replacement proof could be independently reviewed later; it is not asserted here merely because the per-token maximum also equals128.

Tool turns, structured numeric JSON and native/provider IDs require the full typed-envelope/cardinality/number/escaping proof from the existing preparation. A one-text formula does not bound arbitrary part count, raw-response/header bytes, duplicated text plus parsed object or tool results computed by a backend executor. Compiled strict successful-result schemas remain an independent semantic-byte proof path; charged malformed/refusal/truncated results are withheld rather than truncated into successful storage.

## Remaining gates and reproduction

The official tiktoken.model source maps default gpt4o-mini and candidate gpt4.1-mini by prefixes to o200k_base, but actual Gateway aliases/serving tokenizer and model-specific M enforcement remain unqualified. Exact vocabulary identity closes only the artifact acquisition/maxima gate. It does not establish Chat tools/nested schema/Responses input U, native count support, complete K/charge/currency, actual model eligibility, source-currentness, current result replay or any original Task04–09 functional criterion. No paid-budget request/authorization is implied. The previously documented upstream Responses count endpoint still has no supported installed official Gateway route/method.

Reproduce without network/dependencies: run reconstruct.py against the saved package JSON; run vocabulary-proof.py with --vocabulary o200k_base.tiktoken and explicit --output-tokens/--envelope-bytes. The script refuses an artifact hash mismatch before calculating results. Exact commands/exits and frozen hashes are in source-evidence.json. Actual model/output/byte-envelope readiness remains NOT_RUN; production root EMPTY. No unavoidable approved-scope conflict or new product decision is established.
