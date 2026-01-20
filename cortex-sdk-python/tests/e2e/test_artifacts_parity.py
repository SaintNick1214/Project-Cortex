"""
E2E Tests: Python SDK Artifacts Parity

End-to-end tests verifying parity between TypeScript and Python SDKs:
- Create artifact via Python
- Read via Python, verify structure
- Update via Python
- Undo/Redo via Python
- Verify identical behavior to TypeScript SDK

Note: These tests require a live Convex backend.
Cross-SDK tests (TS creates, Python reads) should be in a separate integration test suite.
"""

import os
import time
from dataclasses import dataclass
from typing import List, Optional
from uuid import uuid4

import pytest

from cortex import Cortex, CortexConfig
from cortex.types import (
    AppendContentParams,
    CountArtifactsFilter,
    CreateArtifactOptions,
    FinalizeStreamingParams,
    ListArtifactsFilter,
    RegisterMemorySpaceParams,
    StartStreamingParams,
    UpdateArtifactOptions,
)

# Skip all tests if CONVEX_URL not configured
pytestmark = pytest.mark.skipif(
    not os.environ.get("CONVEX_URL"),
    reason="Requires CONVEX_URL environment variable"
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test Fixtures
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.fixture
def test_run_id():
    """Generate unique ID for test isolation."""
    return f"py-art-{uuid4().hex[:8]}"


@pytest.fixture
def memory_space_id(test_run_id):
    """Generate unique memory space ID."""
    return f"test-space-{test_run_id}"


@pytest.fixture
def user_id(test_run_id):
    """Generate unique user ID."""
    return f"test-user-{test_run_id}"


@pytest.fixture
async def cortex_client():
    """Create Cortex client for tests."""
    convex_url = os.environ.get("CONVEX_URL")
    client = Cortex(CortexConfig(convex_url=convex_url))
    yield client
    await client.close()


@dataclass
class TestContext:
    """Context for tracking test artifacts for cleanup."""
    artifact_ids: List[str]
    memory_space_id: str


@pytest.fixture
def test_context(memory_space_id):
    """Create test context for tracking artifacts."""
    return TestContext(artifact_ids=[], memory_space_id=memory_space_id)


@pytest.fixture
async def setup_memory_space(cortex_client, memory_space_id, test_run_id):
    """Set up memory space for tests."""
    await cortex_client.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=memory_space_id,
            name=f"Python Artifacts E2E Test Space {test_run_id}",
            type="custom",
        )
    )
    yield memory_space_id
    # Cleanup
    try:
        await cortex_client.memory_spaces.delete(
            memory_space_id,
            cascade=True,
            reason="Test cleanup",
        )
    except Exception:
        pass


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Parity Tests - Core CRUD Operations
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestArtifactsCRUDParity:
    """Test CRUD operations match TypeScript SDK behavior."""

    async def test_create_artifact_structure(
        self,
        cortex_client: Cortex,
        setup_memory_space: str,
        test_context: TestContext,
    ):
        """
        Test that Python SDK creates artifacts with identical structure to TypeScript.

        Expected structure:
        - artifact_id: starts with "art-"
        - version: 1 for new artifact
        - version_pointer: 1 for new artifact
        - streaming_state: matches input
        - content: matches input
        - kind: matches input
        - created_at/updated_at: populated timestamps
        """
        artifact = await cortex_client.artifacts.create(
            CreateArtifactOptions(
                memory_space_id=setup_memory_space,
                title="Parity Test Artifact",
                content="console.log('Hello from Python SDK');",
                kind="code",
                streaming_state="final",
                tags=["parity", "test", "python"],
                metadata={
                    "language": "javascript",
                    "created_by": "python_e2e_test",
                },
            )
        )

        test_context.artifact_ids.append(artifact.artifact_id)

        # Verify artifact_id format (parity with TS)
        assert artifact.artifact_id.startswith("art-")

        # Verify version fields (parity with TS)
        assert artifact.version == 1
        assert artifact.version_pointer == 1

        # Verify content and metadata (parity with TS)
        assert artifact.content == "console.log('Hello from Python SDK');"
        assert artifact.title == "Parity Test Artifact"
        assert artifact.kind == "code"
        assert artifact.streaming_state == "final"

        # Verify timestamps (parity with TS)
        assert artifact.created_at is not None
        assert artifact.updated_at is not None
        assert isinstance(artifact.created_at, int)
        assert isinstance(artifact.updated_at, int)

        # Verify tags (parity with TS)
        assert "parity" in artifact.tags
        assert "python" in artifact.tags

        # Verify metadata (parity with TS)
        assert artifact.metadata is not None
        assert artifact.metadata.get("language") == "javascript"

    async def test_get_artifact_returns_none_for_missing(
        self,
        cortex_client: Cortex,
    ):
        """
        Test that getting non-existent artifact returns None.

        TypeScript returns null, Python returns None - both are "not found" semantics.
        """
        result = await cortex_client.artifacts.get("art-nonexistent-12345")
        assert result is None

    async def test_update_creates_new_version(
        self,
        cortex_client: Cortex,
        setup_memory_space: str,
        test_context: TestContext,
    ):
        """
        Test that update creates new version (parity with TypeScript).
        """
        # Create initial artifact
        artifact = await cortex_client.artifacts.create(
            CreateArtifactOptions(
                memory_space_id=setup_memory_space,
                title="Version Test",
                content="Version 1 content",
                kind="text",
                streaming_state="final",
            )
        )
        test_context.artifact_ids.append(artifact.artifact_id)

        # Update artifact
        updated = await cortex_client.artifacts.update(
            artifact.artifact_id,
            "Version 2 content",
            UpdateArtifactOptions(
                title="Version Test - Updated",
                changed_by="python_test",
            ),
        )

        # Verify version incremented (parity with TS)
        assert updated.version == 2
        assert updated.version_pointer == 2
        assert updated.content == "Version 2 content"
        assert updated.title == "Version Test - Updated"

    async def test_delete_soft_and_hard(
        self,
        cortex_client: Cortex,
        setup_memory_space: str,
    ):
        """
        Test soft and hard delete (parity with TypeScript).
        """
        # Create artifact for soft delete test
        artifact = await cortex_client.artifacts.create(
            CreateArtifactOptions(
                memory_space_id=setup_memory_space,
                title="Delete Test",
                content="To be deleted",
                kind="text",
                streaming_state="final",
            )
        )

        # Soft delete
        result = await cortex_client.artifacts.delete(artifact.artifact_id, hard=False)
        assert result.get("deleted") is True

        # Hard delete (cleanup)
        result = await cortex_client.artifacts.delete(artifact.artifact_id, hard=True)
        assert result.get("deleted") is True


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Parity Tests - Version History
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestVersionHistoryParity:
    """Test version history operations match TypeScript SDK behavior."""

    async def test_undo_redo_cycle(
        self,
        cortex_client: Cortex,
        setup_memory_space: str,
        test_context: TestContext,
    ):
        """
        Test undo/redo cycle (parity with TypeScript).
        """
        # Create artifact with v1
        artifact = await cortex_client.artifacts.create(
            CreateArtifactOptions(
                memory_space_id=setup_memory_space,
                title="Undo Redo Test",
                content="Version 1",
                kind="text",
                streaming_state="final",
            )
        )
        test_context.artifact_ids.append(artifact.artifact_id)

        # Update to v2
        await cortex_client.artifacts.update(artifact.artifact_id, "Version 2")

        # Verify at v2
        current = await cortex_client.artifacts.get(artifact.artifact_id)
        assert current is not None
        assert current.version_pointer == 2
        assert current.content == "Version 2"

        # Undo to v1 - returns UndoRedoResult, not Artifact
        undo_result = await cortex_client.artifacts.undo(artifact.artifact_id)
        assert undo_result.success is True
        assert undo_result.current_version == 1
        assert undo_result.previous_version == 2

        # Fetch to verify content
        undone = await cortex_client.artifacts.get(artifact.artifact_id)
        assert undone is not None
        assert undone.content == "Version 1"

        # Redo to v2 - returns UndoRedoResult, not Artifact
        redo_result = await cortex_client.artifacts.redo(artifact.artifact_id)
        assert redo_result.success is True
        assert redo_result.current_version == 2
        assert redo_result.previous_version == 1

        # Fetch to verify content
        redone = await cortex_client.artifacts.get(artifact.artifact_id)
        assert redone is not None
        assert redone.content == "Version 2"

    async def test_get_history_returns_all_versions(
        self,
        cortex_client: Cortex,
        setup_memory_space: str,
        test_context: TestContext,
    ):
        """
        Test get_history returns all versions (parity with TypeScript).
        """
        # Create artifact with multiple versions
        artifact = await cortex_client.artifacts.create(
            CreateArtifactOptions(
                memory_space_id=setup_memory_space,
                title="History Test",
                content="v1",
                kind="text",
                streaming_state="final",
            )
        )
        test_context.artifact_ids.append(artifact.artifact_id)

        # Create more versions
        for i in range(2, 5):
            await cortex_client.artifacts.update(artifact.artifact_id, f"v{i}")

        # Get history
        history = await cortex_client.artifacts.get_history(artifact.artifact_id)

        # Verify (parity with TS)
        assert len(history) == 4

        for i, version in enumerate(history, 1):
            assert version.version == i
            assert version.content == f"v{i}"

    async def test_get_specific_version(
        self,
        cortex_client: Cortex,
        setup_memory_space: str,
        test_context: TestContext,
    ):
        """
        Test get_version retrieves specific version (parity with TypeScript).
        """
        # Create artifact with multiple versions
        artifact = await cortex_client.artifacts.create(
            CreateArtifactOptions(
                memory_space_id=setup_memory_space,
                title="Specific Version Test",
                content="Version 1 - original",
                kind="text",
                streaming_state="final",
            )
        )
        test_context.artifact_ids.append(artifact.artifact_id)

        await cortex_client.artifacts.update(artifact.artifact_id, "Version 2 - updated")
        await cortex_client.artifacts.update(artifact.artifact_id, "Version 3 - final")

        # Get specific versions (parity with TS)
        v1 = await cortex_client.artifacts.get_version(artifact.artifact_id, 1)
        v2 = await cortex_client.artifacts.get_version(artifact.artifact_id, 2)
        v3 = await cortex_client.artifacts.get_version(artifact.artifact_id, 3)

        assert v1.content == "Version 1 - original"
        assert v2.content == "Version 2 - updated"
        assert v3.content == "Version 3 - final"

        # Non-existent version returns None (parity with TS returning null)
        v99 = await cortex_client.artifacts.get_version(artifact.artifact_id, 99)
        assert v99 is None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Parity Tests - Streaming Operations
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestStreamingParity:
    """Test streaming operations match TypeScript SDK behavior."""

    async def test_streaming_lifecycle(
        self,
        cortex_client: Cortex,
        setup_memory_space: str,
        test_context: TestContext,
    ):
        """
        Test complete streaming lifecycle (parity with TypeScript).
        """
        # Create artifact in draft state
        artifact = await cortex_client.artifacts.create(
            CreateArtifactOptions(
                memory_space_id=setup_memory_space,
                title="Streaming Test",
                content="",
                kind="code",
                streaming_state="draft",
            )
        )
        test_context.artifact_ids.append(artifact.artifact_id)

        # Start streaming (parity with TS)
        result = await cortex_client.artifacts.start_streaming(
            StartStreamingParams(artifact_id=artifact.artifact_id)
        )

        assert result.session_id is not None
        assert result.artifact.streaming_state == "streaming"

        session_id = result.session_id

        # Append content chunks (parity with TS)
        # Note: append_content returns AppendContentResult with status, not Artifact
        chunks = ["def hello():", "\n    ", 'return "Hello"']
        total_bytes = 0

        for chunk in chunks:
            total_bytes += len(chunk.encode('utf-8'))
            append_result = await cortex_client.artifacts.append_content(
                AppendContentParams(
                    artifact_id=artifact.artifact_id,
                    session_id=session_id,
                    chunk=chunk,
                )
            )
            assert append_result.success is True
            assert append_result.total_bytes_received == total_bytes

        # Finalize (parity with TS)
        finalized = await cortex_client.artifacts.finalize_streaming(
            FinalizeStreamingParams(
                artifact_id=artifact.artifact_id,
                session_id=session_id,
            )
        )

        assert finalized.streaming_state == "final"
        assert finalized.content == 'def hello():\n    return "Hello"'

    async def test_pause_resume_streaming(
        self,
        cortex_client: Cortex,
        setup_memory_space: str,
        test_context: TestContext,
    ):
        """
        Test pause and resume streaming (parity with TypeScript).
        """
        # Create and start streaming
        artifact = await cortex_client.artifacts.create(
            CreateArtifactOptions(
                memory_space_id=setup_memory_space,
                title="Pause Resume Test",
                content="",
                kind="text",
                streaming_state="draft",
            )
        )
        test_context.artifact_ids.append(artifact.artifact_id)

        result = await cortex_client.artifacts.start_streaming(
            StartStreamingParams(artifact_id=artifact.artifact_id)
        )
        session_id = result.session_id

        # Append some content
        await cortex_client.artifacts.append_content(
            AppendContentParams(
                artifact_id=artifact.artifact_id,
                session_id=session_id,
                chunk="First part. ",
            )
        )

        # Pause (parity with TS)
        paused = await cortex_client.artifacts.pause_streaming(
            artifact.artifact_id, session_id
        )
        assert paused.streaming_state == "paused"

        # Resume (parity with TS)
        resumed = await cortex_client.artifacts.resume_streaming(
            artifact.artifact_id, session_id
        )
        assert resumed.streaming_state == "streaming"

        # Continue and finalize
        await cortex_client.artifacts.append_content(
            AppendContentParams(
                artifact_id=artifact.artifact_id,
                session_id=session_id,
                chunk="Second part.",
            )
        )

        finalized = await cortex_client.artifacts.finalize_streaming(
            FinalizeStreamingParams(
                artifact_id=artifact.artifact_id,
                session_id=session_id,
            )
        )

        assert finalized.content == "First part. Second part."


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Parity Tests - List and Count
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestListCountParity:
    """Test list and count operations match TypeScript SDK behavior."""

    async def test_list_with_filters(
        self,
        cortex_client: Cortex,
        setup_memory_space: str,
        test_context: TestContext,
    ):
        """
        Test list with various filters (parity with TypeScript).
        """
        # Create test artifacts
        for i in range(3):
            artifact = await cortex_client.artifacts.create(
                CreateArtifactOptions(
                    memory_space_id=setup_memory_space,
                    title=f"List Test {i}",
                    content=f"Content {i}",
                    kind="code" if i % 2 == 0 else "text",
                    streaming_state="final",
                    tags=["list-test", f"item-{i}"],
                )
            )
            test_context.artifact_ids.append(artifact.artifact_id)

        # List by kind (parity with TS)
        code_artifacts = await cortex_client.artifacts.list(
            ListArtifactsFilter(
                memory_space_id=setup_memory_space,
                kind="code",
            )
        )

        assert all(a.kind == "code" for a in code_artifacts)

        # List by tags (parity with TS)
        tagged = await cortex_client.artifacts.list(
            ListArtifactsFilter(
                memory_space_id=setup_memory_space,
                tags=["list-test"],
            )
        )

        assert len(tagged) >= 3

    async def test_count_artifacts(
        self,
        cortex_client: Cortex,
        setup_memory_space: str,
        test_context: TestContext,
    ):
        """
        Test count operation (parity with TypeScript).
        """
        # Create test artifacts
        for i in range(5):
            artifact = await cortex_client.artifacts.create(
                CreateArtifactOptions(
                    memory_space_id=setup_memory_space,
                    title=f"Count Test {i}",
                    content=f"Content {i}",
                    kind="text",
                    streaming_state="final",
                    tags=["count-test"],
                )
            )
            test_context.artifact_ids.append(artifact.artifact_id)

        # Count (parity with TS)
        count = await cortex_client.artifacts.count(
            CountArtifactsFilter(
                memory_space_id=setup_memory_space,
                tags=["count-test"],
            )
        )

        assert count >= 5


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Parity Tests - Error Handling
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestErrorHandlingParity:
    """Test error handling matches TypeScript SDK behavior."""

    async def test_undo_at_first_version_throws(
        self,
        cortex_client: Cortex,
        setup_memory_space: str,
        test_context: TestContext,
    ):
        """
        Test undo at version 1 throws UNDO_NOT_AVAILABLE (parity with TypeScript).
        """
        # Create artifact at v1
        artifact = await cortex_client.artifacts.create(
            CreateArtifactOptions(
                memory_space_id=setup_memory_space,
                title="Undo Error Test",
                content="Only version",
                kind="text",
                streaming_state="final",
            )
        )
        test_context.artifact_ids.append(artifact.artifact_id)

        # Try to undo - should raise error (parity with TS)
        with pytest.raises(Exception) as exc_info:
            await cortex_client.artifacts.undo(artifact.artifact_id)

        assert "UNDO_NOT_AVAILABLE" in str(exc_info.value)

    async def test_redo_at_latest_version_throws(
        self,
        cortex_client: Cortex,
        setup_memory_space: str,
        test_context: TestContext,
    ):
        """
        Test redo at latest version throws REDO_NOT_AVAILABLE (parity with TypeScript).
        """
        # Create artifact at v1
        artifact = await cortex_client.artifacts.create(
            CreateArtifactOptions(
                memory_space_id=setup_memory_space,
                title="Redo Error Test",
                content="Only version",
                kind="text",
                streaming_state="final",
            )
        )
        test_context.artifact_ids.append(artifact.artifact_id)

        # Try to redo - should raise error (parity with TS)
        with pytest.raises(Exception) as exc_info:
            await cortex_client.artifacts.redo(artifact.artifact_id)

        assert "REDO_NOT_AVAILABLE" in str(exc_info.value)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Field Name Parity Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestFieldNameParity:
    """
    Test that Python field names (snake_case) correctly map to
    TypeScript field names (camelCase) in the backend.
    """

    async def test_field_name_mapping(
        self,
        cortex_client: Cortex,
        setup_memory_space: str,
        test_context: TestContext,
    ):
        """
        Verify Python snake_case maps to TypeScript camelCase:
        - artifact_id ↔ artifactId
        - memory_space_id ↔ memorySpaceId
        - streaming_state ↔ streamingState
        - version_pointer ↔ versionPointer
        - created_at ↔ createdAt
        - updated_at ↔ updatedAt
        """
        artifact = await cortex_client.artifacts.create(
            CreateArtifactOptions(
                memory_space_id=setup_memory_space,
                title="Field Mapping Test",
                content="Testing field name parity",
                kind="text",
                streaming_state="final",
            )
        )
        test_context.artifact_ids.append(artifact.artifact_id)

        # Python uses snake_case - these should all be accessible
        assert hasattr(artifact, "artifact_id")
        assert hasattr(artifact, "memory_space_id")
        assert hasattr(artifact, "streaming_state")
        assert hasattr(artifact, "version_pointer")
        assert hasattr(artifact, "created_at")
        assert hasattr(artifact, "updated_at")

        # Values should be properly populated
        assert artifact.artifact_id is not None
        assert artifact.streaming_state == "final"
        assert artifact.version_pointer == 1
        assert artifact.created_at > 0
        assert artifact.updated_at > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
