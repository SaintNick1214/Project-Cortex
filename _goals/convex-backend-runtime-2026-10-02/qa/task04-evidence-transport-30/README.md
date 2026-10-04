This packet preserves the frozen Task04 C4 fresh-review file bytes and exact file set using unique SHA-256-addressed contents. It changes transport representation only and grants no test, private/source/native, paid, task, or goal qualification.

Recommended Git representation: retain `_goals/convex-backend-runtime-2026-10-02/qa/task04-catalog-release-c4-fresh-review/report.md` directly, plus this complete packet. Omit every other original file beneath that frozen root from the Git tree; leave all local originals untouched. The original root manifest is 17,783,968 bytes and must be restored from this packet before checking original QA closure. `transport-map.json.gz` records every relative original path, SHA-256, and byte length, including that manifest.

From a clean checkout, run:

```sh
python3 _goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-30/materialize.py --target _goals/convex-backend-runtime-2026-10-02/qa/task04-catalog-release-c4-fresh-review --materialize
python3 _goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-30/materialize.py --target _goals/convex-backend-runtime-2026-10-02/qa/task04-catalog-release-c4-fresh-review
```

The helper verifies the pinned compressed map, every archive chunk, complete archive member set, content hashes, and existing originals before exclusively creating missing files. Exact existing files are verified; no existing file is overwritten. Unknown/duplicate/link archive members, unsafe paths, symlink ancestors, and content mismatches are rejected. The target must contain exactly the allowed original file set after materialization. No tar extraction API writes paths.

Archive chunks and the compressed map are each below or equal to 5 MiB. Two ordered archive chunks represent one deterministic gzip-compressed tar stream; individual `.part` files are not standalone archives. Every archive member is named by its content SHA-256. The source manifest preimage is already one content-addressed archive member; `preimages/source/manifest-preimage-reference.json` identifies it. Historical initial-map/helper preimages and transport-28/29 helper/map/README preimages are audit evidence. Historical preparation/check scripts and receipts document observed work, not instructions to rerun preparation over the sealed packet.

See `report.md`, receipts, and exact-self-excluding `qa-manifest.json` for observed verification and packet closure. Transport metadata corrections did not change original bytes, archive chunks, assertions, or qualification claims.
