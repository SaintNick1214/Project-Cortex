"""
Cortex SDK - Artifacts API

Versioned content management with undo/redo, streaming support, and file attachments.
"""

from typing import Any, Dict, List, Optional, cast

from .._utils import convert_convex_response, filter_none_values
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..types import (
    AppendContentParams,
    AppendContentResult,
    Artifact,
    ArtifactVersion,
    AuthContext,
    CancelStreamingResult,
    CountArtifactsFilter,
    CreateArtifactOptions,
    DetachFileResult,
    FileReference,
    FinalizeStreamingParams,
    FinalizeStreamingResult,
    ListArtifactsFilter,
    PauseStreamingResult,
    ResumeStreamingResult,
    SetStreamingStateResult,
    StartStreamingParams,
    StartStreamingResult,
    StreamingState,
    UndoRedoResult,
    UpdateArtifactOptions,
)
from .validators import (
    ArtifactsValidationError,
    validate_append_content_params,
    validate_artifact_id,
    validate_content,
    validate_count_filter,
    validate_create_options,
    validate_file_reference,
    validate_list_filter,
    validate_session_id,
    validate_start_streaming_params,
    validate_streaming_state,
    validate_update_options,
    validate_version,
)

__all__ = ["ArtifactsAPI", "ArtifactsValidationError"]


def _is_artifact_not_found_error(e: Exception) -> bool:
    """Check if an exception indicates an artifact was not found.

    Args:
        e: The exception to check

    Returns:
        True if this is a "not found" error
    """
    error_str = str(e)
    return (
        "ARTIFACT_NOT_FOUND" in error_str
        or "artifact not found" in error_str.lower()
    )


class ArtifactsAPI:
    """
    Artifacts API - Versioned Content Management

    Provides versioned content objects with undo/redo operations, streaming support,
    and file attachments. Perfect for documents, code snippets, and agent-generated content.

    Features:
        - Version history with undo/redo
        - Streaming support for real-time content generation
        - File attachments
        - Full-text search
        - Multi-tenancy support

    Example:
        >>> from cortex.types import CreateArtifactOptions
        >>> artifact = await cortex.artifacts.create(
        ...     CreateArtifactOptions(
        ...         title="Code Review",
        ...         content="# Code Review\\n\\nLGTM!",
        ...         kind="code",
        ...         tags=["review", "approved"],
        ...     )
        ... )
        >>> print(f"Created artifact {artifact.artifact_id}")
    """

    def __init__(
        self,
        client: Any,
        graph_adapter: Optional[Any] = None,
        resilience: Optional[Any] = None,
        auth_context: Optional[AuthContext] = None,
    ) -> None:
        """
        Initialize Artifacts API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for sync
            resilience: Optional resilience layer for overload protection
            auth_context: Optional auth context for multi-tenancy
        """
        self.client = client
        self.graph_adapter = graph_adapter
        self._resilience = resilience
        self._auth_context = auth_context

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

    @property
    def _tenant_id(self) -> Optional[str]:
        """Get tenant_id from auth context (for multi-tenancy)."""
        return self._auth_context.tenant_id if self._auth_context else None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Core CRUD Operations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def create(self, options: CreateArtifactOptions) -> Artifact:
        """
        Create a new artifact.

        Args:
            options: Creation options including title, content, kind, etc.

        Returns:
            The created Artifact

        Raises:
            ArtifactsValidationError: If validation fails
            CortexError: If backend operation fails

        Example:
            >>> from cortex.types import CreateArtifactOptions
            >>> artifact = await cortex.artifacts.create(
            ...     CreateArtifactOptions(
            ...         title="Meeting Notes",
            ...         content="# Team Standup\\n\\n- Discussed roadmap...",
            ...         kind="text",
            ...         tags=["meetings", "team"],
            ...     )
            ... )
            >>> print(f"Created artifact {artifact.artifact_id} v{artifact.version}")
        """
        # Client-side validation
        validate_create_options(options)

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "artifacts:create",
                filter_none_values({
                    "title": options.title,
                    "content": options.content,
                    "kind": options.kind,
                    "artifactId": options.artifact_id,
                    "streamingState": options.streaming_state,
                    "userId": options.user_id,
                    "memorySpaceId": options.memory_space_id,
                    "tenantId": self._tenant_id,
                    "metadata": options.metadata,
                    "tags": options.tags,
                }),
            ),
            "artifacts:create",
        )

        artifact = Artifact(**convert_convex_response(result))

        # Sync to graph if adapter present
        if self.graph_adapter:
            try:
                await self.graph_adapter.sync_artifact(artifact)
            except Exception as e:
                import warnings
                warnings.warn(f"Failed to sync artifact to graph: {e}")

        return artifact

    async def get(self, artifact_id: str) -> Optional[Artifact]:
        """
        Get an artifact by ID.

        Args:
            artifact_id: The artifact's unique identifier

        Returns:
            The Artifact if found, None otherwise

        Example:
            >>> artifact = await cortex.artifacts.get("meeting-notes-2024")
            >>> if artifact:
            ...     print(f"Found: {artifact.title} (v{artifact.version})")
        """
        # Client-side validation
        validate_artifact_id(artifact_id)

        try:
            # Backend retrieves artifact by ID - no need for memory_space_id
            result = await self._execute_with_resilience(
                lambda: self.client.query(
                    "artifacts:get",
                    filter_none_values({
                        "artifactId": artifact_id,
                        "tenantId": self._tenant_id,
                    }),
                ),
                "artifacts:get",
            )

            if not result:
                return None

            return Artifact(**convert_convex_response(result))

        except Exception as e:
            if _is_artifact_not_found_error(e):
                return None
            raise

    async def update(
        self,
        artifact_id: str,
        content: str,
        options: Optional[UpdateArtifactOptions] = None,
    ) -> Artifact:
        """
        Update an artifact's content (creates new version).

        Args:
            artifact_id: The artifact's unique identifier
            content: New content for the artifact
            options: Optional update settings (title, metadata, tags)

        Returns:
            The updated Artifact with incremented version

        Raises:
            ArtifactsValidationError: If validation fails
            CortexError: If artifact not found or update fails

        Example:
            >>> from cortex.types import UpdateArtifactOptions
            >>> artifact = await cortex.artifacts.update(
            ...     "meeting-notes-2024",
            ...     "# Team Standup (Updated)\\n\\n- New action items...",
            ...     UpdateArtifactOptions(
            ...         title="Meeting Notes - Updated",
            ...         metadata={"reviewed": True},
            ...     )
            ... )
            >>> print(f"Updated to v{artifact.version}")
        """
        # Client-side validation
        validate_artifact_id(artifact_id)
        validate_content(content, required=True)
        validate_update_options(options)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "artifacts:update",
                filter_none_values({
                    "artifactId": artifact_id,
                    "content": content,
                    "title": options.title if options else None,
                    "metadata": options.metadata if options else None,
                    "tags": options.tags if options else None,
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:update",
        )

        artifact = Artifact(**convert_convex_response(result))

        # Sync to graph if adapter present
        if self.graph_adapter:
            try:
                await self.graph_adapter.sync_artifact(artifact)
            except Exception as e:
                import warnings
                warnings.warn(f"Failed to sync artifact update to graph: {e}")

        return artifact

    async def delete(self, artifact_id: str, hard: bool = False) -> Dict[str, Any]:
        """
        Delete an artifact.

        Args:
            artifact_id: The artifact's unique identifier
            hard: If True, permanently delete. If False (default), soft delete.

        Returns:
            Deletion result with deleted flag and artifact_id

        Raises:
            ArtifactsValidationError: If validation fails
            CortexError: If artifact not found or delete fails

        Example:
            >>> result = await cortex.artifacts.delete("old-draft-doc")
            >>> if result["deleted"]:
            ...     print(f"Deleted artifact {result['artifact_id']}")
        """
        # Client-side validation
        validate_artifact_id(artifact_id)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "artifacts:deleteArtifact",
                filter_none_values({
                    "artifactId": artifact_id,
                    "hard": hard,
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:delete",
        )

        return cast(Dict[str, Any], result)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # List and Count Operations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def list(self, filter: ListArtifactsFilter) -> List[Artifact]:
        """
        List artifacts matching filter criteria.

        Args:
            filter: Filter options for listing artifacts

        Returns:
            List of matching Artifact objects

        Example:
            >>> from cortex.types import ListArtifactsFilter
            >>> artifacts = await cortex.artifacts.list(
            ...     ListArtifactsFilter(
            ...         kind="code",
            ...         streaming_state="final",
            ...         tags=["important"],
            ...         sort_by="updatedAt",
            ...         sort_order="desc",
            ...         limit=20,
            ...     )
            ... )
            >>> for artifact in artifacts:
            ...     print(f"- {artifact.title} (v{artifact.version})")
        """
        # Client-side validation
        validate_list_filter(filter)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "artifacts:list",
                filter_none_values({
                    "kind": filter.kind,
                    "streamingState": filter.streaming_state,
                    "userId": filter.user_id,
                    "memorySpaceId": filter.memory_space_id,
                    "tags": filter.tags,
                    "createdAfter": filter.created_after,
                    "createdBefore": filter.created_before,
                    "updatedAfter": filter.updated_after,
                    "updatedBefore": filter.updated_before,
                    "limit": filter.limit,
                    "offset": filter.offset,
                    "sortBy": filter.sort_by,
                    "sortOrder": filter.sort_order,
                    "tenantId": filter.tenant_id if filter.tenant_id else self._tenant_id,
                }),
            ),
            "artifacts:list",
        )

        # Backend returns {artifacts: [...], total, limit, offset, hasMore}
        artifacts_list = result.get("artifacts", []) if isinstance(result, dict) else result
        return [Artifact(**convert_convex_response(item)) for item in artifacts_list]

    async def count(self, filter: CountArtifactsFilter) -> int:
        """
        Count artifacts matching filter criteria.

        Args:
            filter: Filter options for counting artifacts

        Returns:
            Count of matching artifacts

        Example:
            >>> from cortex.types import CountArtifactsFilter
            >>> draft_count = await cortex.artifacts.count(
            ...     CountArtifactsFilter(streaming_state="draft")
            ... )
            >>> print(f"You have {draft_count} draft artifacts")
        """
        # Client-side validation
        validate_count_filter(filter)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "artifacts:count",
                filter_none_values({
                    "kind": filter.kind,
                    "streamingState": filter.streaming_state,
                    "userId": filter.user_id,
                    "memorySpaceId": filter.memory_space_id,
                    # Note: tags filter not supported by backend count endpoint
                    "createdAfter": filter.created_after,
                    "createdBefore": filter.created_before,
                    "tenantId": filter.tenant_id if filter.tenant_id else self._tenant_id,
                }),
            ),
            "artifacts:count",
        )

        return int(result)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Version History Operations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def undo(self, artifact_id: str) -> UndoRedoResult:
        """
        Undo the last change (revert to previous version).

        Args:
            artifact_id: The artifact's unique identifier

        Returns:
            UndoRedoResult with version info and undo/redo availability

        Raises:
            CortexError: If no previous version exists or undo fails

        Example:
            >>> # Revert to previous version
            >>> result = await cortex.artifacts.undo("meeting-notes-2024")
            >>> print(f"Reverted from v{result.previous_version} to v{result.current_version}")
            >>> print(f"Can undo: {result.can_undo}, Can redo: {result.can_redo}")
        """
        # Client-side validation
        validate_artifact_id(artifact_id)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "artifacts:undo",
                filter_none_values({
                    "artifactId": artifact_id,
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:undo",
        )

        return UndoRedoResult(**convert_convex_response(result))

    async def redo(self, artifact_id: str) -> UndoRedoResult:
        """
        Redo a previously undone change.

        Args:
            artifact_id: The artifact's unique identifier

        Returns:
            UndoRedoResult with version info and undo/redo availability

        Raises:
            CortexError: If no redo available or redo fails

        Example:
            >>> # Redo after an undo
            >>> result = await cortex.artifacts.redo("meeting-notes-2024")
            >>> print(f"Restored from v{result.previous_version} to v{result.current_version}")
            >>> print(f"Can undo: {result.can_undo}, Can redo: {result.can_redo}")
        """
        # Client-side validation
        validate_artifact_id(artifact_id)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "artifacts:redo",
                filter_none_values({
                    "artifactId": artifact_id,
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:redo",
        )

        return UndoRedoResult(**convert_convex_response(result))

    async def get_history(self, artifact_id: str) -> List[ArtifactVersion]:
        """
        Get the version history of an artifact.

        Args:
            artifact_id: The artifact's unique identifier

        Returns:
            List of ArtifactVersion objects (oldest first)

        Example:
            >>> history = await cortex.artifacts.get_history("meeting-notes-2024")
            >>> for version in history:
            ...     print(f"v{version.version}: {version.change_type} by {version.changed_by}")
        """
        # Client-side validation
        validate_artifact_id(artifact_id)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "artifacts:getHistory",
                filter_none_values({
                    "artifactId": artifact_id,
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:getHistory",
        )

        # Backend returns { history: [...], ... } - extract history array
        history = result.get("history", []) if isinstance(result, dict) else result
        return [ArtifactVersion(**convert_convex_response(v)) for v in history]

    async def get_version(self, artifact_id: str, version: int) -> Optional[ArtifactVersion]:
        """
        Get a specific version of an artifact.

        Args:
            artifact_id: The artifact's unique identifier
            version: Version number to retrieve (1-indexed)

        Returns:
            ArtifactVersion if found, None otherwise

        Example:
            >>> version = await cortex.artifacts.get_version("meeting-notes-2024", 2)
            >>> if version:
            ...     print(f"v{version.version}: {version.content[:100]}...")
        """
        # Client-side validation
        validate_artifact_id(artifact_id)
        validate_version(version)

        try:
            # Backend retrieves artifact by ID - no need for memory_space_id
            result = await self._execute_with_resilience(
                lambda: self.client.query(
                    "artifacts:getVersion",
                    filter_none_values({
                        "artifactId": artifact_id,
                        "version": version,
                        "tenantId": self._tenant_id,
                    }),
                ),
                "artifacts:getVersion",
            )

            if not result:
                return None

            return ArtifactVersion(**convert_convex_response(result))

        except Exception as e:
            if "VERSION_NOT_FOUND" in str(e) or "version not found" in str(e).lower():
                return None
            raise

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Streaming Operations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def start_streaming(self, params: StartStreamingParams) -> StartStreamingResult:
        """
        Start a streaming session for an artifact.

        This transitions the artifact to 'streaming' state and returns a session ID
        for subsequent append_content calls.

        Args:
            params: Streaming parameters including artifact_id

        Returns:
            StartStreamingResult with session_id for appending content

        Example:
            >>> from cortex.types import StartStreamingParams
            >>> result = await cortex.artifacts.start_streaming(
            ...     StartStreamingParams(artifact_id="code-gen-001")
            ... )
            >>> print(f"Started streaming session: {result.session_id}")
        """
        # Client-side validation
        validate_start_streaming_params(params)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "artifacts:startStreaming",
                filter_none_values({
                    "artifactId": params.artifact_id,
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:startStreaming",
        )

        return StartStreamingResult(**convert_convex_response(result))

    async def append_content(self, params: AppendContentParams) -> AppendContentResult:
        """
        Append content chunk to a streaming artifact.

        Args:
            params: Parameters including artifact_id, session_id, and chunk

        Returns:
            AppendContentResult with chunk status and progress info

        Example:
            >>> from cortex.types import AppendContentParams
            >>> result = await cortex.artifacts.append_content(
            ...     AppendContentParams(
            ...         artifact_id="code-gen-001",
            ...         session_id="sess-abc123",
            ...         chunk="def hello():\\n    ",
            ...     )
            ... )
            >>> print(f"Total bytes received: {result.total_bytes_received}")
        """
        # Client-side validation
        validate_append_content_params(params)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "artifacts:appendContent",
                filter_none_values({
                    "artifactId": params.artifact_id,
                    "sessionId": params.session_id,
                    "chunk": params.chunk,
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:appendContent",
        )

        return AppendContentResult(**convert_convex_response(result))

    async def pause_streaming(
        self, artifact_id: str, session_id: str
    ) -> PauseStreamingResult:
        """
        Pause an active streaming session.

        The session can be resumed later with resume_streaming.

        Args:
            artifact_id: The artifact's unique identifier
            session_id: The streaming session ID

        Returns:
            PauseStreamingResult with operation status and state info

        Example:
            >>> result = await cortex.artifacts.pause_streaming(
            ...     "code-gen-001", "sess-abc123"
            ... )
            >>> print(f"Paused - state: {result.current_state}")
        """
        # Client-side validation
        validate_artifact_id(artifact_id)
        validate_session_id(session_id)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "artifacts:pauseStreaming",
                filter_none_values({
                    "artifactId": artifact_id,
                    "sessionId": session_id,
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:pauseStreaming",
        )

        data = convert_convex_response(result)
        return PauseStreamingResult(
            success=data.get("success", True),
            artifact_id=data.get("artifact_id", artifact_id),
            session_id=data.get("session_id", session_id),
            paused_at=data.get("paused_at", 0),
            previous_state=data.get("previous_state", "streaming"),
            current_state=data.get("current_state", "paused"),
            bytes_received=data.get("bytes_received", 0),
            content_preserved=data.get("content_preserved", True),
        )

    async def resume_streaming(
        self, artifact_id: str, session_id: str
    ) -> ResumeStreamingResult:
        """
        Resume a paused streaming session.

        Args:
            artifact_id: The artifact's unique identifier
            session_id: The streaming session ID

        Returns:
            ResumeStreamingResult with operation status and state info

        Example:
            >>> result = await cortex.artifacts.resume_streaming(
            ...     "code-gen-001", "sess-abc123"
            ... )
            >>> print(f"Resumed - state: {result.current_state}")
        """
        # Client-side validation
        validate_artifact_id(artifact_id)
        validate_session_id(session_id)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "artifacts:resumeStreaming",
                filter_none_values({
                    "artifactId": artifact_id,
                    "sessionId": session_id,
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:resumeStreaming",
        )

        data = convert_convex_response(result)
        return ResumeStreamingResult(
            success=data.get("success", True),
            artifact_id=data.get("artifact_id", artifact_id),
            session_id=data.get("session_id", session_id),
            resumed_at=data.get("resumed_at", 0),
            previous_state=data.get("previous_state", "paused"),
            current_state=data.get("current_state", "streaming"),
            bytes_received=data.get("bytes_received", 0),
        )

    async def cancel_streaming(
        self, artifact_id: str, session_id: str
    ) -> CancelStreamingResult:
        """
        Cancel an active streaming session.

        This reverts the artifact back to 'draft' state. Partial content
        is preserved by default.

        Args:
            artifact_id: The artifact's unique identifier
            session_id: The streaming session ID

        Returns:
            CancelStreamingResult with operation status and state info

        Example:
            >>> result = await cortex.artifacts.cancel_streaming(
            ...     "code-gen-001", "sess-abc123"
            ... )
            >>> print(f"Cancelled - state: {result.current_state}")
        """
        # Client-side validation
        validate_artifact_id(artifact_id)
        validate_session_id(session_id)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "artifacts:cancelStreaming",
                filter_none_values({
                    "artifactId": artifact_id,
                    "sessionId": session_id,
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:cancelStreaming",
        )

        data = convert_convex_response(result)
        return CancelStreamingResult(
            success=data.get("success", True),
            artifact_id=data.get("artifact_id", artifact_id),
            session_id=data.get("session_id", session_id),
            cancelled_at=data.get("cancelled_at", 0),
            previous_state=data.get("previous_state", "streaming"),
            current_state=data.get("current_state", "draft"),
            content_preserved=data.get("content_preserved", True),
            bytes_discarded=data.get("bytes_discarded"),
        )

    async def finalize_streaming(
        self, params: FinalizeStreamingParams
    ) -> FinalizeStreamingResult:
        """
        Finalize a streaming session, marking content as complete.

        This transitions the artifact to 'final' state and creates a new version.

        Args:
            params: Finalization parameters including artifact_id and session_id

        Returns:
            FinalizeStreamingResult with operation status and new version info

        Example:
            >>> from cortex.types import FinalizeStreamingParams
            >>> result = await cortex.artifacts.finalize_streaming(
            ...     FinalizeStreamingParams(
            ...         artifact_id="code-gen-001",
            ...         session_id="sess-abc123",
            ...     )
            ... )
            >>> print(f"Finalized v{result.version} - state: {result.current_state}")
        """
        # Client-side validation
        validate_artifact_id(params.artifact_id)
        validate_session_id(params.session_id)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "artifacts:finalizeStreaming",
                filter_none_values({
                    "artifactId": params.artifact_id,
                    "sessionId": params.session_id,
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:finalizeStreaming",
        )

        data = convert_convex_response(result)
        return FinalizeStreamingResult(
            success=data.get("success", True),
            artifact_id=data.get("artifact_id", params.artifact_id),
            session_id=data.get("session_id", params.session_id),
            finalized_at=data.get("finalized_at", 0),
            previous_state=data.get("previous_state", "streaming"),
            current_state=data.get("current_state", "final"),
            final_content_length=data.get("content_length", 0),
            version=data.get("version", 1),
        )

    async def set_streaming_state(
        self, artifact_id: str, streaming_state: StreamingState
    ) -> SetStreamingStateResult:
        """
        Set the streaming state of an artifact.

        Use this for manual state transitions. For normal streaming flows,
        prefer start_streaming, pause_streaming, resume_streaming, and finalize_streaming.

        Args:
            artifact_id: The artifact's unique identifier
            streaming_state: New state ("draft", "streaming", "paused", "final", "error")

        Returns:
            SetStreamingStateResult with operation status and state info

        Raises:
            ArtifactsValidationError: If streaming_state value is invalid
            CortexError: If state transition is not allowed

        Example:
            >>> # Mark an artifact as having an error
            >>> result = await cortex.artifacts.set_streaming_state(
            ...     "code-gen-001", "error"
            ... )
            >>> print(f"Changed from {result.previous_state} to {result.current_state}")
        """
        # Client-side validation
        validate_artifact_id(artifact_id)
        validate_streaming_state(streaming_state, required=True)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "artifacts:setStreamingState",
                filter_none_values({
                    "artifactId": artifact_id,
                    "streamingState": streaming_state,
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:setStreamingState",
        )

        data = convert_convex_response(result)
        return SetStreamingStateResult(
            success=data.get("success", True),
            artifact_id=data.get("artifact_id", artifact_id),
            previous_state=data.get("previous_state", ""),
            current_state=data.get("current_state", streaming_state),
            updated_at=data.get("updated_at", 0),
        )

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # File Operations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def upload_file(
        self,
        artifact_id: str,
        file_data: bytes,
        filename: str,
        mime_type: str,
    ) -> Artifact:
        """
        Upload a file and attach it to an artifact.

        NOTE: This method is not yet implemented. File uploads in Convex require
        a two-step process:
        1. Use generate_upload_url() to get a signed upload URL
        2. Upload the file to that URL using HTTP
        3. Use complete_artifact_upload() to attach the file to the artifact

        For now, use the set_file_ref() method directly after uploading to
        Convex storage via the HTTP upload API.

        Args:
            artifact_id: The artifact's unique identifier
            file_data: The file content as bytes
            filename: Original filename
            mime_type: MIME type of the file

        Raises:
            NotImplementedError: This method is not yet implemented

        Example:
            >>> # Instead of upload_file, use the two-step process:
            >>> # 1. Get upload URL
            >>> upload_info = await cortex.artifacts.generate_upload_url(
            ...     "meeting-notes-2024", "image/png", "screenshot.png"
            ... )
            >>> # 2. Upload file to URL (using httpx, requests, etc.)
            >>> import httpx
            >>> async with httpx.AsyncClient() as client:
            ...     await client.post(upload_info["upload_url"], content=file_data)
            >>> # 3. Complete the upload
            >>> artifact = await cortex.artifacts.complete_artifact_upload(...)
        """
        raise NotImplementedError(
            "upload_file is not yet implemented. "
            "Use generate_upload_url() and complete_artifact_upload() for file uploads, "
            "or use set_file_ref() directly after uploading to Convex storage."
        )

    async def get_file_url(self, artifact_id: str) -> Optional[str]:
        """
        Get a temporary URL for downloading the artifact's attached file.

        Args:
            artifact_id: The artifact's unique identifier

        Returns:
            Temporary download URL if file exists, None otherwise

        Example:
            >>> url = await cortex.artifacts.get_file_url("meeting-notes-2024")
            >>> if url:
            ...     print(f"Download from: {url}")
        """
        # Client-side validation
        validate_artifact_id(artifact_id)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "artifacts:getArtifactFileUrl",
                filter_none_values({
                    "artifactId": artifact_id,
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:getArtifactFileUrl",
        )

        # Backend returns {url, mimeType, size, originalFilename, expiresAt} or null, or a direct URL string
        if not result:
            return None
        if isinstance(result, str):
            return result
        if isinstance(result, dict):
            url = result.get("url")
            return str(url) if url else None
        return None

    async def set_file_ref(
        self, artifact_id: str, file_ref: FileReference
    ) -> Artifact:
        """
        Set a file reference on an artifact.

        Use this after uploading a file to Convex storage to attach it
        to an artifact. The file must already be uploaded.

        Args:
            artifact_id: The artifact's unique identifier
            file_ref: File reference with Convex storage details

        Returns:
            The Artifact with the file reference set

        Example:
            >>> from cortex.types import FileReference
            >>>
            >>> # After uploading a file to Convex storage:
            >>> file_ref = FileReference(
            ...     storage_id="kg2abc123def",  # Convex storage ID from upload
            ...     mime_type="image/png",
            ...     size=102400,
            ...     original_filename="screenshot.png",
            ... )
            >>> artifact = await cortex.artifacts.set_file_ref(
            ...     "meeting-notes-2024", file_ref
            ... )
        """
        # Client-side validation
        validate_artifact_id(artifact_id)
        validate_file_reference(file_ref)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "artifacts:setFileRef",
                filter_none_values({
                    "artifactId": artifact_id,
                    "fileRef": {
                        "storageId": file_ref.storage_id,
                        "mimeType": file_ref.mime_type,
                        "size": file_ref.size,
                        "checksum": file_ref.checksum,
                        "originalFilename": file_ref.original_filename,
                    },
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:setFileRef",
        )

        return Artifact(**convert_convex_response(result))

    async def detach_file(
        self, artifact_id: str, delete_file: bool = False
    ) -> DetachFileResult:
        """
        Detach the file reference from an artifact.

        This removes the file reference from the artifact. Optionally,
        the underlying file can be deleted from Convex storage.

        Args:
            artifact_id: The artifact's unique identifier
            delete_file: If True, also delete the file from Convex storage.
                        Default is False (keep file in storage).

        Returns:
            DetachFileResult with status, previous file info, and new version

        Example:
            >>> # Detach file but keep in storage
            >>> result = await cortex.artifacts.detach_file("meeting-notes-2024")
            >>> print(f"Detached file: {result.previous_file_ref}")
            >>>
            >>> # Detach and delete the file
            >>> result = await cortex.artifacts.detach_file(
            ...     "meeting-notes-2024", delete_file=True
            ... )
            >>> print(f"File deleted: {result.file_deleted}")
        """
        # Client-side validation
        validate_artifact_id(artifact_id)

        # Backend retrieves artifact by ID - no need for memory_space_id
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "artifacts:detachFile",
                filter_none_values({
                    "artifactId": artifact_id,
                    "deleteFile": delete_file,
                    "tenantId": self._tenant_id,
                }),
            ),
            "artifacts:detachFile",
        )

        # Backend returns {success, artifactId, previousFileRef, fileDeleted, version, updatedAt}
        return DetachFileResult(**convert_convex_response(result))
