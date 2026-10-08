"""Ordinary metadata contracts remain distinct from physical byte dispositions."""
from unittest.mock import AsyncMock

import pytest

from cortex.artifacts import ArtifactsAPI
from cortex.attachments import AttachmentsAPI
from cortex.types import FileReference


@pytest.mark.asyncio
@pytest.mark.parametrize("disposition", ["protected", "missing", "deleted"])
async def test_attachment_boolean_is_metadata_not_bytes(disposition):
    client = AsyncMock()
    client.mutation.return_value = {"deleted": True, "fileDeleted": disposition == "deleted", "binaryDisposition": disposition}
    api = AttachmentsAPI(client=client, resilience=None, auth_context=None)
    assert await api.delete("attach-owned") is True
    client.mutation.assert_awaited_once_with("attachments:remove", {"attachmentId": "attach-owned"})

@pytest.mark.asyncio
async def test_bulk_preserves_counts_errors_and_all_byte_dispositions():
    client = AsyncMock()
    dispositions = [{"attachmentId": "attach-owned", "disposition": "protected"}, {"attachmentId": "attach-two", "disposition": "deleted"}]
    client.mutation.return_value = {"deleted": 2, "total": 3, "errors": [{"attachmentId": "attach-absent", "error": "ATTACHMENT_NOT_FOUND"}], "binaryDispositions": dispositions}
    api = AttachmentsAPI(client=client, resilience=None, auth_context=None)
    result = await api.delete_many(["attach-owned", "attach-two", "attach-absent"])
    assert (result.deleted, result.total) == (2, 3)
    assert result.errors == client.mutation.return_value["errors"]
    assert result.binary_dispositions == dispositions

@pytest.mark.asyncio
async def test_artifact_preserves_additive_native_byte_dispositions():
    client = AsyncMock()
    result = {"deleted": True, "artifactId": "art-owned", "versionsPurged": 3, "filesDetached": 2, "binaryDispositions": [{"storageId": "owned", "disposition": "protected"}]}
    client.mutation.return_value = result
    api = ArtifactsAPI(client=client)
    assert await api.delete("art-owned", hard=True) == result
    client.mutation.assert_awaited_once_with("artifacts:deleteArtifact", {"artifactId": "art-owned", "hard": True})


@pytest.mark.asyncio
@pytest.mark.parametrize("optional", [False, True])
async def test_file_ref_omits_absent_optional_native_fields(optional):
    client = AsyncMock()
    client.mutation.return_value = {
        "_id": "physical", "artifactId": "art-owned", "memorySpaceId": "space",
        "title": "test", "kind": "text", "streamingState": "draft",
        "version": 1, "versionPointer": 1, "tags": [], "createdAt": 1, "updatedAt": 1,
    }
    ref = FileReference(storage_id="storage", mime_type="text/plain", size=1,
                        checksum="sha" if optional else None,
                        original_filename="name" if optional else None)
    api = ArtifactsAPI(client=client)
    await api.set_file_ref("art-owned", ref)
    wanted = {"storageId": "storage", "mimeType": "text/plain", "size": 1}
    if optional:
        wanted.update(checksum="sha", originalFilename="name")
    client.mutation.assert_awaited_once_with("artifacts:setFileRef", {"artifactId": "art-owned", "fileRef": wanted})
