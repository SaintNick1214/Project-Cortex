"""
Unit Tests: Artifacts Python SDK

Tests for ArtifactsAPI class with mocked Convex client.
"""

from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cortex.artifacts import ArtifactsAPI, ArtifactsValidationError
from cortex.types import (
    AppendContentParams,
    AuthContext,
    CountArtifactsFilter,
    CreateArtifactOptions,
    FinalizeStreamingParams,
    ListArtifactsFilter,
    StartStreamingParams,
    UpdateArtifactOptions,
)


@pytest.fixture
def mock_client() -> AsyncMock:
    """Create a mock Convex client."""
    client = AsyncMock()
    client.mutation = AsyncMock()
    client.query = AsyncMock()
    return client


@pytest.fixture
def mock_graph_adapter() -> MagicMock:
    """Create a mock graph adapter."""
    adapter = MagicMock()
    adapter.sync_artifact = AsyncMock()
    return adapter


@pytest.fixture
def mock_auth_context() -> AuthContext:
    """Create a mock auth context."""
    return AuthContext(
        user_id="test-user",
        tenant_id="test-tenant",
    )


@pytest.fixture
def artifacts_api(
    mock_client: AsyncMock,
    mock_graph_adapter: MagicMock,
    mock_auth_context: AuthContext,
) -> ArtifactsAPI:
    """Create ArtifactsAPI instance with mocks."""
    return ArtifactsAPI(
        client=mock_client,
        graph_adapter=mock_graph_adapter,
        auth_context=mock_auth_context,
    )


@pytest.fixture
def mock_artifact_response() -> Dict[str, Any]:
    """Create a mock artifact response."""
    import time
    now = int(time.time() * 1000)
    return {
        "_id": "id_123",
        "artifactId": "art-abc123",
        "memorySpaceId": "space-123",
        "kind": "text",
        "title": "Test Artifact",
        "content": "Test content",
        "streamingState": "draft",
        "version": 1,
        "versionPointer": 1,
        "versionHistory": [
            {
                "version": 1,
                "content": "Test content",
                "title": "Test Artifact",
                "timestamp": now,
                "changeType": "create",
            }
        ],
        "tags": [],
        "createdAt": now,
        "updatedAt": now,
    }


class TestArtifactsAPICreate:
    """Tests for ArtifactsAPI.create() method."""

    @pytest.mark.asyncio
    async def test_create_success(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should create artifact with valid options."""
        mock_client.mutation.return_value = mock_artifact_response

        result = await artifacts_api.create(
            CreateArtifactOptions(
                title="Test Artifact",
                content="Test content",
                kind="text",
            )
        )

        assert result.artifact_id == "art-abc123"
        assert result.title == "Test Artifact"
        mock_client.mutation.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_validation_error_empty_title(
        self, artifacts_api: ArtifactsAPI
    ) -> None:
        """Should throw validation error for empty title."""
        with pytest.raises(ArtifactsValidationError, match="cannot be empty"):
            await artifacts_api.create(
                CreateArtifactOptions(
                    title="",
                    content="content",
                )
            )

    @pytest.mark.asyncio
    async def test_create_validation_error_missing_title(
        self, artifacts_api: ArtifactsAPI
    ) -> None:
        """Should throw validation error for missing title."""
        with pytest.raises(ArtifactsValidationError, match="title is required"):
            await artifacts_api.create(
                CreateArtifactOptions(
                    title=None,  # type: ignore
                    content="content",
                )
            )

    @pytest.mark.asyncio
    async def test_create_syncs_to_graph(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_graph_adapter: MagicMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should sync to graph adapter when available."""
        mock_client.mutation.return_value = mock_artifact_response

        await artifacts_api.create(
            CreateArtifactOptions(
                title="Test",
                content="content",
            )
        )

        mock_graph_adapter.sync_artifact.assert_called_once()


class TestArtifactsAPIGet:
    """Tests for ArtifactsAPI.get() method."""

    @pytest.mark.asyncio
    async def test_get_found(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should return artifact when found."""
        mock_client.query.return_value = mock_artifact_response

        result = await artifacts_api.get("art-abc123")

        assert result is not None
        assert result.artifact_id == "art-abc123"

    @pytest.mark.asyncio
    async def test_get_not_found(
        self, artifacts_api: ArtifactsAPI, mock_client: AsyncMock
    ) -> None:
        """Should return None when not found."""
        mock_client.query.return_value = None

        result = await artifacts_api.get("nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_validation_error_empty_id(
        self, artifacts_api: ArtifactsAPI
    ) -> None:
        """Should throw validation error for empty ID."""
        with pytest.raises(ArtifactsValidationError, match="cannot be empty"):
            await artifacts_api.get("")

    @pytest.mark.asyncio
    async def test_get_validation_error_invalid_format(
        self, artifacts_api: ArtifactsAPI
    ) -> None:
        """Should throw validation error for invalid ID format."""
        with pytest.raises(ArtifactsValidationError, match="Invalid.*format"):
            await artifacts_api.get("invalid@id")


class TestArtifactsAPIUpdate:
    """Tests for ArtifactsAPI.update() method."""

    @pytest.mark.asyncio
    async def test_update_success(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should update artifact content."""
        updated_response = {
            **mock_artifact_response,
            "content": "Updated content",
            "version": 2,
            "versionPointer": 2,
        }
        mock_client.mutation.return_value = updated_response

        result = await artifacts_api.update("art-abc123", "Updated content")

        assert result.version == 2
        assert result.content == "Updated content"

    @pytest.mark.asyncio
    async def test_update_with_options(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should update with options."""
        mock_client.mutation.return_value = {
            **mock_artifact_response,
            "title": "New Title",
        }

        await artifacts_api.update(
            "art-abc123",
            "content",
            UpdateArtifactOptions(title="New Title"),
        )

        mock_client.mutation.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_validation_error_empty_id(
        self, artifacts_api: ArtifactsAPI
    ) -> None:
        """Should throw validation error for empty artifactId."""
        with pytest.raises(ArtifactsValidationError):
            await artifacts_api.update("", "content")


class TestArtifactsAPIDelete:
    """Tests for ArtifactsAPI.delete() method."""

    @pytest.mark.asyncio
    async def test_soft_delete_default(
        self, artifacts_api: ArtifactsAPI, mock_client: AsyncMock
    ) -> None:
        """Should soft delete by default."""
        mock_client.mutation.return_value = {
            "deleted": True,
            "artifactId": "art-abc123",
            "permanent": False,
            "restorable": True,
        }

        result = await artifacts_api.delete("art-abc123")

        assert result["deleted"] is True
        assert result["permanent"] is False

    @pytest.mark.asyncio
    async def test_hard_delete(
        self, artifacts_api: ArtifactsAPI, mock_client: AsyncMock
    ) -> None:
        """Should hard delete when specified."""
        mock_client.mutation.return_value = {
            "deleted": True,
            "artifactId": "art-abc123",
            "permanent": True,
        }

        result = await artifacts_api.delete("art-abc123", hard=True)

        assert result["permanent"] is True

    @pytest.mark.asyncio
    async def test_delete_validation_error(
        self, artifacts_api: ArtifactsAPI
    ) -> None:
        """Should throw validation error for empty ID."""
        with pytest.raises(ArtifactsValidationError):
            await artifacts_api.delete("")


class TestArtifactsAPIList:
    """Tests for ArtifactsAPI.list() method."""

    @pytest.mark.asyncio
    async def test_list_success(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should list artifacts with filter."""
        mock_client.query.return_value = [mock_artifact_response]

        result = await artifacts_api.list(
            ListArtifactsFilter(
                kind="text",
            )
        )

        assert len(result) == 1
        assert result[0].kind == "text"

    @pytest.mark.asyncio
    async def test_list_validation_error_invalid_kind(
        self, artifacts_api: ArtifactsAPI
    ) -> None:
        """Should throw validation error for invalid kind."""
        with pytest.raises(ArtifactsValidationError, match="must be one of"):
            await artifacts_api.list(
                ListArtifactsFilter(
                    kind="invalid",  # type: ignore
                )
            )


class TestArtifactsAPICount:
    """Tests for ArtifactsAPI.count() method."""

    @pytest.mark.asyncio
    async def test_count_success(
        self, artifacts_api: ArtifactsAPI, mock_client: AsyncMock
    ) -> None:
        """Should return count."""
        mock_client.query.return_value = 5

        result = await artifacts_api.count(CountArtifactsFilter())

        assert result == 5


class TestArtifactsAPIUndo:
    """Tests for ArtifactsAPI.undo() method."""

    @pytest.mark.asyncio
    async def test_undo_success(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should undo successfully."""
        # Backend returns status object, not artifact
        mock_client.mutation.return_value = {
            "success": True,
            "artifactId": "art-abc123",
            "previousVersion": 2,
            "currentVersion": 1,
            "canUndo": False,
            "canRedo": True,
        }

        result = await artifacts_api.undo("art-abc123")

        assert result.success is True
        assert result.current_version == 1
        assert result.previous_version == 2
        assert result.can_redo is True

    @pytest.mark.asyncio
    async def test_undo_validation_error(
        self, artifacts_api: ArtifactsAPI
    ) -> None:
        """Should throw validation error for empty ID."""
        with pytest.raises(ArtifactsValidationError):
            await artifacts_api.undo("")


class TestArtifactsAPIRedo:
    """Tests for ArtifactsAPI.redo() method."""

    @pytest.mark.asyncio
    async def test_redo_success(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should redo successfully."""
        # Backend returns status object, not artifact
        mock_client.mutation.return_value = {
            "success": True,
            "artifactId": "art-abc123",
            "previousVersion": 1,
            "currentVersion": 2,
            "canUndo": True,
            "canRedo": False,
        }

        result = await artifacts_api.redo("art-abc123")

        assert result.success is True
        assert result.current_version == 2
        assert result.previous_version == 1
        assert result.can_undo is True


class TestArtifactsAPIGetHistory:
    """Tests for ArtifactsAPI.get_history() method."""

    @pytest.mark.asyncio
    async def test_get_history_success(
        self, artifacts_api: ArtifactsAPI, mock_client: AsyncMock
    ) -> None:
        """Should return version history."""
        import time
        now = int(time.time() * 1000)
        # ArtifactVersion only has: version, content, timestamp, changed_by, change_type, title, change_summary
        mock_client.query.return_value = {
            "history": [
                {"version": 1, "content": "v1", "timestamp": now, "changedBy": "user-1", "changeType": "create"},
                {"version": 2, "content": "v2", "timestamp": now, "changedBy": "user-1", "changeType": "update"},
            ],
            "artifactId": "art-abc123",
            "currentVersion": 2,
            "versionPointer": 2,
            "total": 2,
            "canUndo": True,
            "canRedo": False,
        }

        result = await artifacts_api.get_history("art-abc123")

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_get_history_validation_error(
        self, artifacts_api: ArtifactsAPI
    ) -> None:
        """Should throw validation error for empty ID."""
        with pytest.raises(ArtifactsValidationError):
            await artifacts_api.get_history("")


class TestArtifactsAPIGetVersion:
    """Tests for ArtifactsAPI.get_version() method."""

    @pytest.mark.asyncio
    async def test_get_version_success(
        self, artifacts_api: ArtifactsAPI, mock_client: AsyncMock
    ) -> None:
        """Should return specific version."""
        import time
        # ArtifactVersion only has: version, content, timestamp, changed_by, change_type
        mock_client.query.return_value = {
            "version": 2,
            "content": "v2 content",
            "timestamp": int(time.time() * 1000),
            "changedBy": "user-1",
            "changeType": "update",
        }

        result = await artifacts_api.get_version("art-abc123", 2)

        assert result is not None
        assert result.version == 2

    @pytest.mark.asyncio
    async def test_get_version_not_found(
        self, artifacts_api: ArtifactsAPI, mock_client: AsyncMock
    ) -> None:
        """Should return None for invalid version."""
        mock_client.query.return_value = None

        result = await artifacts_api.get_version("art-abc123", 999)

        assert result is None

    @pytest.mark.asyncio
    async def test_get_version_validation_error(
        self, artifacts_api: ArtifactsAPI
    ) -> None:
        """Should throw validation error for invalid version number."""
        with pytest.raises(ArtifactsValidationError):
            await artifacts_api.get_version("art-abc123", 0)


class TestArtifactsAPIStreaming:
    """Tests for ArtifactsAPI streaming methods."""

    @pytest.mark.asyncio
    async def test_start_streaming_success(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should start streaming session."""
        mock_client.mutation.return_value = {
            "sessionId": "stream-abc123",
            "artifact": mock_artifact_response,
        }

        result = await artifacts_api.start_streaming(
            StartStreamingParams(artifact_id="art-abc123")
        )

        assert result.session_id == "stream-abc123"

    @pytest.mark.asyncio
    async def test_start_streaming_validation_error(
        self, artifacts_api: ArtifactsAPI
    ) -> None:
        """Should throw validation error for empty artifactId."""
        with pytest.raises(ArtifactsValidationError):
            await artifacts_api.start_streaming(
                StartStreamingParams(artifact_id="")
            )

    @pytest.mark.asyncio
    async def test_append_content_success(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should append content chunk."""
        # Backend returns status object with streaming info
        mock_client.mutation.return_value = {
            "success": True,
            "artifactId": "art-abc123",
            "sessionId": "stream-abc123",
            "chunkBytes": 8,
            "totalBytesReceived": 20,
            "contentLength": 20,
            "timestamp": 1234567890000,
        }

        result = await artifacts_api.append_content(
            AppendContentParams(
                artifact_id="art-abc123",
                session_id="stream-abc123",
                chunk=" + chunk",
            )
        )

        assert result.success is True
        assert result.chunk_bytes == 8
        assert result.total_bytes_received == 20

    @pytest.mark.asyncio
    async def test_append_content_validation_error(
        self, artifacts_api: ArtifactsAPI
    ) -> None:
        """Should throw validation error for missing sessionId."""
        with pytest.raises(ArtifactsValidationError):
            await artifacts_api.append_content(
                AppendContentParams(
                    artifact_id="art-abc123",
                    session_id="",
                    chunk="content",
                )
            )

    @pytest.mark.asyncio
    async def test_pause_streaming(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should pause streaming."""
        paused_artifact = {**mock_artifact_response, "streamingState": "paused"}
        mock_client.mutation.return_value = paused_artifact

        result = await artifacts_api.pause_streaming("art-abc123", "stream-abc123")

        assert result.streaming_state == "paused"

    @pytest.mark.asyncio
    async def test_resume_streaming(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should resume streaming."""
        resumed_artifact = {**mock_artifact_response, "streamingState": "streaming"}
        mock_client.mutation.return_value = resumed_artifact

        result = await artifacts_api.resume_streaming("art-abc123", "stream-abc123")

        assert result.streaming_state == "streaming"

    @pytest.mark.asyncio
    async def test_cancel_streaming(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should cancel streaming."""
        cancelled_artifact = {**mock_artifact_response, "streamingState": "draft"}
        mock_client.mutation.return_value = cancelled_artifact

        result = await artifacts_api.cancel_streaming("art-abc123", "stream-abc123")

        assert result.streaming_state == "draft"

    @pytest.mark.asyncio
    async def test_finalize_streaming(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_graph_adapter: MagicMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should finalize streaming and sync to graph."""
        finalized_artifact = {
            **mock_artifact_response,
            "streamingState": "final",
            "version": 2,
        }
        mock_client.mutation.return_value = finalized_artifact

        result = await artifacts_api.finalize_streaming(
            FinalizeStreamingParams(
                artifact_id="art-abc123",
                session_id="stream-abc123",
            )
        )

        assert result.streaming_state == "final"
        mock_graph_adapter.sync_artifact.assert_called_once()


class TestArtifactsAPISetStreamingState:
    """Tests for ArtifactsAPI.set_streaming_state() method."""

    @pytest.mark.asyncio
    async def test_set_streaming_state_success(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should set streaming state."""
        updated_artifact = {**mock_artifact_response, "streamingState": "error"}
        mock_client.mutation.return_value = updated_artifact

        result = await artifacts_api.set_streaming_state("art-abc123", "error")

        assert result.streaming_state == "error"

    @pytest.mark.asyncio
    async def test_set_streaming_state_validation_error(
        self, artifacts_api: ArtifactsAPI
    ) -> None:
        """Should throw validation error for invalid state."""
        with pytest.raises(ArtifactsValidationError, match="must be one of"):
            await artifacts_api.set_streaming_state("art-abc123", "invalid")  # type: ignore


class TestSnakeCaseConversion:
    """Tests for snake_case parameter and response conversion."""

    @pytest.mark.asyncio
    async def test_response_converts_to_snake_case(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
    ) -> None:
        """Response should convert to snake_case."""
        import time
        now = int(time.time() * 1000)
        mock_client.mutation.return_value = {
            "_id": "convex_id_123",
            "artifactId": "art-123",
            "memorySpaceId": "space-1",
            "streamingState": "draft",
            "versionHistory": [],
            "versionPointer": 1,
            "createdAt": now,
            "updatedAt": now,
            "kind": "text",
            "title": "Test",
            "content": "Content",
            "version": 1,
            "tags": [],
        }

        result = await artifacts_api.create(
            CreateArtifactOptions(
                title="Test",
                content="Content",
            )
        )

        # Verify snake_case attributes
        assert hasattr(result, "artifact_id")
        assert hasattr(result, "memory_space_id")
        assert hasattr(result, "streaming_state")
        assert hasattr(result, "version_history")
        assert hasattr(result, "version_pointer")
        assert hasattr(result, "created_at")
        assert hasattr(result, "updated_at")


class TestFileOperations:
    """Tests for file operation methods."""

    @pytest.mark.asyncio
    async def test_get_file_url(
        self, artifacts_api: ArtifactsAPI, mock_client: AsyncMock
    ) -> None:
        """Should return file URL."""
        mock_client.query.return_value = "https://storage.example.com/file.png"

        result = await artifacts_api.get_file_url("art-abc123")

        assert result == "https://storage.example.com/file.png"

    @pytest.mark.asyncio
    async def test_get_file_url_not_found(
        self, artifacts_api: ArtifactsAPI, mock_client: AsyncMock
    ) -> None:
        """Should return None when no file."""
        mock_client.query.return_value = None

        result = await artifacts_api.get_file_url("art-abc123")

        assert result is None

    @pytest.mark.asyncio
    async def test_detach_file(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should detach file from artifact."""
        mock_client.mutation.return_value = mock_artifact_response

        result = await artifacts_api.detach_file("art-abc123")

        assert result is not None
        mock_client.mutation.assert_called_once()

    @pytest.mark.asyncio
    async def test_detach_file_with_delete(
        self,
        artifacts_api: ArtifactsAPI,
        mock_client: AsyncMock,
        mock_artifact_response: Dict[str, Any],
    ) -> None:
        """Should detach file and delete from storage."""
        mock_client.mutation.return_value = mock_artifact_response

        result = await artifacts_api.detach_file("art-abc123", delete_file=True)

        assert result is not None
        mock_client.mutation.assert_called_once()

    @pytest.mark.asyncio
    async def test_detach_file_validation_error(
        self, artifacts_api: ArtifactsAPI
    ) -> None:
        """Should throw validation error for empty artifact_id."""
        with pytest.raises(ArtifactsValidationError):
            await artifacts_api.detach_file("")
