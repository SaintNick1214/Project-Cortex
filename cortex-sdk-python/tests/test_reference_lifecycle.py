"""Public installed-wheel/native reference lifecycle parity on an explicit owned fixture."""

import asyncio
import hashlib
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import pytest
from convex.http_client import ConvexHttpClient

import cortex
from cortex import Cortex, CortexConfig
from cortex.resilience import ResilienceConfig
from cortex.types import AttachParams, AuthContext, CreateArtifactOptions, FileReference

ROOT = Path(os.environ["CORTEX_TASK23_PROOF_ROOT"])
URL = "http://127.0.0.1:45810"
KEY = json.loads((ROOT / "private-admin.json").read_text())["key"]
assert os.environ["CONVEX_URL_PY"] == URL
assert Path(cortex.__file__).resolve().is_relative_to(ROOT / "python-installed2")


def read_bytes(url):
    with urllib.request.urlopen(url, timeout=10) as response:
        return response.read(1024 * 1024)


def hash_bytes(url):
    return hashlib.sha256(read_bytes(url)).hexdigest()


def upload(url, data):
    request = urllib.request.Request(url, data=data, headers={"Content-Type": "text/plain"})
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)["storageId"]


def digest(value):
    # Selected ordinary fixed fixtures contain no special Convex values.
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


@pytest.mark.parametrize("scope", ["A", "B", "none"])
async def test_installed_native_reference_lifecycle(scope):
    tenant = None if scope == "none" else "t23-python-" + scope
    logical = "t23-python-installed-" + scope
    admin = ConvexHttpClient(URL)
    admin.set_admin_auth(KEY)
    client = Cortex(CortexConfig(convex_url=URL, auth=AuthContext(user_id="actor", tenant_id=tenant), resilience=ResilienceConfig(enabled=False)))
    foreign = Cortex(CortexConfig(convex_url=URL, auth=AuthContext(user_id="foreign", tenant_id=logical + "-foreign"), resilience=ResilienceConfig(enabled=False)))
    client.client._sync_client.set_admin_auth(KEY)
    foreign.client._sync_client.set_admin_auth(KEY)
    receipts = []

    async def sentinel():
        art = await asyncio.to_thread(admin.query, "artifacts:get", {"artifactId": "t23-legacy-text-0"})
        attach = await asyncio.to_thread(admin.query, "attachments:get", {"attachmentId": "t23-legacy-attachment-0"})
        download = await asyncio.to_thread(admin.query, "attachments:getUrl", {"attachmentId": "t23-legacy-attachment-0"})
        return [digest(art), digest(attach), await asyncio.to_thread(hash_bytes, download["url"])]

    try:
        before = await sentinel()
        data = (logical + " native wheel byte parity é🌱").encode()
        if os.environ.get("CORTEX_TASK23_PYTHON_RESUME") == "1":
            from cortex.types import ListAttachmentsFilter
            observed = await foreign.attachments.list(ListAttachmentsFilter(memory_space_id=logical + "-foreign", limit=5))
            assert len(observed.attachments) == 1
            shared = observed.attachments[0]
            storage_id = shared.storage_id
            assert shared.filename == "python.txt" and shared.size == len(data)
            assert await asyncio.to_thread(hash_bytes, await foreign.attachments.get_url(shared.attachment_id)) == hashlib.sha256(data).hexdigest()
            receipts.append({"operation": "exact committed uploads/deletes/created-artifact reconciled", "status": "PASS", "noMutationReplay": True, "storageId": storage_id})
        else:
            upload_info = await client.attachments.generate_upload_url()
            storage_id = await asyncio.to_thread(upload, upload_info.upload_url, data)
            params = dict(storage_id=storage_id, memory_space_id=logical, user_id="actor", type="file", mime_type="text/plain", filename="python.txt", size=len(data))
            one = await client.attachments.attach(AttachParams(**params))
            other = await foreign.attachments.attach(AttachParams(**{**params, "memory_space_id": logical + "-foreign", "user_id": "foreign"}))
            download = await client.attachments.get_url(one.attachment_id)
            before_hash = await asyncio.to_thread(hash_bytes, download)
            assert await client.attachments.delete(one.attachment_id) is True
            assert await asyncio.to_thread(hash_bytes, download) == before_hash
            assert (await foreign.attachments.get(other.attachment_id)).storage_id == storage_id
            result = await foreign.attachments.delete_many([other.attachment_id])
            assert result.deleted == 1 and result.total == 1 and not result.errors
            assert result.binary_dispositions == [{"attachmentId": other.attachment_id, "disposition": "deleted"}]
            with pytest.raises(urllib.error.HTTPError) as removed:
                await asyncio.to_thread(read_bytes, download)
            assert removed.value.code == 404
            receipts.append({"operation": "attachment-bool-bulk-global-bytes", "status": "PASS", "disposition": "deleted"})

            upload_info = await client.attachments.generate_upload_url()
            storage_id = await asyncio.to_thread(upload, upload_info.upload_url, data)
            shared = await foreign.attachments.attach(AttachParams(**{**params, "storage_id": storage_id, "memory_space_id": logical + "-foreign"}))
        art_id = "art-" + logical
        existing = await client.artifacts.get(art_id)
        if os.environ.get("CORTEX_TASK23_PYTHON_RESUME") == "1":
            assert existing is not None and existing.file_ref is None and existing.content == "ordinary"
        else:
            assert existing is None
            await client.artifacts.create(CreateArtifactOptions(memory_space_id=logical, title="installed Python", content="ordinary", artifact_id=art_id))
        await client.artifacts.set_file_ref(art_id, FileReference(storage_id=storage_id, mime_type="text/plain", size=len(data)))
        detached = await client.artifacts.detach_file(art_id, delete_file=True)
        assert detached.success and detached.file_deleted is False and detached.binary_disposition == "protected"
        deleted = await client.artifacts.delete(art_id, hard=True)
        assert deleted["deleted"] is True and isinstance(deleted["versionsPurged"], (int, float))
        assert all(item["disposition"] == "protected" for item in deleted["binaryDispositions"])
        assert await client.artifacts.get(art_id) is None
        last = await foreign.attachments.delete_many([shared.attachment_id])
        assert last.deleted == 1 and last.binary_dispositions[0]["disposition"] == "deleted"
        assert await sentinel() == before
        receipts.append({"operation": "artifact-detach-dict-dispositions-foreign-preservation", "status": "PASS", "detachDisposition": "protected", "sentinelHash": digest(before)})
    except Exception as error:
        receipts.append({"status": "FAIL", "error": str(error).replace(KEY, "[private]")})
        raise
    finally:
        await client.close()
        await foreign.close()
        admin.clear_auth()
        receipts.append({"operation": "both-owned-public-clients-close-awaited", "status": "PASS"})
        (ROOT / "evidence" / ("python-installed-native-" + scope + ".json")).write_text(json.dumps(receipts, indent=2) + "\n")
