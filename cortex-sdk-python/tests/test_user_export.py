"""Task16C read-only production export proof on the explicitly owned native fixture."""

import base64
import hashlib
import json
import math
import os
from pathlib import Path

import pytest
from convex.values import json_to_convex

from cortex.users import UsersAPI
from cortex.users.export import UserExportTransportError

PROOF = Path(
    "/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/cli-sandbox-2026/user-export-16c"
)


def owned_transport():
    # Guard before credential reads or network use. These tests never seed or reset.
    assert (
        os.environ["HOME"] == str(PROOF / "home") == os.environ["CORTEX_TEST_HOME_ROOT"]
    )
    assert (
        os.environ["CONVEX_URL_PY"] == "http://127.0.0.1:45410"
        and os.environ["PYTHON_DOTENV_DISABLED"] == "1"
    )
    original = PROOF.with_name("fact-history-provenance")
    owner = json.loads((original / "ownership.json").read_text())
    assert owner["owner"] == "task18-fact-history-provenance"
    os.kill(owner["pid"], 0)
    key = json.loads(
        (original / "project/.convex/local/default/config.json").read_text()
    )["adminKey"]
    return UsersAPI(object()).create_export_transport(
        url="http://127.0.0.1:45410", deployment_key=key
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("scope_name", ["tenantless", "A", "B"])
async def test_owned_complete_records_retained_history_and_exact_binary_bytes(
    scope_name,
):
    transport = owned_transport()
    seed = next(
        s
        for s in json.loads((PROOF / "seeds.json").read_text())["saved"]
        if s["mode"] == "valid"
        and s["scope"].get("tenantId", "tenantless") == scope_name
    )
    events = [
        e
        async for e in UsersAPI(object()).export_data(
            seed["userId"],
            transport=transport,
            tenant_id=seed["scope"].get("tenantId"),
            page_size=100,
        )
    ]
    records = [e for e in events if e["type"] == "record"]
    assert sorted((e["node"]["domain"], e["node"]["id"]) for e in records) == sorted(
        (n["domain"], n["id"]) for n in seed["ids"].values()
    )
    assert events[0]["identity"]["scope"] == seed["scope"]
    rows = {e["node"]["id"]: json_to_convex(e["record"]) for e in records}
    for record in rows.values():
        assert record.get("tenantId") == seed["scope"].get("tenantId")
    profile = rows[seed["ids"]["profile"]["id"]]
    assert math.copysign(1, profile["data"]["nested"]["minusZero"]) == -1
    assert (
        math.isnan(profile["data"]["nested"]["nan"])
        and profile["data"]["nested"]["maximum"].value == 2**63 - 1
    )
    assert len(profile["previousVersions"]) == 1
    assert [
        v["content"] for v in rows[seed["ids"]["memory"]["id"]]["previousVersions"]
    ] == ["original", "retained"]
    artifact = rows[seed["ids"]["artifact"]["id"]]
    assert len(artifact["versionHistory"]) == 3 and artifact["isDeleted"] is True
    space = rows[seed["ids"]["space"]["id"]]
    assert "metadata" not in space and [p["id"] for p in space["participants"]] == [
        seed["userId"]
    ]
    conversation = rows[seed["ids"]["conversation"]["id"]]
    assert (
        len(conversation["messages"]) == 3
        and conversation["messages"][0]["participantId"] == "foreign"
    )
    manifest = events[-1]
    assert (
        manifest["type"] == "manifest"
        and manifest["complete"] is True
        and manifest["consistency"] == "rolling-read"
    )
    first_reference_order = list(reversed(seed["storageIds"]))
    assert [b["storageId"] for b in manifest["blobs"]] == first_reference_order
    assert [
        e["storageId"] for e in events if e["type"] == "blob"
    ] == first_reference_order
    assert (
        manifest["pageCount"]
        == len(manifest["pageObservations"])
        == sum(x["pages"] for x in manifest["tableManifest"])
    )
    independently_uploaded = {
        70001: bytes(i % 256 for i in range(70001)),
        5: bytes([0, 255, 1, 128, 2]),
        0: b"",
    }
    for blob in manifest["blobs"]:
        chunks = [
            e
            for e in events
            if e["type"] == "chunk" and e["storageId"] == blob["storageId"]
        ]
        assert [e["sequence"] for e in chunks] == list(range(len(chunks)))
        assert all(e["byteLength"] == len(base64.b64decode(e["data"])) for e in chunks)
        data = b"".join(base64.b64decode(e["data"]) for e in chunks)
        assert data == independently_uploaded[blob["size"]]
        assert hashlib.sha256(data).hexdigest() == blob["sha256"]
        if blob["size"] == 70001:
            assert [len(base64.b64decode(c["data"])) for c in chunks] == [
                65536,
                4465,
            ] and len(blob["referrers"]) == 2
        if blob["size"] == 0:
            assert not chunks


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["badSize", "badChecksum"])
async def test_owned_bad_file_metadata_aborts_without_completion(mode):
    transport = owned_transport()
    seed = next(
        s
        for s in json.loads((PROOF / "seeds.json").read_text())["saved"]
        if s["mode"] == mode
    )
    events = []
    with pytest.raises(UserExportTransportError, match="EXPORT_FILE_METADATA"):
        async for event in UsersAPI(object()).export_data(
            seed["userId"], transport=transport
        ):
            events.append(event)
    assert not any(e["type"] == "manifest" for e in events)


@pytest.mark.asyncio
async def test_owned_wrong_key_cannot_call_any_internal_export_operation():
    owned_transport()  # verifies owned target before constructing the denial client
    seed = json.loads((PROOF / "seeds.json").read_text())["saved"][0]
    transport = UsersAPI(object()).create_export_transport(
        url="http://127.0.0.1:45410", deployment_key="task16c-invalid-key"
    )
    identity = {"userId": seed["userId"], "scope": seed["scope"]}
    node_request = {
        **identity,
        "node": seed["ids"]["profile"],
        "expectedFingerprint": "1" * 64,
    }
    for name, request in [
        ("inspect", identity),
        (
            "page",
            {
                **identity,
                "selection": {"kind": "rootProjections", "domain": "immutable"},
                "cursor": None,
                "numItems": 1,
            },
        ),
        ("inspect_edge", {**node_request, "edgeOrdinal": 0}),
        ("read_node", node_request),
        ("resolve_file", {**node_request, "node": seed["ids"]["attachment"]}),
    ]:
        with pytest.raises(UserExportTransportError, match="EXPORT_AUTHORIZATION"):
            await getattr(transport, name)(request)


@pytest.mark.asyncio
@pytest.mark.parametrize("scope_name", ["tenantless", "A", "B"])
async def test_inherited_alternating_closure_releases_exact_44_raw_records(scope_name):
    transport = owned_transport()
    ledger = json.loads(
        (PROOF.with_name("user-export-16b") / "native-seeds.json").read_text()
    )
    seed = next(
        s
        for s in ledger["saved"]
        if s["scope"].get("tenantId", "tenantless") == scope_name
    )
    labels = [
        "profile",
        "supportSpace",
        "note",
        "mutable",
        "session",
        "ownAttachment",
        "joint",
        "jointMemory",
        "ownContext",
        "jointContext",
        "ownArtifact",
        "coArtifact",
        "editorArtifact",
        "viewerArtifact",
        "unownedArtifact",
        "ownSnapshot",
        "outShare",
        "incomingTrue",
        "incomingFalse",
        "ownedHistory",
        "deletedHistory",
        "associatedDeletedHistory",
        "actorHistory",
        "F0",
        *(f"M{i}" for i in range(1, 11)),
        *(f"F{i}" for i in range(1, 11)),
    ]
    assert len(labels) == 44
    events = [
        e
        async for e in UsersAPI(object()).export_data(
            ledger["userId"],
            transport=transport,
            tenant_id=seed["scope"].get("tenantId"),
        )
    ]
    records = [e for e in events if e["type"] == "record"]
    assert sorted((e["node"]["domain"], e["node"]["id"]) for e in records) == sorted(
        (seed["ids"][label]["domain"], seed["ids"][label]["id"]) for label in labels
    )
    assert events[-1]["type"] == "manifest" and events[-1]["complete"] is True
    for label in (
        "editorArtifact",
        "viewerArtifact",
        "incomingTrue",
        "incomingFalse",
        "supportSpace",
    ):
        record = next(e for e in records if e["node"] == seed["ids"][label])
        assert record["disposition"] == "membershipProjection"
        assert (
            "content" not in record["record"]
            and "fileRef" not in record["record"]
            and "versionHistory" not in record["record"]
        )
    for label in (
        "ownedHistory",
        "deletedHistory",
        "associatedDeletedHistory",
        "actorHistory",
    ):
        record = next(e for e in records if e["node"] == seed["ids"][label])
        assert (
            record["disposition"] == "record" and record["record"]["scopeVersion"] == 1
        )
    assert (
        sum(row["records"] + row["projections"] for row in events[-1]["tableManifest"])
        == 44
    )
