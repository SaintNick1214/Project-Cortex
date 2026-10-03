"""
Unit Tests: Attachments Python SDK

Tests for AttachmentsAPI class with mocked Convex client.
Covers all API methods and all supported modalities:
- image (PNG, JPEG, GIF, WEBP)
- audio (MP3, WAV, OGG)
- video (MP4, WEBM)
- pdf
- file (generic)
"""

import time
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock

import pytest

from cortex.attachments import AttachmentsAPI
from cortex.types import (
    Attachment,
    AttachmentDimensions,
    AttachParams,
    AuthContext,
    ListAttachmentsFilter,
    ListAttachmentsResult,
)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Fixtures
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.fixture
def mock_client() -> AsyncMock:
    """Create a mock Convex client."""
    client = AsyncMock()
    client.mutation = AsyncMock()
    client.query = AsyncMock()
    return client


@pytest.fixture
def mock_resilience() -> MagicMock:
    """Create a mock resilience layer that just executes the operation."""
    resilience = MagicMock()

    async def execute_impl(operation, name):
        return await operation()

    resilience.execute = AsyncMock(side_effect=execute_impl)
    return resilience


@pytest.fixture
def mock_auth_context() -> AuthContext:
    """Create a mock auth context."""
    return AuthContext(
        user_id="test-user",
        tenant_id="test-tenant",
    )


@pytest.fixture
def attachments_api(mock_client: AsyncMock) -> AttachmentsAPI:
    """Create AttachmentsAPI instance with mocks."""
    return AttachmentsAPI(
        client=mock_client,
        resilience=None,
        auth_context=None,
    )


@pytest.fixture
def attachments_api_with_tenant(
    mock_client: AsyncMock,
    mock_auth_context: AuthContext,
) -> AttachmentsAPI:
    """Create AttachmentsAPI instance with tenant context."""
    return AttachmentsAPI(
        client=mock_client,
        resilience=None,
        auth_context=mock_auth_context,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test Data Factories
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def create_mock_attachment_dict(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Create a mock attachment response dictionary."""
    now = int(time.time() * 1000)
    base = {
        "_id": "doc_123",
        "attachmentId": "attach-abc123",
        "memorySpaceId": "space-123",
        "userId": "user-456",
        "storageId": "storage-789",
        "type": "image",
        "mimeType": "image/png",
        "filename": "test.png",
        "size": 1024,
        "createdAt": now,
        "updatedAt": now,
    }
    if overrides:
        base.update(overrides)
    return base


# Modality-specific test data
MODALITY_TEST_DATA = {
    "image": {
        "type": "image",
        "mimeType": "image/png",
        "filename": "photo.png",
        "size": 2048000,
        "dimensions": {"width": 1920, "height": 1080},
    },
    "audio": {
        "type": "audio",
        "mimeType": "audio/mpeg",
        "filename": "recording.mp3",
        "size": 5242880,
        "duration": 180.0,
    },
    "video": {
        "type": "video",
        "mimeType": "video/mp4",
        "filename": "clip.mp4",
        "size": 52428800,
        "dimensions": {"width": 1920, "height": 1080},
        "duration": 60.0,
    },
    "pdf": {
        "type": "pdf",
        "mimeType": "application/pdf",
        "filename": "document.pdf",
        "size": 1048576,
        "extractedText": "Sample PDF content extracted via OCR",
    },
    "file": {
        "type": "file",
        "mimeType": "application/octet-stream",
        "filename": "data.bin",
        "size": 512000,
    },
}

# MIME type variations for each modality
MIME_TYPE_VARIATIONS = {
    "image": ["image/png", "image/jpeg", "image/gif", "image/webp"],
    "audio": ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"],
    "video": ["video/mp4", "video/webm", "video/quicktime"],
    "pdf": ["application/pdf"],
    "file": ["application/octet-stream", "application/zip", "text/plain"],
}

MODALITIES = ["image", "audio", "video", "pdf", "file"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# generate_upload_url Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestGenerateUploadUrl:
    """Tests for AttachmentsAPI.generate_upload_url()."""

    @pytest.mark.asyncio
    async def test_generates_upload_url_successfully(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should return upload URL from Convex."""
        mock_url = "https://convex.cloud/upload/abc123"
        mock_client.mutation.return_value = {"uploadUrl": mock_url}

        result = await attachments_api.generate_upload_url()

        assert result.upload_url == mock_url
        mock_client.mutation.assert_called_once()

    @pytest.mark.asyncio
    async def test_includes_tenant_id_when_provided(
        self, attachments_api_with_tenant: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should include tenant ID in request when auth context provided."""
        mock_client.mutation.return_value = {"uploadUrl": "https://example.com"}

        await attachments_api_with_tenant.generate_upload_url()

        call_args = mock_client.mutation.call_args
        assert call_args[0][1]["tenantId"] == "test-tenant"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# attach Tests - All Modalities
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestAttach:
    """Tests for AttachmentsAPI.attach() method."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("modality", MODALITIES)
    async def test_attach_each_modality(
        self,
        attachments_api: AttachmentsAPI,
        mock_client: AsyncMock,
        modality: str,
    ):
        """Should attach files of each modality type correctly."""
        test_data = MODALITY_TEST_DATA[modality]
        mock_response = create_mock_attachment_dict(test_data)
        mock_client.mutation.return_value = mock_response

        params = AttachParams(
            storage_id="storage-new",
            memory_space_id="space-123",
            user_id="user-456",
            type=modality,
            mime_type=test_data["mimeType"],
            filename=test_data["filename"],
            size=test_data["size"],
            dimensions=AttachmentDimensions(**test_data["dimensions"])
            if "dimensions" in test_data
            else None,
            duration=test_data.get("duration"),
        )

        result = await attachments_api.attach(params)

        assert result.type == modality
        assert result.mime_type == test_data["mimeType"]
        assert result.filename == test_data["filename"]

    @pytest.mark.asyncio
    @pytest.mark.parametrize("modality", MODALITIES)
    async def test_attach_mime_type_variations(
        self,
        attachments_api: AttachmentsAPI,
        mock_client: AsyncMock,
        modality: str,
    ):
        """Should accept all valid MIME types for each modality."""
        for mime_type in MIME_TYPE_VARIATIONS[modality]:
            mock_response = create_mock_attachment_dict({
                "type": modality,
                "mimeType": mime_type,
            })
            mock_client.mutation.return_value = mock_response

            params = AttachParams(
                storage_id="storage-new",
                memory_space_id="space-123",
                user_id="user-456",
                type=modality,
                mime_type=mime_type,
                filename=f"test.{modality}",
                size=1024,
            )

            result = await attachments_api.attach(params)
            assert result.mime_type == mime_type

    @pytest.mark.asyncio
    async def test_attach_with_dimensions_for_image(
        self,
        attachments_api: AttachmentsAPI,
        mock_client: AsyncMock,
    ):
        """Should store dimensions for image attachments."""
        mock_response = create_mock_attachment_dict({
            "type": "image",
            "dimensions": {"width": 1920, "height": 1080},
        })
        mock_client.mutation.return_value = mock_response

        params = AttachParams(
            storage_id="storage-new",
            memory_space_id="space-123",
            user_id="user-456",
            type="image",
            mime_type="image/png",
            filename="test.png",
            size=1024,
            dimensions=AttachmentDimensions(width=1920, height=1080),
        )

        await attachments_api.attach(params)

        call_args = mock_client.mutation.call_args[0][1]
        assert call_args["dimensions"] == {"width": 1920, "height": 1080}

    @pytest.mark.asyncio
    async def test_attach_with_duration_for_audio(
        self,
        attachments_api: AttachmentsAPI,
        mock_client: AsyncMock,
    ):
        """Should store duration for audio attachments."""
        mock_response = create_mock_attachment_dict({
            "type": "audio",
            "duration": 180.0,
        })
        mock_client.mutation.return_value = mock_response

        params = AttachParams(
            storage_id="storage-new",
            memory_space_id="space-123",
            user_id="user-456",
            type="audio",
            mime_type="audio/mpeg",
            filename="test.mp3",
            size=5242880,
            duration=180.0,
        )

        await attachments_api.attach(params)

        call_args = mock_client.mutation.call_args[0][1]
        assert call_args["duration"] == 180.0

    @pytest.mark.asyncio
    async def test_attach_with_video_dimensions_and_duration(
        self,
        attachments_api: AttachmentsAPI,
        mock_client: AsyncMock,
    ):
        """Should store both dimensions and duration for video attachments."""
        mock_response = create_mock_attachment_dict({
            "type": "video",
            "dimensions": {"width": 1920, "height": 1080},
            "duration": 60.0,
        })
        mock_client.mutation.return_value = mock_response

        params = AttachParams(
            storage_id="storage-new",
            memory_space_id="space-123",
            user_id="user-456",
            type="video",
            mime_type="video/mp4",
            filename="clip.mp4",
            size=52428800,
            dimensions=AttachmentDimensions(width=1920, height=1080),
            duration=60.0,
        )

        await attachments_api.attach(params)

        call_args = mock_client.mutation.call_args[0][1]
        assert call_args["dimensions"] == {"width": 1920, "height": 1080}
        assert call_args["duration"] == 60.0

    @pytest.mark.asyncio
    async def test_attach_link_to_conversation(
        self,
        attachments_api: AttachmentsAPI,
        mock_client: AsyncMock,
    ):
        """Should link attachment to conversation."""
        mock_response = create_mock_attachment_dict({"conversationId": "conv-123"})
        mock_client.mutation.return_value = mock_response

        params = AttachParams(
            storage_id="storage-new",
            memory_space_id="space-123",
            user_id="user-456",
            type="image",
            mime_type="image/png",
            filename="test.png",
            size=1024,
            conversation_id="conv-123",
        )

        await attachments_api.attach(params)

        call_args = mock_client.mutation.call_args[0][1]
        assert call_args["conversationId"] == "conv-123"

    @pytest.mark.asyncio
    async def test_attach_link_to_message(
        self,
        attachments_api: AttachmentsAPI,
        mock_client: AsyncMock,
    ):
        """Should link attachment to message."""
        mock_response = create_mock_attachment_dict({"messageId": "msg-456"})
        mock_client.mutation.return_value = mock_response

        params = AttachParams(
            storage_id="storage-new",
            memory_space_id="space-123",
            user_id="user-456",
            type="image",
            mime_type="image/png",
            filename="test.png",
            size=1024,
            message_id="msg-456",
        )

        await attachments_api.attach(params)

        call_args = mock_client.mutation.call_args[0][1]
        assert call_args["messageId"] == "msg-456"

    @pytest.mark.asyncio
    async def test_attach_with_custom_metadata(
        self,
        attachments_api: AttachmentsAPI,
        mock_client: AsyncMock,
    ):
        """Should include custom metadata."""
        custom_metadata = {"source": "camera", "location": "office"}
        mock_response = create_mock_attachment_dict({"metadata": custom_metadata})
        mock_client.mutation.return_value = mock_response

        params = AttachParams(
            storage_id="storage-new",
            memory_space_id="space-123",
            user_id="user-456",
            type="image",
            mime_type="image/png",
            filename="test.png",
            size=1024,
            metadata=custom_metadata,
        )

        await attachments_api.attach(params)

        call_args = mock_client.mutation.call_args[0][1]
        assert call_args["metadata"] == custom_metadata


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# get Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestGet:
    """Tests for AttachmentsAPI.get() method."""

    @pytest.mark.asyncio
    async def test_get_attachment_by_id(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should retrieve attachment by ID."""
        mock_response = create_mock_attachment_dict()
        mock_client.query.return_value = mock_response

        result = await attachments_api.get("attach-abc123")

        assert result is not None
        assert result.attachment_id == "attach-abc123"

    @pytest.mark.asyncio
    async def test_get_returns_none_for_nonexistent(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should return None for non-existent attachment."""
        mock_client.query.return_value = None

        result = await attachments_api.get("non-existent")

        assert result is None

    @pytest.mark.asyncio
    @pytest.mark.parametrize("modality", MODALITIES)
    async def test_get_parses_each_modality(
        self,
        attachments_api: AttachmentsAPI,
        mock_client: AsyncMock,
        modality: str,
    ):
        """Should correctly parse each modality type."""
        mock_response = create_mock_attachment_dict(MODALITY_TEST_DATA[modality])
        mock_client.query.return_value = mock_response

        result = await attachments_api.get("attach-123")

        assert result is not None
        assert result.type == modality

        if modality in ("image", "video"):
            assert result.dimensions is not None
        if modality in ("audio", "video"):
            assert result.duration is not None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# get_url Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestGetUrl:
    """Tests for AttachmentsAPI.get_url() method."""

    @pytest.mark.asyncio
    async def test_get_url_returns_signed_url(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should return signed download URL."""
        mock_url = "https://convex.cloud/download/signed-url-abc123"
        mock_client.query.return_value = {"url": mock_url}

        result = await attachments_api.get_url("attach-abc123")

        assert result == mock_url

    @pytest.mark.asyncio
    async def test_get_url_returns_none_for_nonexistent(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should return None for non-existent attachment."""
        mock_client.query.return_value = None

        result = await attachments_api.get_url("non-existent")

        assert result is None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# list Tests - Filtering by Modality
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestList:
    """Tests for AttachmentsAPI.list() method."""

    @pytest.mark.asyncio
    async def test_list_all_attachments(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should list all attachments in memory space."""
        mock_response = {
            "attachments": [
                create_mock_attachment_dict(),
                create_mock_attachment_dict({"attachmentId": "attach-2"}),
            ],
            "total": 2,
            "hasMore": False,
        }
        mock_client.query.return_value = mock_response

        filter = ListAttachmentsFilter(memory_space_id="space-123")
        result = await attachments_api.list(filter)

        assert len(result.attachments) == 2
        assert result.total == 2
        assert result.has_more is False

    @pytest.mark.asyncio
    @pytest.mark.parametrize("modality", MODALITIES)
    async def test_list_filter_by_modality(
        self,
        attachments_api: AttachmentsAPI,
        mock_client: AsyncMock,
        modality: str,
    ):
        """Should filter by each modality type."""
        mock_response = {
            "attachments": [create_mock_attachment_dict(MODALITY_TEST_DATA[modality])],
            "total": 1,
            "hasMore": False,
        }
        mock_client.query.return_value = mock_response

        filter = ListAttachmentsFilter(memory_space_id="space-123", type=modality)
        result = await attachments_api.list(filter)

        assert result.attachments[0].type == modality
        call_args = mock_client.query.call_args[0][1]
        assert call_args["type"] == modality

    @pytest.mark.asyncio
    async def test_list_filter_by_conversation(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should filter by conversation."""
        mock_response = {
            "attachments": [create_mock_attachment_dict({"conversationId": "conv-123"})],
            "total": 1,
            "hasMore": False,
        }
        mock_client.query.return_value = mock_response

        filter = ListAttachmentsFilter(
            memory_space_id="space-123",
            conversation_id="conv-123",
        )
        await attachments_api.list(filter)

        call_args = mock_client.query.call_args[0][1]
        assert call_args["conversationId"] == "conv-123"

    @pytest.mark.asyncio
    async def test_list_filter_by_message(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should filter by message."""
        mock_response = {
            "attachments": [create_mock_attachment_dict({"messageId": "msg-456"})],
            "total": 1,
            "hasMore": False,
        }
        mock_client.query.return_value = mock_response

        filter = ListAttachmentsFilter(
            memory_space_id="space-123",
            message_id="msg-456",
        )
        await attachments_api.list(filter)

        call_args = mock_client.query.call_args[0][1]
        assert call_args["messageId"] == "msg-456"

    @pytest.mark.asyncio
    async def test_list_pagination(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should support pagination with cursor."""
        mock_response = {
            "attachments": [create_mock_attachment_dict()],
            "total": 100,
            "hasMore": True,
            "cursor": "cursor-page2",
        }
        mock_client.query.return_value = mock_response

        filter = ListAttachmentsFilter(memory_space_id="space-123", limit=10)
        result = await attachments_api.list(filter)

        assert result.has_more is True
        assert result.cursor == "cursor-page2"

    @pytest.mark.asyncio
    async def test_list_sorting(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should support sorting options."""
        mock_response = {"attachments": [], "total": 0, "hasMore": False}
        mock_client.query.return_value = mock_response

        filter = ListAttachmentsFilter(
            memory_space_id="space-123",
            sort_by="createdAt",
            sort_order="asc",
        )
        await attachments_api.list(filter)

        call_args = mock_client.query.call_args[0][1]
        assert call_args["sortBy"] == "createdAt"
        assert call_args["sortOrder"] == "asc"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# get_by_conversation / get_by_message Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestGetByConversation:
    """Tests for AttachmentsAPI.get_by_conversation() method."""

    @pytest.mark.asyncio
    async def test_get_all_conversation_attachments(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should get all attachments for a conversation."""
        mock_response = [
            create_mock_attachment_dict({"conversationId": "conv-123", "type": "image"}),
            create_mock_attachment_dict({
                "attachmentId": "attach-2",
                "conversationId": "conv-123",
                "type": "pdf",
            }),
        ]
        mock_client.query.return_value = mock_response

        result = await attachments_api.get_by_conversation("conv-123")

        assert len(result) == 2


class TestGetByMessage:
    """Tests for AttachmentsAPI.get_by_message() method."""

    @pytest.mark.asyncio
    async def test_get_all_message_attachments(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should get all attachments for a message."""
        mock_response = [
            create_mock_attachment_dict({"messageId": "msg-456", "type": "image"}),
        ]
        mock_client.query.return_value = mock_response

        result = await attachments_api.get_by_message("msg-456")

        assert len(result) == 1


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# count Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestCount:
    """Tests for AttachmentsAPI.count() method."""

    @pytest.mark.asyncio
    async def test_count_all_attachments(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should count all attachments in memory space."""
        # Convex backend returns raw number
        mock_client.query.return_value = 42

        result = await attachments_api.count(memory_space_id="space-123")

        assert result == 42

    @pytest.mark.asyncio
    @pytest.mark.parametrize("modality", MODALITIES)
    async def test_count_by_modality(
        self,
        attachments_api: AttachmentsAPI,
        mock_client: AsyncMock,
        modality: str,
    ):
        """Should count attachments by modality type."""
        mock_client.query.return_value = 10

        await attachments_api.count(memory_space_id="space-123", type=modality)

        call_args = mock_client.query.call_args[0][1]
        assert call_args["type"] == modality


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# delete / delete_many Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestDelete:
    """Tests for AttachmentsAPI.delete() method."""

    @pytest.mark.asyncio
    async def test_delete_attachment(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should delete attachment by ID."""
        mock_client.mutation.return_value = {"success": True}

        await attachments_api.delete("attach-abc123")

        call_args = mock_client.mutation.call_args[0][1]
        assert call_args["attachmentId"] == "attach-abc123"


class TestDeleteMany:
    """Tests for AttachmentsAPI.delete_many() method."""

    @pytest.mark.asyncio
    async def test_delete_multiple_attachments(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should delete multiple attachments."""
        mock_response = {"deleted": 3, "total": 3}
        mock_client.mutation.return_value = mock_response

        result = await attachments_api.delete_many(["attach-1", "attach-2", "attach-3"])

        assert result.deleted == 3
        assert result.total == 3

    @pytest.mark.asyncio
    async def test_delete_many_with_partial_failures(
        self, attachments_api: AttachmentsAPI, mock_client: AsyncMock
    ):
        """Should report partial failures."""
        mock_response = {
            "deleted": 2,
            "total": 3,
            "errors": [{"attachmentId": "attach-3", "error": "Not found"}],
        }
        mock_client.mutation.return_value = mock_response

        result = await attachments_api.delete_many(["attach-1", "attach-2", "attach-3"])

        assert result.deleted == 2
        assert len(result.errors) == 1
        assert result.errors[0]["attachmentId"] == "attach-3"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Multi-Tenancy Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestMultiTenancy:
    """Tests for multi-tenancy support."""

    @pytest.mark.asyncio
    async def test_tenant_id_included_in_all_operations(
        self,
        attachments_api_with_tenant: AttachmentsAPI,
        mock_client: AsyncMock,
    ):
        """Should include tenantId in all operations when auth context provided."""
        # Test attach
        mock_client.mutation.return_value = create_mock_attachment_dict(
            {"tenantId": "test-tenant"}
        )
        await attachments_api_with_tenant.attach(
            AttachParams(
                storage_id="storage-1",
                memory_space_id="space-1",
                user_id="user-1",
                type="image",
                mime_type="image/png",
                filename="test.png",
                size=1024,
            )
        )
        assert mock_client.mutation.call_args[0][1]["tenantId"] == "test-tenant"

        # Test get
        mock_client.query.return_value = create_mock_attachment_dict()
        await attachments_api_with_tenant.get("attach-123")
        assert mock_client.query.call_args[0][1]["tenantId"] == "test-tenant"

        # Test list
        mock_client.query.return_value = {"attachments": [], "total": 0, "hasMore": False}
        await attachments_api_with_tenant.list(
            ListAttachmentsFilter(memory_space_id="space-1")
        )
        assert mock_client.query.call_args[0][1]["tenantId"] == "test-tenant"

        # Test delete
        mock_client.mutation.return_value = {"success": True}
        await attachments_api_with_tenant.delete("attach-123")
        assert mock_client.mutation.call_args[0][1]["tenantId"] == "test-tenant"
