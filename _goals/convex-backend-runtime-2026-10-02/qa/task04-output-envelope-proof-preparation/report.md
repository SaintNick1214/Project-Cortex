# Narrow output-envelope proof preparation

Status: OFFLINE_PROOF_PREPARATION_COMPLETE. No network, model/service/target/private access, credentials, dependencies, Git, product/config/tests or existing-QA changes. All earlier packets remain frozen. Only public-artifact computations ran. Actual serving tokenizer, output cap, provider decoder/rendering and native result correspondence remain **NOT_RUN**; no capability/root installed. This packet makes **no input-framing claim** and does not generalize to schemas/tools/media.

## Exact escaped-fragment maximum

Using the exact SHA-verified o200k artifact446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d, fragment-proof.py scanned all199998mergeable tokens. Define F(bytes) as the UTF8byte length of JSON **string content** after Unicode-scalar UTF8 maximal-subpart replacement decoding, excluding the two surrounding quotation marks, using saved official ECMAScript QuoteJSONString rules.

The maximum is **E=128bytes**. Rank72056 (128ASCIIspaces) attains it; binary witness and exact hashes are retained. Official o200k_base special spellings have F13and15, so the combined maximum remains128. The scan does not substitute o200k_harmony or a guessed vocabulary. Every nonASCII Unicode scalar was also exhaustively checked:1111936scalars, maximum escaped content4bytes. Quote/backslash and ASCII controls use the precise ECMAScript escape table; valid nonASCII scalars receive their UTF8encoding. The computation does not assume that each token is independently a complete UTF8string.

## Composition proof with explicit decoder assumptions

For the specified decoder, **F(A+B)<=F(A)+F(B)** for any byte strings A,B. This is an analytical UTF8 boundary proof, with a finite grammar inequality certificate; no inference from model samples or from a few token pairs.

A decoded left string consists of an already determined prefix plus, at most, one proper pending prefix p of a valid2/3/4byte Unicode scalar. All invalid leads/range violations before p have already emitted their replacements. Concatenating B cannot alter that determined prefix. If no pending p exists, both decodings coincide at the boundary and costs add exactly. An invalid next byte is reprocessed from the initial decoder state, exactly as in independent B decoding.

If p exists, decoding A alone at EOF emits U+FFFD (escaped content3bytes). Let k leading continuation bytes of B be absorbed before p completes, is interrupted, or reaches EOF. Independently decoding B emits U+FFFD for each of those k leading continuation bytes, cost3k, and then processes its remaining suffix from the same initial state.

- If no scalar completes, joint pending/interrupted output costs3bytes, at most independent3+3k.
- If the scalar completes, k>=1. The joint scalar is nonASCII and costs its UTF8length L<=4, while independent pending/continuations cost3+3k>=6.
- Constraints on E0/ED/F0/F4 continuation ranges only reduce absorbed k or trigger the interrupted/reprocess case. They cannot introduce ASCII/control/quote/backslash as a completed multibyte scalar.

These cases exhaust the UTF8 scalar prefix grammar; the finite certificate checks all L∈{2,3,4}, pending lengths1..L−1 and absorbed lengths0..L−r:16symbolic cases, all deltas<=0. Unchanged suffix costs cancel. Induction proves the bound over arbitrarily many vocabulary fragments, not just two. The proof depends on this maximal-subpart replacement/reprocessing contract and ECMAScript escaping; it is **not** a proof that Gateway uses it today.

Counterexamples to **equality** are preserved: E2 | 82AC independently becomes three replacements (F9), jointly EURO (F3); F09F98 | 80 independently two replacements (F6), jointly emoji (F4). Thus the proof explicitly rejects “decode fragments independently equals concatenated output.” The saved counterexamples do not contradict subadditivity. No counterexample to the claimed inequality was established under the stated grammar. A native decoder with additional normalization, escaping, inserted text, replacement semantics or content outside counted model tokens must be separately examined; this proof cannot automatically cover it.

## Fully counted narrow text envelope

Current canonical private shape is exactly **{text:string}**, one own field, no copied IDs/usage/metadata/second representation. Its empty canonical bytes are `{"text":""}`:11bytes (8key/prefix bytes,2quotes,1closing brace). Domain canonical JSON adds no whitespace. Therefore, conditional on at most Mgenerated o200k tokens contributing all persisted text and the qualified decoder contract:

**maximum canonical private bytes =128*M+11**.

| M | Maximum bytes |
|---:|---:|
|64|8203|
|256|32779|
|468|59915|
|469|60043(fails60000)|

468is the largest Mpermitted by this byte formula alone, not a proposed installed output limit. Existing model/policy/context/output limits can be tighter. Nonempty successful text remains required. A byte maximum says nothing about semantic answer quality or upstream charge.

The earlier universal bounds remain valid fallback: valid complete UTF8 **6*128*M+11**; arbitrary replacement **18*128*M+11**. The new bound improves them by jointly proving subadditivity of the **actual escaped fragment cost**, not multiplying separate maxima or assuming identical token-fragment decoding. If decoder semantics cannot be qualified, retain the appropriate prior bound and readiness gate rather than enabling this sharper result.

## Finite binary64 serialization and exact default-vector envelope

Saved official ECMAScript sources specify binary64 finite numbers, shortest roundtripping radix10 serialization with minimal kdigits, fixed notation for n∈[-5,21], and scientific notation otherwise. A **17significant-digit** decimal candidate exists for every finite nonzero binary64 value: rounding x to17decimal significant digits has absolute error<=5e−17*|x|. Every binary64 round-to-nearest interval has relative midpoint distance at least2^-54, including normal power-of-two boundaries; subnormal intervals are wider relative to their value. The strict integer inequality **5*2^54=90071992547409920<10^17** proves5e−17<2^-54. The candidate lies inside x's roundtrip interval, so the spec's shortest k<=17. Sign reflection covers negatives; zero serializes as one byte. Overflow-end finite and minimum-subnormal cases stay within their corresponding interval.

Decimal position n ranges[-323,309] for finite nonzero binary64; scientific exponents n−1 range[-324,308] (at most3digits). Applying the saved spec's notation grammar:

- Fixed small notation: sign<=1, `0.`2, zero padding<=5, significant digits<=17: **25bytes**.
- Fixed positive-position notation: at most22bytes including sign (or19with a decimal point).
- Scientific notation: sign1+digits17+decimal point1+`e`1+exponent sign1+exponent digits3: at most24bytes.

Thus every admitted finite canonical binary64 number needs **<=25bytes**. envelope-proof.mjs exhausts all21522integer notation-shape combinations and verifies the exact rational midpoint inequality. Its real ECMAScript witness `-0.0000012345678901234567` serializes to25bytes, establishing that the bound is attained; the proof is not derived from witness sampling. Domain canonicalModelJson rejects negative zero/nonfinite numbers; this packet introduces no conversion or relaxed validator. Decimal source spellings are not assumed to survive JSON parsing.

The frozen default profile has six exact fields; sorted canonical profile JSON is **215bytes**. Accepted B permits exactly **one** vector per child,1536finite dimensions. The private envelope is precisely `{profile:exactDefault,vectors:[one1536Array]}`. Its canonical empty-vector placeholder `{profile:exactDefault,vectors:[[]]}` is242bytes; replacing the empty content adds1536*25numeric bytes plus1535commas:

**242 +38400 +1535 =40177bytes <60000**.

A repeated25byte-number witness produces exactly40177canonical bytes in Node; the saved witness file includes one final LF (40178file bytes), excluded from private canonical payload accounting. The profile source, canonical profile, real numerical witness, runtime/script/results and file-versus-canonical hashes are recorded. Adding a second vector, IDs, usage, wrapper versions or different profiles requires a different fully counted envelope; none is silently covered. Finite values and exact dimensions/profile identity still require strict validation, and actual embedding service/profile readiness is not established by this storage proof.

## Qualification and scope limits

Before a trusted root can consume the text bound, independently accept the proof and qualify exact serving o200k provenance, model/interface maxOutputTokens semantics covering every stored generated-content token, decoder/rendering contract, and exact native-to-private {text} correspondence. Chat's installed max_tokens and Responses max_output_tokens remain distinct enforcement gates. Whitespace/BOM handling, hidden format tokens, refusals, partial/cancelled/error output, provider-generated text and semantic result validation must not be erased to fit this bound. Plain text proof does not enable tools/structured/Responses result variants; their approved functional scope remains at existing follow-on gates.

Default-vector canonical size is a finite arithmetic proof for the accepted private shape; actual1536vector/profile forwarding/usage/tariff/managed retrieval/currentness still require their original qualification. Preserve full charged terminal capture even for invalid or withheld results. No clipping/truncating payloads, price/input estimates, weakening PURE, output-cap installation, arbitrary normalization or readiness claims.

All offline scripts exited0. The analytical coverage argument, exact artifact maximum and exact envelope arithmetic are a preparation result for fresh independent review. Actual models/native caps/decoder/money remain NOT_RUN; production root EMPTY and wholeTask04 incomplete. No network or scope/budget decision was required.
