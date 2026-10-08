"""
Unit Tests: Attachments Python Validators

Tests for attachment validation functions in the Python SDK.
"""

import pytest

from cortex.attachments.validators import (
    AttachmentValidationError,
    validate_attach_params,
    validate_attachment_id,
    validate_attachment_ids,
    validate_attachment_type,
    validate_dimensions,
    validate_duration,
    validate_file_size,
    validate_filename,
    validate_limit,
    validate_list_attachments_filter,
    validate_memory_space_id,
    validate_mime_type,
    validate_sort_by,
    validate_sort_order,
    validate_storage_id,
    validate_user_id,
)


class TestValidateAttachmentId:
    """Tests for validate_attachment_id function."""

    def test_accepts_valid_attachment_ids(self) -> None:
        """Should accept valid attachment IDs."""
        validate_attachment_id("attach-abc123")  # Should not raise
        validate_attachment_id("attachment_v1")  # Should not raise
        validate_attachment_id("a")  # Should not raise

    def test_rejects_none(self) -> None:
        """Should reject None values."""
        with pytest.raises(AttachmentValidationError, match="is required"):
            validate_attachment_id(None)

    def test_rejects_empty_string(self) -> None:
        """Should reject empty strings."""
        with pytest.raises(AttachmentValidationError, match="cannot be empty"):
            validate_attachment_id("")

    def test_rejects_whitespace_only(self) -> None:
        """Should reject whitespace-only strings."""
        with pytest.raises(AttachmentValidationError, match="cannot be empty"):
            validate_attachment_id("   ")

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(AttachmentValidationError, match="must be a string"):
            validate_attachment_id(123)
        with pytest.raises(AttachmentValidationError, match="must be a string"):
            validate_attachment_id(["list"])

    def test_accepts_max_length(self) -> None:
        """Should accept IDs at max length (100 chars)."""
        max_id = "a" * 100
        validate_attachment_id(max_id)  # Should not raise

    def test_rejects_exceeds_max_length(self) -> None:
        """Should reject IDs exceeding max length."""
        long_id = "a" * 101
        with pytest.raises(AttachmentValidationError, match="exceeds maximum length"):
            validate_attachment_id(long_id)

    def test_uses_custom_field_name(self) -> None:
        """Should use custom field name in error message."""
        with pytest.raises(AttachmentValidationError, match="my_field is required"):
            validate_attachment_id(None, "my_field")


class TestValidateStorageId:
    """Tests for validate_storage_id function."""

    def test_accepts_valid_storage_ids(self) -> None:
        """Should accept valid storage IDs."""
        validate_storage_id("kg2abc123xyz")  # Should not raise
        validate_storage_id("storage_id_1")  # Should not raise

    def test_rejects_none(self) -> None:
        """Should reject None values."""
        with pytest.raises(AttachmentValidationError, match="storage_id is required"):
            validate_storage_id(None)

    def test_rejects_empty_string(self) -> None:
        """Should reject empty strings."""
        with pytest.raises(AttachmentValidationError, match="cannot be empty"):
            validate_storage_id("")

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(AttachmentValidationError, match="must be a string"):
            validate_storage_id(123)


class TestValidateMemorySpaceId:
    """Tests for validate_memory_space_id function."""

    def test_accepts_valid_memory_space_ids(self) -> None:
        """Should accept valid memory space IDs."""
        validate_memory_space_id("space-123")  # Should not raise
        validate_memory_space_id("user_space")  # Should not raise

    def test_rejects_none(self) -> None:
        """Should reject None values."""
        with pytest.raises(AttachmentValidationError, match="memory_space_id is required"):
            validate_memory_space_id(None)

    def test_rejects_empty_string(self) -> None:
        """Should reject empty strings."""
        with pytest.raises(AttachmentValidationError, match="cannot be empty"):
            validate_memory_space_id("")

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(AttachmentValidationError, match="must be a string"):
            validate_memory_space_id(123)


class TestValidateUserId:
    """Tests for validate_user_id function."""

    def test_accepts_valid_user_ids(self) -> None:
        """Should accept valid user IDs."""
        validate_user_id("user-123")  # Should not raise
        validate_user_id("john_doe")  # Should not raise

    def test_rejects_none(self) -> None:
        """Should reject None values."""
        with pytest.raises(AttachmentValidationError, match="user_id is required"):
            validate_user_id(None)

    def test_rejects_empty_string(self) -> None:
        """Should reject empty strings."""
        with pytest.raises(AttachmentValidationError, match="cannot be empty"):
            validate_user_id("")

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(AttachmentValidationError, match="must be a string"):
            validate_user_id(123)


class TestValidateAttachmentType:
    """Tests for validate_attachment_type function."""

    def test_accepts_valid_attachment_types(self) -> None:
        """Should accept valid attachment types."""
        validate_attachment_type("image")  # Should not raise
        validate_attachment_type("audio")  # Should not raise
        validate_attachment_type("video")  # Should not raise
        validate_attachment_type("file")  # Should not raise
        validate_attachment_type("pdf")  # Should not raise

    def test_rejects_none(self) -> None:
        """Should reject None values."""
        with pytest.raises(AttachmentValidationError, match="type is required"):
            validate_attachment_type(None)

    def test_rejects_invalid_types(self) -> None:
        """Should reject invalid type values."""
        with pytest.raises(AttachmentValidationError, match="must be one of"):
            validate_attachment_type("document")
        with pytest.raises(AttachmentValidationError, match="must be one of"):
            validate_attachment_type("IMAGE")  # Case sensitive

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(AttachmentValidationError, match="must be a string"):
            validate_attachment_type(123)


class TestValidateMimeType:
    """Tests for validate_mime_type function."""

    def test_accepts_valid_mime_types(self) -> None:
        """Should accept valid MIME types."""
        validate_mime_type("image/png")  # Should not raise
        validate_mime_type("image/jpeg")  # Should not raise
        validate_mime_type("application/pdf")  # Should not raise
        validate_mime_type("audio/mpeg")  # Should not raise
        validate_mime_type("video/mp4")  # Should not raise

    def test_rejects_none(self) -> None:
        """Should reject None values."""
        with pytest.raises(AttachmentValidationError, match="mime_type is required"):
            validate_mime_type(None)

    def test_rejects_invalid_format(self) -> None:
        """Should reject invalid MIME type format."""
        with pytest.raises(AttachmentValidationError, match="valid MIME type"):
            validate_mime_type("invalid")
        with pytest.raises(AttachmentValidationError, match="valid MIME type"):
            validate_mime_type("png")

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(AttachmentValidationError, match="must be a string"):
            validate_mime_type(123)


class TestValidateFilename:
    """Tests for validate_filename function."""

    def test_accepts_valid_filenames(self) -> None:
        """Should accept valid filenames."""
        validate_filename("photo.png")  # Should not raise
        validate_filename("document.pdf")  # Should not raise
        validate_filename("my file (1).jpg")  # Should not raise

    def test_rejects_none(self) -> None:
        """Should reject None values."""
        with pytest.raises(AttachmentValidationError, match="filename is required"):
            validate_filename(None)

    def test_rejects_empty_string(self) -> None:
        """Should reject empty strings."""
        with pytest.raises(AttachmentValidationError, match="cannot be empty"):
            validate_filename("")

    def test_rejects_exceeds_max_length(self) -> None:
        """Should reject filenames exceeding max length."""
        long_filename = "a" * 256
        with pytest.raises(AttachmentValidationError, match="exceeds maximum length"):
            validate_filename(long_filename)

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(AttachmentValidationError, match="must be a string"):
            validate_filename(123)


class TestValidateFileSize:
    """Tests for validate_file_size function."""

    def test_accepts_valid_sizes(self) -> None:
        """Should accept valid file sizes."""
        validate_file_size(1)  # Should not raise
        validate_file_size(1024)  # Should not raise
        validate_file_size(1048576)  # Should not raise

    def test_rejects_none(self) -> None:
        """Should reject None values."""
        with pytest.raises(AttachmentValidationError, match="size is required"):
            validate_file_size(None)

    def test_rejects_non_number_types(self) -> None:
        """Should reject non-number types."""
        with pytest.raises(AttachmentValidationError, match="must be a number"):
            validate_file_size("1024")

    def test_rejects_zero(self) -> None:
        """Should reject zero."""
        with pytest.raises(AttachmentValidationError, match="must be a positive number"):
            validate_file_size(0)

    def test_rejects_negative(self) -> None:
        """Should reject negative numbers."""
        with pytest.raises(AttachmentValidationError, match="must be a positive number"):
            validate_file_size(-1)


class TestValidateDimensions:
    """Tests for validate_dimensions function."""

    def test_accepts_valid_dimensions(self) -> None:
        """Should accept valid dimensions."""
        from dataclasses import dataclass

        @dataclass
        class Dims:
            width: int
            height: int

        validate_dimensions(Dims(width=100, height=100))  # Should not raise
        validate_dimensions(Dims(width=1920, height=1080))  # Should not raise

    def test_accepts_none_optional(self) -> None:
        """Should accept None (optional)."""
        validate_dimensions(None)  # Should not raise

    def test_rejects_missing_dimensions(self) -> None:
        """Should reject missing width/height."""
        from dataclasses import dataclass

        @dataclass
        class NoWidth:
            height: int

        @dataclass
        class NoHeight:
            width: int

        with pytest.raises(AttachmentValidationError, match="width and height"):
            validate_dimensions(NoWidth(height=100))

        with pytest.raises(AttachmentValidationError, match="width and height"):
            validate_dimensions(NoHeight(width=100))


class TestValidateDuration:
    """Tests for validate_duration function."""

    def test_accepts_valid_durations(self) -> None:
        """Should accept valid durations."""
        validate_duration(1)  # Should not raise
        validate_duration(60.5)  # Should not raise
        validate_duration(3600)  # Should not raise

    def test_accepts_none_optional(self) -> None:
        """Should accept None (optional)."""
        validate_duration(None)  # Should not raise

    def test_rejects_non_number_types(self) -> None:
        """Should reject non-number types."""
        with pytest.raises(AttachmentValidationError, match="must be a number"):
            validate_duration("60")

    def test_rejects_zero(self) -> None:
        """Should reject zero."""
        with pytest.raises(AttachmentValidationError, match="must be a positive number"):
            validate_duration(0)

    def test_rejects_negative(self) -> None:
        """Should reject negative numbers."""
        with pytest.raises(AttachmentValidationError, match="must be a positive number"):
            validate_duration(-1)


class TestValidateLimit:
    """Tests for validate_limit function."""

    def test_accepts_valid_limits(self) -> None:
        """Should accept valid limits."""
        validate_limit(1)  # Should not raise
        validate_limit(50)  # Should not raise
        validate_limit(1000)  # Should not raise

    def test_accepts_none_optional(self) -> None:
        """Should accept None (optional)."""
        validate_limit(None)  # Should not raise

    def test_rejects_non_integer_types(self) -> None:
        """Should reject non-integer types."""
        with pytest.raises(AttachmentValidationError, match="must be an integer"):
            validate_limit("50")

    def test_rejects_zero(self) -> None:
        """Should reject zero."""
        with pytest.raises(AttachmentValidationError, match="must be at least 1"):
            validate_limit(0)

    def test_rejects_exceeds_max(self) -> None:
        """Should reject values exceeding max limit."""
        with pytest.raises(AttachmentValidationError, match="exceeds maximum"):
            validate_limit(1001)


class TestValidateSortBy:
    """Tests for validate_sort_by function."""

    def test_accepts_valid_sort_fields(self) -> None:
        """Should accept valid sort fields."""
        validate_sort_by("createdAt")  # Should not raise
        validate_sort_by("updatedAt")  # Should not raise

    def test_accepts_none_optional(self) -> None:
        """Should accept None (optional)."""
        validate_sort_by(None)  # Should not raise

    def test_rejects_invalid_sort_fields(self) -> None:
        """Should reject invalid sort fields."""
        with pytest.raises(AttachmentValidationError, match="must be one of"):
            validate_sort_by("filename")

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(AttachmentValidationError, match="must be a string"):
            validate_sort_by(123)


class TestValidateSortOrder:
    """Tests for validate_sort_order function."""

    def test_accepts_valid_sort_orders(self) -> None:
        """Should accept valid sort orders."""
        validate_sort_order("asc")  # Should not raise
        validate_sort_order("desc")  # Should not raise

    def test_accepts_none_optional(self) -> None:
        """Should accept None (optional)."""
        validate_sort_order(None)  # Should not raise

    def test_rejects_invalid_sort_orders(self) -> None:
        """Should reject invalid sort orders."""
        with pytest.raises(AttachmentValidationError, match="must be one of"):
            validate_sort_order("ascending")

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(AttachmentValidationError, match="must be a string"):
            validate_sort_order(123)


class TestValidateAttachParams:
    """Tests for validate_attach_params function."""

    def test_accepts_valid_params(self) -> None:
        """Should accept valid params."""
        from cortex.types import AttachParams

        params = AttachParams(
            storage_id="kg2abc123",
            memory_space_id="space-123",
            user_id="user-123",
            type="image",
            mime_type="image/png",
            filename="photo.png",
            size=1024,
        )
        validate_attach_params(params)  # Should not raise

    def test_rejects_none_params(self) -> None:
        """Should reject None params."""
        with pytest.raises(AttachmentValidationError, match="params is required"):
            validate_attach_params(None)


class TestValidateListAttachmentsFilter:
    """Tests for validate_list_attachments_filter function."""

    def test_accepts_valid_filter(self) -> None:
        """Should accept valid filter."""
        from cortex.types import ListAttachmentsFilter

        filter = ListAttachmentsFilter(memory_space_id="space-123")
        validate_list_attachments_filter(filter)  # Should not raise

    def test_rejects_none_filter(self) -> None:
        """Should reject None filter."""
        with pytest.raises(AttachmentValidationError, match="filter is required"):
            validate_list_attachments_filter(None)


class TestValidateAttachmentIds:
    """Tests for validate_attachment_ids function."""

    def test_accepts_valid_arrays(self) -> None:
        """Should accept valid attachment ID arrays."""
        validate_attachment_ids(["attach-1", "attach-2"])  # Should not raise
        validate_attachment_ids(["attach-1"])  # Should not raise

    def test_rejects_none(self) -> None:
        """Should reject None values."""
        with pytest.raises(AttachmentValidationError, match="attachment_ids is required"):
            validate_attachment_ids(None)

    def test_rejects_non_array(self) -> None:
        """Should reject non-array values."""
        with pytest.raises(AttachmentValidationError, match="must be a list"):
            validate_attachment_ids("attach-1")

    def test_rejects_arrays_with_invalid_ids(self) -> None:
        """Should reject arrays with invalid IDs."""
        with pytest.raises(AttachmentValidationError):
            validate_attachment_ids(["attach-1", None])
        with pytest.raises(AttachmentValidationError):
            validate_attachment_ids(["attach-1", ""])
