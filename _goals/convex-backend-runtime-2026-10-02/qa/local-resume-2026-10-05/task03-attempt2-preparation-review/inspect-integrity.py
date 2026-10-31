"""Read-only candidate/source conservation check; takes a coordinator-frozen digest."""
import argparse
import hashlib
import json
import os
import stat
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("candidate")
parser.add_argument("freeze")
parser.add_argument("expected_sha256")
args = parser.parse_args()
q = Path(args.candidate)
repo = q.parents[3]
old = q.parent / "task03-local-current-delta-2026-10-05"

def contents(path):
    path = Path(path)
    assert path.is_absolute() and Path(os.path.abspath(path)) == path
    for ancestor in [*reversed(path.parents), path]:
        metadata = ancestor.lstat()
        assert not stat.S_ISLNK(metadata.st_mode), str(ancestor)
    with path.open("rb") as stream:
        before = os.fstat(stream.fileno())
        assert stat.S_ISREG(before.st_mode) and before.st_nlink == 1, str(path)
        data = stream.read()
        after = os.fstat(stream.fileno())
    fields = ("st_dev", "st_ino", "st_mode", "st_nlink", "st_uid", "st_gid", "st_size", "st_mtime_ns", "st_ctime_ns")
    assert tuple(getattr(before, field) for field in fields) == tuple(getattr(after, field) for field in fields), str(path)
    return data

def digest(data):
    return hashlib.sha256(data).hexdigest()

def rows_match(base, rows):
    paths = set()
    for row in rows:
        relative = Path(row["path"])
        assert not relative.is_absolute() and ".." not in relative.parts
        assert str(relative) not in paths
        paths.add(str(relative))
        raw = contents(base / relative)
        assert digest(raw) == row["sha256"], str(relative)
        if "bytes" in row:
            assert len(raw) == row["bytes"], str(relative)
    return paths

frozen_raw = contents(q / args.freeze)
assert digest(frozen_raw) == args.expected_sha256
frozen = json.loads(frozen_raw)
paths = rows_match(q, frozen["files"])
assert frozen["actualExternalRequests"] == 0 and frozen["actualDeployments"] == 0
source = json.loads(contents(q / "source-inventory.json"))
rows_match(repo, source["files"])
old_freeze_raw = contents(old / "candidate-freeze-cycle2.json")
assert digest(old_freeze_raw) == "2fa7ddfd9898216a84ac5079edd0661604b709d09384d847ced94e6c725e4c55"
old_frozen = json.loads(old_freeze_raw)
rows_match(old, old_frozen["files"])
old_rows = {row["path"]: row for row in old_frozen["files"]}
new_rows = {row["path"]: row for row in frozen["files"]}
removed = sorted(set(old_rows) - set(new_rows))
changed = sorted(path for path in set(old_rows) & set(new_rows) if old_rows[path]["sha256"] != new_rows[path]["sha256"])
added = sorted(set(new_rows) - set(old_rows))
compiler = []
prefix = "managed-fixture/fixture/node_modules/typescript/"
for path, row in new_rows.items():
    if path.startswith(prefix):
        installed = repo / "node_modules/typescript" / path[len(prefix):]
        raw = contents(installed)
        assert digest(raw) == row["sha256"] and len(raw) == row["bytes"], path
        compiler.append(path)
receipt_checks = []
for name in ("receipt-manifest-attempt2.json",):
    path = q / name
    if not path.exists():
        continue
    manifest_raw = contents(path)
    manifest = json.loads(manifest_raw)
    if isinstance(manifest, dict) and isinstance(manifest.get("files"), list):
        rows_match(q, manifest["files"])
        receipt_checks.append({"manifest": name, "sha256": digest(manifest_raw), "entries": len(manifest["files"])})
inventory = json.loads(contents(q / "current-inventory/public-path-inventory.json"))
registrations = inventory["endpoints"]
assert len(registrations) == 275 and not inventory["routes"]
assert len({row["path"] for row in registrations}) == 275
assert sum(row["visibility"] == "public" for row in registrations) == 200
assert sum(row["visibility"] == "internal" for row in registrations) == 75
native = json.loads(contents(q / "managed-native-registration-schemas.json"))
assert native["registrationCount"] == 287 and native["public"] == 200 and native["internal"] == 87
assert len(native["rows"]) == len({row["path"] for row in native["rows"]}) == 287
print(json.dumps({
    "scope": "READ_ONLY_INDEPENDENT_ATTEMPT2_PREPARATION_INTEGRITY",
    "status": "PASS", "candidateSha256": digest(frozen_raw),
    "frozenFiles": len(paths), "frozenBytes": sum(row.get("bytes", 0) for row in frozen["files"]),
    "sourcePins": len(source["files"]), "priorFrozenFilesVerified": len(old_rows),
    "priorRemoved": removed, "priorChanged": changed, "added": added,
    "compilerAssetsExactInstalled": len(compiler), "compilerAssetBytes": sum(new_rows[path]["bytes"] for path in compiler),
    "receiptManifests": receipt_checks,
    "productRegistrations": 275, "expectedNativeRegistrations": 287,
    "credentialsRead": 0, "serviceCalls": 0, "candidateMutations": 0,
}, indent=2))
