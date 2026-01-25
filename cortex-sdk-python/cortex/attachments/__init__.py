"""
Cortex SDK - Attachments API

Multi-modal file storage for images, PDFs, audio, video, and generic files.
Memory space-scoped with multi-tenancy support.
"""

from typing import Any, Dict, List, Optional, cast

from .._utils import convert_convex_response, filter_none_values
from ..types import (
    Attachment,
    AttachmentDimensions,
    AttachmentType,
    AttachParams,
    AuthContext,
    DeleteManyAttachmentsResult,
    ListAttachmentsFilter,
    ListAttachmentsResult,
    UploadUrlResult,
)
from .validators import (
    AttachmentValidationError,
    validate_attach_params,
    validate_attachment_id,
    validate_attachment_ids,
    validate_list_attachments_filter,
)

__all__ = ["AttachmentsAPI", "AttachmentValidationError"]


def _to_attachment(data: Dict[str, Any]) -> Attachment:
    """Convert a Convex response dict to an Attachment dataclass.

    Handles snake_case conversion and nested dimensions field.
    """
    converted = convert_convex_response(data)

    # Handle nested dimensions
    if converted.get("dimensions"):
        converted["dimensions"] = AttachmentDimensions(**converted["dimensions"])

    return Attachment(**converted)


def _is_attachment_not_found_error(e: Exception) -> bool:
    """Check if an exception indicates an attachment was not found.

    Args:
        e: The exception to check

    Returns:
        True if this is a "not found" error
    """
    error_str = str(e)
    return (
        "ATTACHMENT_NOT_FOUND" in error_str
        or "attachment not found" in error_str.lower()
    )


class AttachmentsAPI:
    """
    Attachments API - Multi-modal File Storage

    Provides file storage for images, PDFs, audio, video, and generic files
    with memory space isolation and multi-tenancy support.

    Features:
        - Convex native file storage integration
        - Upload URL generation for direct client uploads
        - Signed download URLs
        - Memory space isolation
        - Multi-tenancy support
        - Conversation/message/memory/artifact linkage

    Example:
        >>> # Generate upload URL
        >>> result = await cortex.attachments.generate_upload_url()
        >>> # Upload file to result.upload_url
        >>> # Then attach the file
        >>> from cortex.types import AttachParams
        >>> attachment = await cortex.attachments.attach(
        ...     AttachParams(
        ...         storage_id="kg2abc123...",
        ...         memory_space_id="my-space",
        ...         user_id="user-123",
        ...         type="image",
        ...         mime_type="image/png",
        ...         filename="photo.png",
        ...         size=1024000,
        ...     )
        ... )
    """

    def __init__(
        self,
        client: Any,
        resilience: Optional[Any] = None,
        auth_context: Optional[AuthContext] = None,
    ) -> None:
        """
        Initialize the Attachments API.

        Args:
            client: Convex client for database operations
            resilience: Optional resilience layer for rate limiting
            auth_context: Optional authentication context for multi-tenancy
        """
        self._client = client
        self._resilience = resilience
        self._auth_context = auth_context

    @property
    def _tenant_id(self) -> Optional[str]:
        """Get tenant ID from auth context if available."""
        return self._auth_context.tenant_id if self._auth_context else None

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str
    ) -> Any:
        """Execute an operation with optional resilience layer."""
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Upload Operations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def generate_upload_url(self) -> UploadUrlResult:
        """
        Generate a pre-signed upload URL for file upload.

        Creates a short-lived upload URL that clients can use to upload
        files directly to Convex storage.

        Returns:
            UploadUrlResult with the upload URL

        Example:
            >>> result = await cortex.attachments.generate_upload_url()
            >>> # Upload file to result.upload_url via POST
            >>> # response = await http_client.post(result.upload_url, body=file)
            >>> # storage_id = response.json()["storageId"]
        """

        async def _op() -> Dict[str, Any]:
            args = filter_none_values({
                "tenantId": self._tenant_id,
            })
            return cast(
                Dict[str, Any],
                await self._client.mutation(
                    "attachments:generateUploadUrl",
                    args,
                ),
            )

        result = await self._execute_with_resilience(_op, "attachments:generateUploadUrl")
        return UploadUrlResult(
            upload_url=result.get("uploadUrl", ""),
        )

    async def attach(self, params: AttachParams) -> Attachment:
        """
        Register an uploaded file as an attachment.

        Call this after successfully uploading a file using the URL from
        generate_upload_url.

        Args:
            params: Attachment parameters including storage ID, metadata, etc.

        Returns:
            The created Attachment record

        Raises:
            AttachmentValidationError: If params are invalid

        Example:
            >>> from cortex.types import AttachParams
            >>> attachment = await cortex.attachments.attach(
            ...     AttachParams(
            ...         storage_id="kg2abc123...",
            ...         memory_space_id="my-space",
            ...         user_id="user-123",
            ...         type="image",
            ...         mime_type="image/png",
            ...         filename="screenshot.png",
            ...         size=1024000,
            ...     )
            ... )
        """
        # Client-side validation
        validate_attach_params(params)

        async def _op() -> Dict[str, Any]:
            args = filter_none_values({
                "storageId": params.storage_id,
                "memorySpaceId": params.memory_space_id,
                "userId": params.user_id,
                "type": params.type,
                "mimeType": params.mime_type,
                "filename": params.filename,
                "size": params.size,
                "conversationId": params.conversation_id,
                "messageId": params.message_id,
                "memoryId": params.memory_id,
                "artifactId": params.artifact_id,
                "dimensions": (
                    {"width": params.dimensions.width, "height": params.dimensions.height}
                    if params.dimensions
                    else None
                ),
                "duration": params.duration,
                "metadata": params.metadata,
                "tenantId": params.tenant_id or self._tenant_id,
            })
            return cast(
                Dict[str, Any],
                await self._client.mutation("attachments:attach", args),
            )

        result = await self._execute_with_resilience(_op, "attachments:attach")
        return _to_attachment(result)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Read Operations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def get(self, attachment_id: str) -> Optional[Attachment]:
        """
        Get an attachment by ID.

        Args:
            attachment_id: The attachment ID to retrieve

        Returns:
            The Attachment if found, None otherwise

        Raises:
            AttachmentValidationError: If attachment_id is invalid

        Example:
            >>> attachment = await cortex.attachments.get("attach-abc123")
            >>> if attachment:
            ...     print(attachment.filename)
        """
        # Client-side validation
        validate_attachment_id(attachment_id)

        async def _op() -> Optional[Dict[str, Any]]:
            args = filter_none_values({
                "attachmentId": attachment_id,
                "tenantId": self._tenant_id,
            })
            return cast(
                Optional[Dict[str, Any]],
                await self._client.query("attachments:get", args),
            )

        result = await self._execute_with_resilience(_op, "attachments:get")
        if result is None:
            return None
        return _to_attachment(result)

    async def get_url(self, attachment_id: str) -> Optional[str]:
        """
        Get a signed download URL for an attachment.

        The URL is temporary and will expire. Use it immediately to
        display or download the file.

        Args:
            attachment_id: The attachment ID

        Returns:
            The download URL if found, None otherwise

        Raises:
            AttachmentValidationError: If attachment_id is invalid

        Example:
            >>> url = await cortex.attachments.get_url("attach-abc123")
            >>> if url:
            ...     # Download or display the file
            ...     response = await http_client.get(url)
        """
        # Client-side validation
        validate_attachment_id(attachment_id)

        async def _op() -> Optional[Dict[str, Any]]:
            args = filter_none_values({
                "attachmentId": attachment_id,
                "tenantId": self._tenant_id,
            })
            return cast(
                Optional[Dict[str, Any]],
                await self._client.query("attachments:getUrl", args),
            )

        result = await self._execute_with_resilience(_op, "attachments:getUrl")
        if result is None:
            return None
        return cast(Optional[str], result.get("url"))

    async def list(self, filter: ListAttachmentsFilter) -> ListAttachmentsResult:
        """
        List attachments with comprehensive filters and pagination.

        Args:
            filter: Filter criteria and pagination options

        Returns:
            ListAttachmentsResult with attachments and pagination info

        Raises:
            AttachmentValidationError: If filter is invalid

        Example:
            >>> from cortex.types import ListAttachmentsFilter
            >>> result = await cortex.attachments.list(
            ...     ListAttachmentsFilter(
            ...         memory_space_id="my-space",
            ...         type="image",
            ...         limit=20,
            ...     )
            ... )
            >>> for attachment in result.attachments:
            ...     print(attachment.filename)
        """
        # Client-side validation
        validate_list_attachments_filter(filter)

        async def _op() -> Dict[str, Any]:
            args = filter_none_values({
                "memorySpaceId": filter.memory_space_id,
                "tenantId": filter.tenant_id or self._tenant_id,
                "conversationId": filter.conversation_id,
                "messageId": filter.message_id,
                "memoryId": filter.memory_id,
                "artifactId": filter.artifact_id,
                "userId": filter.user_id,
                "type": filter.type,
                "limit": filter.limit,
                "cursor": filter.cursor,
                "sortBy": filter.sort_by,
                "sortOrder": filter.sort_order,
            })
            return cast(
                Dict[str, Any],
                await self._client.query("attachments:list", args),
            )

        result = await self._execute_with_resilience(_op, "attachments:list")

        attachments = [
            _to_attachment(a)
            for a in result.get("attachments", [])
        ]

        return ListAttachmentsResult(
            attachments=attachments,
            total=result.get("total", len(attachments)),
            cursor=result.get("cursor"),
            has_more=result.get("hasMore", False),
        )

    async def get_by_conversation(
        self,
        conversation_id: str,
        type: Optional[AttachmentType] = None,
        limit: Optional[int] = None,
    ) -> List[Attachment]:
        """
        Get attachments for a specific conversation.

        Args:
            conversation_id: The conversation ID
            type: Optional type filter
            limit: Optional limit

        Returns:
            List of attachments for the conversation

        Example:
            >>> attachments = await cortex.attachments.get_by_conversation("conv-123")
            >>> print(f"{len(attachments)} attachments in this conversation")
        """
        async def _op() -> List[Dict[str, Any]]:
            args = filter_none_values({
                "conversationId": conversation_id,
                "tenantId": self._tenant_id,
                "type": type,
                "limit": limit,
            })
            return cast(
                List[Dict[str, Any]],
                await self._client.query("attachments:getByConversation", args),
            )

        result = await self._execute_with_resilience(_op, "attachments:getByConversation")
        return [_to_attachment(a) for a in result]

    async def get_by_message(self, message_id: str) -> List[Attachment]:
        """
        Get attachments for a specific message.

        Args:
            message_id: The message ID

        Returns:
            List of attachments for the message

        Example:
            >>> attachments = await cortex.attachments.get_by_message("msg-123")
            >>> for att in attachments:
            ...     print(att.filename)
        """
        async def _op() -> List[Dict[str, Any]]:
            args = filter_none_values({
                "messageId": message_id,
                "tenantId": self._tenant_id,
            })
            return cast(
                List[Dict[str, Any]],
                await self._client.query("attachments:getByMessage", args),
            )

        result = await self._execute_with_resilience(_op, "attachments:getByMessage")
        return [_to_attachment(a) for a in result]

    async def count(
        self,
        memory_space_id: str,
        conversation_id: Optional[str] = None,
        message_id: Optional[str] = None,
        user_id: Optional[str] = None,
        type: Optional[AttachmentType] = None,
    ) -> int:
        """
        Count attachments matching filters.

        Args:
            memory_space_id: Required memory space ID
            conversation_id: Optional conversation filter
            message_id: Optional message filter
            user_id: Optional user filter
            type: Optional type filter

        Returns:
            Count of matching attachments

        Example:
            >>> count = await cortex.attachments.count(
            ...     memory_space_id="my-space",
            ...     type="image",
            ... )
            >>> print(f"{count} images in this space")
        """
        async def _op() -> int:
            args = filter_none_values({
                "memorySpaceId": memory_space_id,
                "tenantId": self._tenant_id,
                "conversationId": conversation_id,
                "messageId": message_id,
                "userId": user_id,
                "type": type,
            })
            return cast(int, await self._client.query("attachments:count", args))

        return cast(int, await self._execute_with_resilience(_op, "attachments:count"))

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Delete Operations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def delete(self, attachment_id: str) -> bool:
        """
        Delete an attachment.

        Removes both the metadata record and the file from storage.

        Args:
            attachment_id: The attachment ID to delete

        Returns:
            True if deleted successfully

        Raises:
            AttachmentValidationError: If attachment_id is invalid
            Exception: If attachment not found

        Example:
            >>> success = await cortex.attachments.delete("attach-abc123")
            >>> if success:
            ...     print("Attachment deleted")
        """
        # Client-side validation
        validate_attachment_id(attachment_id)

        async def _op() -> Dict[str, Any]:
            args = filter_none_values({
                "attachmentId": attachment_id,
                "tenantId": self._tenant_id,
            })
            return cast(
                Dict[str, Any],
                await self._client.mutation("attachments:remove", args),
            )

        result = await self._execute_with_resilience(_op, "attachments:delete")
        return cast(bool, result.get("deleted", False))

    async def delete_many(self, attachment_ids: List[str]) -> DeleteManyAttachmentsResult:
        """
        Bulk delete multiple attachments.

        Returns the count of successfully deleted attachments.

        Args:
            attachment_ids: List of attachment IDs to delete

        Returns:
            DeleteManyAttachmentsResult with deletion statistics

        Raises:
            AttachmentValidationError: If attachment_ids are invalid

        Example:
            >>> result = await cortex.attachments.delete_many([
            ...     "attach-123",
            ...     "attach-456",
            ... ])
            >>> print(f"Deleted {result.deleted} of {result.total} attachments")
        """
        # Client-side validation
        validate_attachment_ids(attachment_ids)

        async def _op() -> Dict[str, Any]:
            args = filter_none_values({
                "attachmentIds": attachment_ids,
                "tenantId": self._tenant_id,
            })
            return cast(
                Dict[str, Any],
                await self._client.mutation("attachments:removeMany", args),
            )

        result = await self._execute_with_resilience(_op, "attachments:deleteMany")
        return DeleteManyAttachmentsResult(
            deleted=result.get("deleted", 0),
            total=result.get("total", len(attachment_ids)),
            errors=result.get("errors"),
        )
