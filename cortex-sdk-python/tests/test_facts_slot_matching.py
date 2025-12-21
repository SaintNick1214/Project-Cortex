"""
Unit tests for Cortex SDK - Slot Matching

Tests predicate classification, slot extraction, and SlotMatchingService.
"""

import pytest

from cortex.facts.slot_matching import (
    DEFAULT_PREDICATE_CLASSES,
    SlotMatch,
    SlotMatchingConfig,
    SlotMatchingService,
    classify_predicate,
    extract_slot,
    normalize_predicate,
    normalize_subject,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# normalize_subject Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestNormalizeSubject:
    """Tests for normalize_subject function."""

    def test_lowercase_and_trim(self) -> None:
        """Should lowercase and trim whitespace."""
        assert normalize_subject("  User  ") == "user"
        assert normalize_subject("ALICE") == "alice"
        assert normalize_subject("John Doe") == "john doe"

    def test_collapse_whitespace(self) -> None:
        """Should collapse multiple whitespace to single space."""
        assert normalize_subject("John    Doe") == "john doe"
        assert normalize_subject("  Multiple   Spaces   Here  ") == "multiple spaces here"

    def test_empty_input(self) -> None:
        """Should handle empty and None inputs."""
        assert normalize_subject("") == ""
        assert normalize_subject(None) == ""

    def test_special_characters_preserved(self) -> None:
        """Should preserve special characters."""
        assert normalize_subject("user-123") == "user-123"
        assert normalize_subject("user_id:456") == "user_id:456"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# normalize_predicate Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestNormalizePredicate:
    """Tests for normalize_predicate function."""

    def test_lowercase_and_trim(self) -> None:
        """Should lowercase and trim whitespace."""
        assert normalize_predicate("  LIVES IN  ") == "lives in"
        assert normalize_predicate("Works At") == "works at"

    def test_remove_punctuation(self) -> None:
        """Should remove punctuation."""
        assert normalize_predicate("favorite color!") == "favorite color"
        assert normalize_predicate("What's your name?") == "whats your name"
        assert normalize_predicate("Hello, World!") == "hello world"

    def test_empty_input(self) -> None:
        """Should handle empty and None inputs."""
        assert normalize_predicate("") == ""
        assert normalize_predicate(None) == ""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# classify_predicate Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestClassifyPredicate:
    """Tests for classify_predicate function."""

    def test_favorite_color_classification(self) -> None:
        """Should classify color-related predicates."""
        assert classify_predicate("favorite color") == "favorite_color"
        assert classify_predicate("Favorite Color") == "favorite_color"
        assert classify_predicate("preferred color") == "favorite_color"
        assert classify_predicate("likes the color") == "favorite_color"

    def test_location_classification(self) -> None:
        """Should classify location-related predicates."""
        assert classify_predicate("lives in") == "location"
        assert classify_predicate("resides at") == "location"
        assert classify_predicate("moved to") == "location"
        assert classify_predicate("based in") == "location"

    def test_employment_classification(self) -> None:
        """Should classify employment-related predicates."""
        assert classify_predicate("works at") == "employment"
        assert classify_predicate("employed by") == "employment"
        assert classify_predicate("job is") == "employment"
        assert classify_predicate("company is") == "employment"

    def test_age_classification(self) -> None:
        """Should classify age-related predicates."""
        assert classify_predicate("age is") == "age"
        assert classify_predicate("is years old") == "age"
        assert classify_predicate("born in") == "age"
        assert classify_predicate("birthday is") == "age"

    def test_name_classification(self) -> None:
        """Should classify name-related predicates."""
        assert classify_predicate("name is") == "name"
        assert classify_predicate("goes by") == "name"
        assert classify_predicate("known as") == "name"
        assert classify_predicate("nickname is") == "name"

    def test_relationship_status_classification(self) -> None:
        """Should classify relationship status predicates."""
        assert classify_predicate("married to") == "relationship_status"
        assert classify_predicate("dating") == "relationship_status"
        assert classify_predicate("partner is") == "relationship_status"

    def test_education_classification(self) -> None:
        """Should classify education-related predicates."""
        assert classify_predicate("studied at") == "education"
        assert classify_predicate("graduated from") == "education"
        assert classify_predicate("university is") == "education"

    def test_unknown_predicate_returns_normalized(self) -> None:
        """Should return normalized predicate for unknown predicates."""
        assert classify_predicate("something random") == "something random"
        assert classify_predicate("Unknown Predicate!") == "unknown predicate"

    def test_empty_predicate(self) -> None:
        """Should return 'unknown' for empty predicates."""
        assert classify_predicate("") == "unknown"
        assert classify_predicate(None) == "unknown"

    def test_custom_predicate_classes(self) -> None:
        """Should use custom predicate classes."""
        custom_classes = {
            "crypto": ["owns bitcoin", "holds crypto", "wallet address"],
            "favorite_color": ["loves the color"],  # Extend default
        }

        assert classify_predicate("owns bitcoin", custom_classes) == "crypto"
        assert classify_predicate("holds crypto", custom_classes) == "crypto"
        assert classify_predicate("loves the color", custom_classes) == "favorite_color"
        # Default still works
        assert classify_predicate("lives in", custom_classes) == "location"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# extract_slot Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestExtractSlot:
    """Tests for extract_slot function."""

    def test_valid_slot_extraction(self) -> None:
        """Should extract valid slots."""
        slot = extract_slot("User", "favorite color")
        assert slot is not None
        assert slot.subject == "user"
        assert slot.predicate_class == "favorite_color"

    def test_location_slot(self) -> None:
        """Should extract location slots."""
        slot = extract_slot("Alice", "lives in")
        assert slot is not None
        assert slot.subject == "alice"
        assert slot.predicate_class == "location"

    def test_missing_subject_returns_none(self) -> None:
        """Should return None when subject is missing."""
        assert extract_slot("", "favorite color") is None
        assert extract_slot(None, "favorite color") is None

    def test_missing_predicate_returns_none(self) -> None:
        """Should return None when predicate is missing."""
        assert extract_slot("User", "") is None
        assert extract_slot("User", None) is None

    def test_both_missing_returns_none(self) -> None:
        """Should return None when both are missing."""
        assert extract_slot("", "") is None
        assert extract_slot(None, None) is None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DEFAULT_PREDICATE_CLASSES Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestDefaultPredicateClasses:
    """Tests for DEFAULT_PREDICATE_CLASSES constant."""

    def test_has_expected_slots(self) -> None:
        """Should have all expected slot types."""
        expected_slots = [
            "favorite_color",
            "location",
            "employment",
            "age",
            "name",
            "relationship_status",
            "education",
            "language",
            "contact_preference",
            "food_preference",
            "music_preference",
            "hobby",
            "pet",
            "addressing_preference",
            "timezone",
        ]
        for slot in expected_slots:
            assert slot in DEFAULT_PREDICATE_CLASSES

    def test_slots_have_patterns(self) -> None:
        """Should have patterns for each slot."""
        for slot, patterns in DEFAULT_PREDICATE_CLASSES.items():
            assert isinstance(patterns, list)
            assert len(patterns) > 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SlotMatchingService Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestSlotMatchingService:
    """Tests for SlotMatchingService class."""

    def test_get_slot(self) -> None:
        """Should get slot for fact."""
        # Create a mock client
        class MockClient:
            async def query(self, *args, **kwargs):
                return []

        service = SlotMatchingService(MockClient())

        slot = service.get_slot("User", "favorite color")
        assert slot is not None
        assert slot.subject == "user"
        assert slot.predicate_class == "favorite_color"

    def test_same_slot_detection(self) -> None:
        """Should detect facts in the same slot."""
        class MockClient:
            async def query(self, *args, **kwargs):
                return []

        service = SlotMatchingService(MockClient())

        fact1 = {"subject": "User", "predicate": "favorite color"}
        fact2 = {"subject": "user", "predicate": "preferred color"}
        fact3 = {"subject": "User", "predicate": "lives in"}
        fact4 = {"subject": "Alice", "predicate": "favorite color"}

        # Same subject, same slot class -> same slot
        assert service.same_slot(fact1, fact2) is True

        # Same subject, different slot class -> different slot
        assert service.same_slot(fact1, fact3) is False

        # Different subject, same slot class -> different slot
        assert service.same_slot(fact1, fact4) is False

    def test_get_predicate_classes(self) -> None:
        """Should return predicate classes."""
        class MockClient:
            async def query(self, *args, **kwargs):
                return []

        service = SlotMatchingService(MockClient())
        classes = service.get_predicate_classes()

        assert "favorite_color" in classes
        assert "location" in classes
        assert "employment" in classes

    def test_get_predicate_classes_with_custom(self) -> None:
        """Should merge custom predicate classes."""
        class MockClient:
            async def query(self, *args, **kwargs):
                return []

        config = SlotMatchingConfig(
            enabled=True,
            predicate_classes={"crypto": ["owns bitcoin", "holds crypto"]},
        )
        service = SlotMatchingService(MockClient(), config)
        classes = service.get_predicate_classes()

        assert "crypto" in classes
        assert "favorite_color" in classes  # Default still present

    def test_get_default_predicate_classes_static(self) -> None:
        """Should return default predicate classes via static method."""
        classes = SlotMatchingService.get_default_predicate_classes()
        assert classes == DEFAULT_PREDICATE_CLASSES


@pytest.mark.asyncio
class TestSlotMatchingServiceAsync:
    """Async tests for SlotMatchingService."""

    async def test_find_slot_conflicts_no_conflicts(self) -> None:
        """Should return no conflicts when no matching facts."""
        class MockClient:
            async def query(self, *args, **kwargs):
                return []

        service = SlotMatchingService(MockClient())

        result = await service.find_slot_conflicts(
            {"subject": "User", "predicate": "favorite color", "object": "blue"},
            "space-1",
        )

        assert result.has_conflict is False
        assert len(result.conflicting_facts) == 0

    async def test_find_slot_conflicts_with_conflicts(self) -> None:
        """Should find conflicts when matching facts exist."""
        existing_fact = {
            "factId": "fact-123",
            "subject": "User",
            "predicate": "preferred color",
            "object": "red",
            "supersededBy": None,
        }

        class MockClient:
            async def query(self, *args, **kwargs):
                return [existing_fact]

        service = SlotMatchingService(MockClient())

        result = await service.find_slot_conflicts(
            {"subject": "User", "predicate": "favorite color", "object": "blue"},
            "space-1",
        )

        assert result.has_conflict is True
        assert len(result.conflicting_facts) == 1
        assert result.conflicting_facts[0]["factId"] == "fact-123"

    async def test_find_slot_conflicts_excludes_superseded(self) -> None:
        """Should exclude superseded facts from conflicts."""
        superseded_fact = {
            "factId": "fact-old",
            "subject": "User",
            "predicate": "preferred color",
            "object": "red",
            "supersededBy": "fact-new",  # Superseded
        }

        class MockClient:
            async def query(self, *args, **kwargs):
                return [superseded_fact]

        service = SlotMatchingService(MockClient())

        result = await service.find_slot_conflicts(
            {"subject": "User", "predicate": "favorite color", "object": "blue"},
            "space-1",
        )

        assert result.has_conflict is False
        assert len(result.conflicting_facts) == 0

    async def test_find_slot_conflicts_no_slot_extraction(self) -> None:
        """Should return no conflicts when slot cannot be extracted."""
        class MockClient:
            async def query(self, *args, **kwargs):
                return []

        service = SlotMatchingService(MockClient())

        # Missing subject - no slot extraction possible
        result = await service.find_slot_conflicts(
            {"subject": "", "predicate": "favorite color"},
            "space-1",
        )

        assert result.has_conflict is False
        assert result.slot is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
