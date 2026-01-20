"""
Unit Tests: Artifacts Python Validators

Tests for artifact validation functions in the Python SDK.
"""

import pytest

from cortex.artifacts.validators import (
    ArtifactsValidationError,
    validate_artifact_id,
    validate_title,
    validate_content,
    validate_kind,
    validate_streaming_state,
    validate_tags,
    validate_limit,
    validate_offset,
    validate_version,
    validate_session_id,
    validate_timestamp,
    validate_sort_by,
    validate_sort_order,
)


class TestValidateArtifactId:
    """Tests for validate_artifact_id function."""

    def test_accepts_valid_artifact_ids(self) -> None:
        """Should accept valid artifact IDs."""
        validate_artifact_id("art-abc123")  # Should not raise
        validate_artifact_id("art:abc.123")  # Should not raise
        validate_artifact_id("artifact_v1")  # Should not raise
        validate_artifact_id("a")  # Should not raise

    def test_rejects_none(self) -> None:
        """Should reject None values."""
        with pytest.raises(ArtifactsValidationError, match="is required"):
            validate_artifact_id(None)

    def test_rejects_empty_string(self) -> None:
        """Should reject empty strings."""
        with pytest.raises(ArtifactsValidationError, match="cannot be empty"):
            validate_artifact_id("")

    def test_rejects_whitespace_only(self) -> None:
        """Should reject whitespace-only strings."""
        with pytest.raises(ArtifactsValidationError, match="cannot be empty"):
            validate_artifact_id("   ")

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(ArtifactsValidationError, match="must be a string"):
            validate_artifact_id(123)
        with pytest.raises(ArtifactsValidationError, match="must be a string"):
            validate_artifact_id(["list"])

    def test_accepts_max_length(self) -> None:
        """Should accept IDs at max length (100 chars)."""
        max_id = "a" * 100
        validate_artifact_id(max_id)  # Should not raise

    def test_rejects_exceeds_max_length(self) -> None:
        """Should reject IDs exceeding max length."""
        long_id = "a" * 101
        with pytest.raises(ArtifactsValidationError, match="exceeds maximum length"):
            validate_artifact_id(long_id)

    def test_rejects_invalid_characters(self) -> None:
        """Should reject IDs with invalid characters."""
        with pytest.raises(ArtifactsValidationError, match="Invalid.*format"):
            validate_artifact_id("art@#$%")

    def test_rejects_unicode_characters(self) -> None:
        """Should reject Unicode characters."""
        with pytest.raises(ArtifactsValidationError, match="Invalid.*format"):
            validate_artifact_id("art-über")

    def test_uses_custom_field_name(self) -> None:
        """Should use custom field name in error message."""
        with pytest.raises(ArtifactsValidationError, match="my_field is required"):
            validate_artifact_id(None, "my_field")


class TestValidateTitle:
    """Tests for validate_title function."""

    def test_accepts_valid_titles(self) -> None:
        """Should accept valid titles."""
        validate_title("My Document")  # Should not raise
        validate_title("Über Doc 日本語")  # Unicode allowed
        validate_title("12345")  # Numeric string
        validate_title("a")  # Single char

    def test_rejects_none_when_required(self) -> None:
        """Should reject None when required."""
        with pytest.raises(ArtifactsValidationError, match="title is required"):
            validate_title(None, required=True)

    def test_accepts_none_when_optional(self) -> None:
        """Should accept None when optional."""
        validate_title(None, required=False)  # Should not raise

    def test_rejects_empty_string(self) -> None:
        """Should reject empty strings."""
        with pytest.raises(ArtifactsValidationError, match="cannot be empty"):
            validate_title("")

    def test_rejects_whitespace_only(self) -> None:
        """Should reject whitespace-only strings."""
        with pytest.raises(ArtifactsValidationError, match="cannot be empty"):
            validate_title("   ")

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(ArtifactsValidationError, match="must be a string"):
            validate_title(123)

    def test_accepts_max_length(self) -> None:
        """Should accept titles at max length (500 chars)."""
        max_title = "a" * 500
        validate_title(max_title)  # Should not raise

    def test_rejects_exceeds_max_length(self) -> None:
        """Should reject titles exceeding max length."""
        long_title = "a" * 501
        with pytest.raises(ArtifactsValidationError, match="exceeds maximum length"):
            validate_title(long_title)


class TestValidateContent:
    """Tests for validate_content function."""

    def test_accepts_valid_content(self) -> None:
        """Should accept valid content."""
        validate_content("Hello world")  # Should not raise

    def test_rejects_none_when_required(self) -> None:
        """Should reject None when required."""
        with pytest.raises(ArtifactsValidationError, match="content is required"):
            validate_content(None, required=True)

    def test_accepts_none_when_optional(self) -> None:
        """Should accept None when optional."""
        validate_content(None, required=False)  # Should not raise

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(ArtifactsValidationError, match="must be a string"):
            validate_content({"foo": "bar"})
        with pytest.raises(ArtifactsValidationError, match="must be a string"):
            validate_content(123)

    def test_accepts_empty_string(self) -> None:
        """Should accept empty string (empty content is allowed)."""
        validate_content("")  # Should not raise

    def test_handles_multibyte_utf8(self) -> None:
        """Should handle multi-byte UTF-8 correctly."""
        # Each Japanese char is 3 bytes in UTF-8
        japanese_content = "日" * 1000000  # ~3MB
        validate_content(japanese_content)  # Should not raise


class TestValidateKind:
    """Tests for validate_kind function."""

    def test_accepts_all_valid_kinds(self) -> None:
        """Should accept all valid kind values."""
        valid_kinds = ["text", "code", "sheet", "image", "diagram", "html", "custom"]
        for kind in valid_kinds:
            validate_kind(kind)  # Should not raise

    def test_accepts_none_when_optional(self) -> None:
        """Should accept None when optional."""
        validate_kind(None, required=False)  # Should not raise

    def test_rejects_none_when_required(self) -> None:
        """Should reject None when required."""
        with pytest.raises(ArtifactsValidationError, match="kind is required"):
            validate_kind(None, required=True)

    def test_rejects_invalid_kind_values(self) -> None:
        """Should reject invalid kind values."""
        with pytest.raises(ArtifactsValidationError, match="must be one of:"):
            validate_kind("pdf")

    def test_is_case_sensitive(self) -> None:
        """Should be case sensitive."""
        with pytest.raises(ArtifactsValidationError):
            validate_kind("TEXT")
        with pytest.raises(ArtifactsValidationError):
            validate_kind("Code")

    def test_rejects_empty_string(self) -> None:
        """Should reject empty string."""
        with pytest.raises(ArtifactsValidationError):
            validate_kind("")

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(ArtifactsValidationError, match="must be a string"):
            validate_kind(123)


class TestValidateStreamingState:
    """Tests for validate_streaming_state function."""

    def test_accepts_all_valid_states(self) -> None:
        """Should accept all valid streaming state values."""
        valid_states = ["draft", "streaming", "paused", "final", "error"]
        for state in valid_states:
            validate_streaming_state(state)  # Should not raise

    def test_accepts_none_when_optional(self) -> None:
        """Should accept None when optional."""
        validate_streaming_state(None, required=False)  # Should not raise

    def test_rejects_none_when_required(self) -> None:
        """Should reject None when required."""
        with pytest.raises(ArtifactsValidationError, match="streaming_state is required"):
            validate_streaming_state(None, required=True)

    def test_rejects_invalid_state_values(self) -> None:
        """Should reject invalid state values."""
        with pytest.raises(ArtifactsValidationError, match="must be one of:"):
            validate_streaming_state("pending")

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(ArtifactsValidationError, match="must be a string"):
            validate_streaming_state(1)


class TestValidateTags:
    """Tests for validate_tags function."""

    def test_accepts_valid_tags_array(self) -> None:
        """Should accept valid tags array."""
        validate_tags(["tag1", "tag2"])  # Should not raise
        validate_tags(["tag-with-hyphen", "tag_with_underscore"])  # Should not raise

    def test_accepts_empty_array(self) -> None:
        """Should accept empty array."""
        validate_tags([])  # Should not raise

    def test_accepts_none(self) -> None:
        """Should accept None (optional)."""
        validate_tags(None)  # Should not raise

    def test_accepts_max_50_tags(self) -> None:
        """Should accept max 50 tags."""
        fifty_tags = [f"tag{i}" for i in range(50)]
        validate_tags(fifty_tags)  # Should not raise

    def test_rejects_more_than_50_tags(self) -> None:
        """Should reject more than 50 tags."""
        fifty_one_tags = [f"tag{i}" for i in range(51)]
        with pytest.raises(ArtifactsValidationError, match="exceeds maximum"):
            validate_tags(fifty_one_tags)

    def test_accepts_tags_at_max_length(self) -> None:
        """Should accept tags at max length (100 chars)."""
        max_tag = "a" * 100
        validate_tags([max_tag])  # Should not raise

    def test_rejects_tags_exceeding_max_length(self) -> None:
        """Should reject tags exceeding max length."""
        long_tag = "a" * 101
        with pytest.raises(ArtifactsValidationError, match="exceeds maximum length"):
            validate_tags([long_tag])

    def test_rejects_non_list_types(self) -> None:
        """Should reject non-list types."""
        with pytest.raises(ArtifactsValidationError, match="must be a list"):
            validate_tags("tag")

    def test_rejects_non_string_elements(self) -> None:
        """Should reject non-string elements."""
        with pytest.raises(ArtifactsValidationError, match="must be a string"):
            validate_tags(["tag", 123])

    def test_rejects_empty_tag_strings(self) -> None:
        """Should reject empty tag strings."""
        with pytest.raises(ArtifactsValidationError, match="cannot be empty"):
            validate_tags(["valid", ""])


class TestValidateLimit:
    """Tests for validate_limit function."""

    def test_accepts_valid_limits(self) -> None:
        """Should accept valid limits."""
        validate_limit(1)  # Should not raise
        validate_limit(50)  # Should not raise
        validate_limit(1000)  # Should not raise

    def test_accepts_none(self) -> None:
        """Should accept None (optional)."""
        validate_limit(None)  # Should not raise

    def test_rejects_limit_less_than_1(self) -> None:
        """Should reject limit < 1."""
        with pytest.raises(ArtifactsValidationError, match="must be at least 1"):
            validate_limit(0)
        with pytest.raises(ArtifactsValidationError, match="must be at least 1"):
            validate_limit(-1)

    def test_rejects_limit_exceeds_max(self) -> None:
        """Should reject limit > 1000."""
        with pytest.raises(ArtifactsValidationError, match="exceeds maximum"):
            validate_limit(1001)

    def test_rejects_non_integer_types(self) -> None:
        """Should reject non-integer types."""
        with pytest.raises(ArtifactsValidationError, match="must be an integer"):
            validate_limit("50")
        with pytest.raises(ArtifactsValidationError, match="must be an integer"):
            validate_limit(50.5)


class TestValidateOffset:
    """Tests for validate_offset function."""

    def test_accepts_valid_offsets(self) -> None:
        """Should accept valid offsets."""
        validate_offset(0)  # Should not raise
        validate_offset(100)  # Should not raise

    def test_accepts_none(self) -> None:
        """Should accept None (optional)."""
        validate_offset(None)  # Should not raise

    def test_rejects_negative_offsets(self) -> None:
        """Should reject negative offsets."""
        with pytest.raises(ArtifactsValidationError, match="must be non-negative"):
            validate_offset(-1)

    def test_rejects_non_integer_types(self) -> None:
        """Should reject non-integer types."""
        with pytest.raises(ArtifactsValidationError, match="must be an integer"):
            validate_offset("10")


class TestValidateVersion:
    """Tests for validate_version function."""

    def test_accepts_valid_versions(self) -> None:
        """Should accept valid versions."""
        validate_version(1)  # Should not raise
        validate_version(100)  # Should not raise

    def test_rejects_none(self) -> None:
        """Should reject None (required field)."""
        with pytest.raises(ArtifactsValidationError, match="is required"):
            validate_version(None)

    def test_rejects_version_less_than_1(self) -> None:
        """Should reject version < 1."""
        with pytest.raises(ArtifactsValidationError, match="must be at least 1"):
            validate_version(0)
        with pytest.raises(ArtifactsValidationError, match="must be at least 1"):
            validate_version(-1)

    def test_rejects_non_integer_types(self) -> None:
        """Should reject non-integer types."""
        with pytest.raises(ArtifactsValidationError, match="must be an integer"):
            validate_version("1")
        with pytest.raises(ArtifactsValidationError, match="must be an integer"):
            validate_version(1.5)


class TestValidateSessionId:
    """Tests for validate_session_id function."""

    def test_accepts_valid_session_ids(self) -> None:
        """Should accept valid session IDs."""
        validate_session_id("stream-abc123-xyz789")  # Should not raise
        validate_session_id("sess_123")  # Should not raise

    def test_rejects_none(self) -> None:
        """Should reject None."""
        with pytest.raises(ArtifactsValidationError, match="is required"):
            validate_session_id(None)

    def test_rejects_empty_strings(self) -> None:
        """Should reject empty strings."""
        with pytest.raises(ArtifactsValidationError, match="cannot be empty"):
            validate_session_id("")

    def test_rejects_whitespace_only(self) -> None:
        """Should reject whitespace-only strings."""
        with pytest.raises(ArtifactsValidationError, match="cannot be empty"):
            validate_session_id("   ")

    def test_rejects_non_string_types(self) -> None:
        """Should reject non-string types."""
        with pytest.raises(ArtifactsValidationError, match="must be a string"):
            validate_session_id(123)


class TestValidateTimestamp:
    """Tests for validate_timestamp function."""

    def test_accepts_valid_timestamps(self) -> None:
        """Should accept valid timestamps."""
        import time
        validate_timestamp(int(time.time() * 1000), "created_at")  # Should not raise
        validate_timestamp(1234567890000, "updated_at")  # Should not raise

    def test_accepts_none(self) -> None:
        """Should accept None (optional)."""
        validate_timestamp(None, "created_at")  # Should not raise

    def test_rejects_negative_timestamps(self) -> None:
        """Should reject negative timestamps."""
        with pytest.raises(ArtifactsValidationError, match="must be a valid Unix timestamp"):
            validate_timestamp(-1, "created_at")

    def test_rejects_non_number_types(self) -> None:
        """Should reject non-number types."""
        with pytest.raises(ArtifactsValidationError, match="must be a number"):
            validate_timestamp("123", "created_at")

    def test_includes_field_name_in_error(self) -> None:
        """Should include field name in error."""
        with pytest.raises(ArtifactsValidationError, match="my_field"):
            validate_timestamp(-1, "my_field")


class TestValidateSortBy:
    """Tests for validate_sort_by function."""

    def test_accepts_valid_sort_fields(self) -> None:
        """Should accept valid sort fields."""
        validate_sort_by("createdAt")  # Should not raise
        validate_sort_by("updatedAt")  # Should not raise
        validate_sort_by("title")  # Should not raise

    def test_accepts_none(self) -> None:
        """Should accept None (optional)."""
        validate_sort_by(None)  # Should not raise

    def test_rejects_invalid_sort_fields(self) -> None:
        """Should reject invalid sort fields."""
        with pytest.raises(ArtifactsValidationError, match="must be one of:"):
            validate_sort_by("invalid")


class TestValidateSortOrder:
    """Tests for validate_sort_order function."""

    def test_accepts_valid_sort_orders(self) -> None:
        """Should accept valid sort orders."""
        validate_sort_order("asc")  # Should not raise
        validate_sort_order("desc")  # Should not raise

    def test_accepts_none(self) -> None:
        """Should accept None (optional)."""
        validate_sort_order(None)  # Should not raise

    def test_rejects_invalid_sort_orders(self) -> None:
        """Should reject invalid sort orders."""
        with pytest.raises(ArtifactsValidationError, match="must be one of:"):
            validate_sort_order("ascending")
        with pytest.raises(ArtifactsValidationError, match="must be one of:"):
            validate_sort_order("ASC")


class TestArtifactsValidationError:
    """Tests for ArtifactsValidationError class."""

    def test_is_instance_of_exception(self) -> None:
        """Should be instance of Exception."""
        error = ArtifactsValidationError("test error", "TEST_CODE")
        assert isinstance(error, Exception)
        assert isinstance(error, ArtifactsValidationError)

    def test_has_correct_message(self) -> None:
        """Should have correct message."""
        error = ArtifactsValidationError("test message", "TEST_CODE")
        assert str(error) == "test message"

    def test_has_code_property(self) -> None:
        """Should include code property."""
        error = ArtifactsValidationError("test message", "TEST_CODE")
        assert error.code == "TEST_CODE"

    def test_has_field_property_when_provided(self) -> None:
        """Should include field property when provided."""
        error = ArtifactsValidationError(
            "invalid value",
            "INVALID_VALUE",
            "artifact_id",
        )
        assert error.field == "artifact_id"

    def test_field_is_none_when_not_provided(self) -> None:
        """Field should be None when not provided."""
        error = ArtifactsValidationError("test message", "TEST_CODE")
        assert error.field is None


class TestEdgeCases:
    """Edge case tests for validators."""

    def test_artifact_id_with_all_allowed_characters(self) -> None:
        """Should handle artifact IDs with all allowed special characters."""
        validate_artifact_id("a-b_c.d:e")  # Should not raise

    def test_boundary_values_for_tags(self) -> None:
        """Should handle boundary values for tags array."""
        # Exactly 50 tags with exactly 100 chars each
        boundary_tags = ["a" * 100 for _ in range(50)]
        validate_tags(boundary_tags)  # Should not raise

    def test_content_with_various_encodings(self) -> None:
        """Should handle content with various encodings."""
        mixed_content = "Hello 世界 🌍 مرحبا"
        validate_content(mixed_content)  # Should not raise

    def test_very_long_but_valid_titles(self) -> None:
        """Should handle very long but valid titles."""
        long_title = "a" * 500
        validate_title(long_title)  # Should not raise

    def test_snake_case_error_messages(self) -> None:
        """Error messages should use snake_case field names for Python."""
        try:
            validate_artifact_id(None, "artifact_id")
        except ArtifactsValidationError as e:
            assert "artifact_id" in str(e)

    def test_type_name_in_error_messages(self) -> None:
        """Error messages should use Python type names."""
        try:
            validate_artifact_id(123)
        except ArtifactsValidationError as e:
            assert "int" in str(e)  # Python type name, not "number"
