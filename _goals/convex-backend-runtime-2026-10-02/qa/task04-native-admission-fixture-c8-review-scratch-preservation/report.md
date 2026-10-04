# C8 review scratch preservation

Archive-only followup; no new judgment or acceptance claim. Frozen606-row review manifest remains unchanged.

Inventoried 2138 entries without following symlinks. Categories: {"archive-nonsecret-helper-or-preimage": 41, "duplicate-new-exactbytes": 125, "exactbytes-already-covered": 1226, "excluded-dummykey-or-historical-physical-ID-bearing-payload": 98, "excluded-generated-result-not-helper-or-preimage": 638, "excluded-symlink-nofollow": 10}.

Preserved 41 unique nonsecret helper/preimage byte sequences in 5 deterministic gzip chunks, each <=750000bytes. Exact-byte/original-mode in-memory tar roundtrip PASS. Existing exactbytes coverage avoids duplicate archives. Dummy-key/physical-ID-bearing payloads and generated nonhelper results remain excluded with path/category/hash/bytes. No symlink target read, scratch mutation, actual keys/env/target/network/services/RPC/Git activity.

Reassemble by gzip-decompressing chunks in inventory order and concatenating the raw tar parts. inventory.json records every archive and exclusion; final self-excluding preservation-manifest.json binds all deliverables.
