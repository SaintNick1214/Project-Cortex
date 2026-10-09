# Asset action delivery deadline repair

The actual registered HTTP download/upload and private provider-input helpers previously returned protected bytes/metadata after their final fresh RPC's authorization deadline had passed in action time. Controlled regression red2 is **one healthy positive and four failures**. The tests invoke real registration handlers, catalog authorization and final mutation bodies with fixed snapshot time, then advance action time only after the awaited mutation returns. This is a meaningful production action boundary; it is not an advancing-clock-within-mutation oracle, not a provider or deployed-native qualification. red1's three product failures and two own conversation-argument setup failures remain intact; red2 corrects only that setup.

The narrow successor changes runtimeAssets.ts/runtimeAssetsHttp.ts plus one new asset test. The final download checkpoint returns the minimum actual grant and authorized consumed owner/share/source deadline, with explicit internal storage-read/write capability. Raw HTTP and private provider input check that witness immediately after awaiting it. Upload and generated ready replay fresh-fence the exact immutable version/hash. New internal storedDeliveryCheckpoint binds an already-ready job to its exact committed version and captured storage-write authority, so generated storage output gets the same final deadline check. No public selector supplies authority or deadline.

Canonical publicAsset metadata, version/hash/MIME/lineage and tool-result hashing stay unchanged. No server deadline enters an immutable proof. Suppressed late delivery preserves ready ownership and bytes; abandonJob still leaves committed ready rows intact. Storage-write-only upload and storage-read-only authorized shared byte access remain functional. The existing actual20,000,000-byte limit and separate private encoded protocol cap, grant/currentness/revocation/tombstone checks and budget/provider behavior are preserved.

## Checks and source

Node24.15.0/npm12.2.0; actual check processes exited and all owned sessions closed.

- Four affected suites passed57/57: original five action controls,28 lifecycle,21 legacy capability bridges and3 distribution controls.
- Final nine action controls passed9/9, replacing the earlier five. **Unique current selection is61 passing identities**, zero fail/skip; never57+9. New controls cover final grant/share expiry, generated commit delivery, ready HTTP replay, private provider materialization and normal storage-only parity/unchanged canonical metadata.
- SDK and backend no-emit typechecks, and scoped ESLint, exit0. No build/install, Git, service, deployment or paid call occurred.

source-manifest1.json binds exactly three paths with digest `8b98352385eb605411196e37efc55939c6c80969650d4786014bdab0886539e7`. checks1.json and assertion-identities1.json preserve unique selection and command outputs. No unrelated source was edited.

## Aggregate inventory and actual handoff

The closed source2 snapshot remains historical460/270public/190internal. One current regeneration in this repair folder resolves **461/270public/191internal**, five HTTP routes, exact digest `f4d67ee6e5cf1767d9e7f7f9c67bc3478efa1b59c555b7cd923d3266d792a7c0`. Only the two authorized asset product paths differ from source2. The added internal registration is runtimeAssets:storedDeliveryCheckpoint; it has catalog authorization and fresh server deadline provenance. No public route or new authorization/effect class was added. inventory-addendum1.json links both immutable snapshots and the same18-class Native matrix.

Source is quiet and released to the sole native executor. Native can install the exact two source postimages through its authorized additive package lane and verify the affected raw HTTP/private input/current metadata path on its owned fixture without model replay. The CODE action-clock red-to-green is not labeled actual native success. Full Task03/16 and async video acceptance remain incomplete and belong to the independent coherent aggregate review. Original unavailable capabilities, actual failures and financial uncertainty remain preserved.
