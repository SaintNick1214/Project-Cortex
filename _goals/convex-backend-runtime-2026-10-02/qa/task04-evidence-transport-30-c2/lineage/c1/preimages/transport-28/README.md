# Frozen evidence transport

The connector rejects requests over16MiB. Three49,217,478-byte C3 command-custody indexes are preserved here as deterministic lossless gzip archives. Original local files and their frozen hashes are unchanged. This transport supplies no qualification or acceptance.

A clean checkout must reconstruct the original paths from transport-map.json and verify exact original bytes/SHA256 before complete C3 closure verification or native preflight. Missing original paths must fail closed; archive presence alone is not a complete direct-file closure. The map records compressed and original SHA256 and Git blob hashes. All three gzip round trips were compared byte-for-byte to their originals. No scope/assertion/source/manifest rebaseline occurred.

Run `python _goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-28/materialize.py` for read-only verification, or add `--materialize` to restore missing originals. Existing differing files or symlink paths are rejected; existing exact originals are never overwritten. The helper pins its map hash and verifies archive/original SHA256 plus original Git blob identity.
