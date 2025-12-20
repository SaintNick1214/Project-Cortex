"""
Cortex SDK - Slot-Based Fact Matching

Provides fast O(1) slot-based matching for facts that represent
the same semantic "slot" (e.g., favorite_color, location, employment).

This is the first stage of the belief revision pipeline, catching
obvious conflicts before more expensive semantic/LLM processing.
"""

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class SlotMatch:
    """Represents a semantic slot - a category that should have ONE current value."""

    subject: str
    """Normalized entity (e.g., "user", "alice")"""

    predicate_class: str
    """Normalized predicate category"""


@dataclass
class SlotMatchingConfig:
    """Configuration for slot matching behavior."""

    enabled: bool = True
    """Enable/disable slot matching"""

    predicate_classes: Optional[Dict[str, List[str]]] = None
    """Custom predicate classes to add/override defaults"""

    normalize_subjects: bool = True
    """Whether to normalize subjects (lowercase, trim)"""


@dataclass
class SlotConflictResult:
    """Result of slot conflict search."""

    has_conflict: bool
    """Whether a slot conflict was found"""

    slot: Optional[SlotMatch] = None
    """The slot that was matched"""

    conflicting_facts: List[Any] = field(default_factory=list)
    """Existing facts in the same slot"""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Predicate Classification
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Default predicate classes - maps semantic slots to predicate patterns
# Each key is a slot name, values are patterns that match predicates
# belonging to that slot. Order matters - first match wins.
DEFAULT_PREDICATE_CLASSES: Dict[str, List[str]] = {
    # Color preferences
    "favorite_color": [
        "favorite color",
        "favorite colour",
        "preferred color",
        "preferred colour",
        "likes color",
        "likes the color",
        "prefers color",
        "color preference",
        "colour preference",
    ],
    # Location/residence
    "location": [
        "lives in",
        "lives at",
        "resides in",
        "resides at",
        "located in",
        "based in",
        "home is",
        "hometown is",
        "current location",
        "current city",
        "current country",
        "moved to",
    ],
    # Employment
    "employment": [
        "works at",
        "works for",
        "employed by",
        "employed at",
        "job at",
        "job is",
        "occupation is",
        "profession is",
        "career is",
        "employer is",
        "company is",
        "workplace is",
    ],
    # Age
    "age": [
        "age is",
        "is years old",
        "years old",
        "born in",
        "birthday is",
        "birth date",
        "date of birth",
    ],
    # Name/identity
    "name": [
        "name is",
        "called",
        "named",
        "goes by",
        "known as",
        "nickname is",
        "full name is",
        "first name is",
        "last name is",
    ],
    # Relationship status
    "relationship_status": [
        "married to",
        "engaged to",
        "dating",
        "in a relationship with",
        "single",
        "divorced",
        "widowed",
        "partner is",
        "spouse is",
        "relationship status",
    ],
    # Education
    "education": [
        "studied at",
        "graduated from",
        "attends",
        "attended",
        "school is",
        "university is",
        "college is",
        "degree is",
        "major is",
        "education is",
    ],
    # Language preferences
    "language": [
        "speaks",
        "native language",
        "primary language",
        "preferred language",
        "language is",
        "fluent in",
    ],
    # Contact preferences
    "contact_preference": [
        "prefers to be contacted",
        "contact preference",
        "preferred contact",
        "best way to reach",
        "communication preference",
    ],
    # Food preferences
    "food_preference": [
        "favorite food",
        "favorite cuisine",
        "dietary restriction",
        "diet is",
        "vegetarian",
        "vegan",
        "allergic to",
        "food allergy",
        "likes to eat",
        "favorite meal",
    ],
    # Music preferences
    "music_preference": [
        "favorite music",
        "favorite genre",
        "favorite artist",
        "favorite band",
        "favorite song",
        "listens to",
        "music taste",
    ],
    # Hobby/interest
    "hobby": [
        "hobby is",
        "hobbies are",
        "enjoys",
        "likes doing",
        "interested in",
        "passion is",
        "pastime is",
    ],
    # Pet
    "pet": [
        "has a pet",
        "pet is",
        "owns a",
        "pet name is",
        "has a dog",
        "has a cat",
    ],
    # Addressing preference
    "addressing_preference": [
        "prefers to be called",
        "prefers to be addressed",
        "preferred name",
        "call me",
        "address me as",
        "pronoun",
        "pronouns are",
    ],
    # Time zone
    "timezone": [
        "timezone is",
        "time zone is",
        "in timezone",
        "local time",
    ],
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Utility Functions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def normalize_subject(subject: Optional[str]) -> str:
    """
    Normalize a subject string for matching.

    Args:
        subject: The subject string to normalize

    Returns:
        Normalized subject string (lowercase, trimmed, collapsed whitespace)
    """
    if not subject:
        return ""
    return re.sub(r"\s+", " ", subject.lower().strip())


def normalize_predicate(predicate: Optional[str]) -> str:
    """
    Normalize a predicate string for classification.

    Args:
        predicate: The predicate string to normalize

    Returns:
        Normalized predicate string (lowercase, trimmed, no punctuation)
    """
    if not predicate:
        return ""
    # Lowercase and trim
    normalized = predicate.lower().strip()
    # Collapse whitespace
    normalized = re.sub(r"\s+", " ", normalized)
    # Remove punctuation
    normalized = re.sub(r"[.,!?;:'\"]+", "", normalized)
    return normalized


def classify_predicate(
    predicate: Optional[str],
    custom_classes: Optional[Dict[str, List[str]]] = None,
) -> str:
    """
    Classify a predicate into a slot class.

    Args:
        predicate: The predicate to classify
        custom_classes: Optional custom predicate classes to use

    Returns:
        The slot class name, or the normalized predicate if no class matches
    """
    if not predicate:
        return "unknown"

    normalized = normalize_predicate(predicate)

    # Merge default and custom classes (arrays are merged, not replaced)
    if custom_classes:
        classes = dict(DEFAULT_PREDICATE_CLASSES)
        for key, patterns in custom_classes.items():
            if key in classes:
                # Merge arrays - custom patterns come first (higher priority)
                classes[key] = patterns + classes[key]
            else:
                # New slot class
                classes[key] = patterns
    else:
        classes = DEFAULT_PREDICATE_CLASSES

    # Check each class for a match
    for class_name, patterns in classes.items():
        for pattern in patterns:
            if pattern.lower() in normalized:
                return class_name

    # No class match - return normalized predicate as fallback
    return normalized


def extract_slot(
    subject: Optional[str],
    predicate: Optional[str],
    custom_classes: Optional[Dict[str, List[str]]] = None,
) -> Optional[SlotMatch]:
    """
    Extract a slot from a fact candidate.

    Args:
        subject: The fact subject
        predicate: The fact predicate
        custom_classes: Optional custom predicate classes

    Returns:
        SlotMatch if extraction successful, None otherwise
    """
    normalized_subject = normalize_subject(subject)

    # Need at least a subject and predicate for slot matching
    if not normalized_subject or not predicate:
        return None

    return SlotMatch(
        subject=normalized_subject,
        predicate_class=classify_predicate(predicate, custom_classes),
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SlotMatchingService
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class SlotMatchingService:
    """
    Service for slot-based fact conflict detection.

    Example:
        >>> slot_service = SlotMatchingService(convex_client)
        >>>
        >>> # Check if a new fact conflicts with existing facts in the same slot
        >>> result = await slot_service.find_slot_conflicts(
        ...     {
        ...         "subject": "user-123",
        ...         "predicate": "prefers purple",
        ...         "object": "purple",
        ...     },
        ...     "memory-space-1"
        ... )
        >>>
        >>> if result.has_conflict:
        ...     print("Found conflicting facts:", result.conflicting_facts)
    """

    def __init__(
        self,
        client: Any,
        config: Optional[SlotMatchingConfig] = None,
    ) -> None:
        """
        Initialize the slot matching service.

        Args:
            client: Convex client instance
            config: Optional slot matching configuration
        """
        self._client = client
        self._custom_classes = config.predicate_classes if config else None

    async def find_slot_conflicts(
        self,
        candidate: Dict[str, Optional[str]],
        memory_space_id: str,
        user_id: Optional[str] = None,
    ) -> SlotConflictResult:
        """
        Find existing facts that occupy the same slot as the candidate.

        Args:
            candidate: The fact candidate to check (with subject, predicate, object)
            memory_space_id: Memory space to search in
            user_id: Optional user ID filter

        Returns:
            SlotConflictResult with conflict status and any conflicting facts
        """
        # Extract slot from candidate
        slot = extract_slot(
            candidate.get("subject"),
            candidate.get("predicate"),
            self._custom_classes,
        )

        # If we can't extract a slot, no conflict detection possible
        if not slot:
            return SlotConflictResult(
                has_conflict=False,
                conflicting_facts=[],
            )

        # Query for facts with the same subject
        subject_facts = await self._query_by_subject(
            memory_space_id,
            candidate.get("subject") or "",
            user_id,
        )

        # Filter to facts in the same slot class
        conflicting_facts = []
        for fact in subject_facts:
            fact_slot = extract_slot(
                getattr(fact, "subject", None) or fact.get("subject") if isinstance(fact, dict) else None,
                getattr(fact, "predicate", None) or fact.get("predicate") if isinstance(fact, dict) else None,
                self._custom_classes,
            )

            if fact_slot and fact_slot.predicate_class == slot.predicate_class:
                # Check if fact is not superseded
                superseded_by = getattr(fact, "superseded_by", None) or (
                    fact.get("supersededBy") if isinstance(fact, dict) else None
                )
                if superseded_by is None:
                    conflicting_facts.append(fact)

        return SlotConflictResult(
            has_conflict=len(conflicting_facts) > 0,
            slot=slot,
            conflicting_facts=conflicting_facts,
        )

    async def _query_by_subject(
        self,
        memory_space_id: str,
        subject: str,
        user_id: Optional[str] = None,
    ) -> List[Any]:
        """
        Query facts by subject from the database.

        Args:
            memory_space_id: Memory space to search in
            subject: Subject to search for
            user_id: Optional user ID filter

        Returns:
            List of facts matching the subject
        """
        try:
            from .._utils import filter_none_values

            facts = await self._client.query(
                "facts:queryBySubject",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "subject": normalize_subject(subject),
                    "userId": user_id,
                    "includeSuperseded": False,
                    "limit": 100,  # Reasonable limit for slot matching
                }),
            )
            return facts or []
        except Exception:
            # Fallback if query fails
            return []

    def get_slot(
        self,
        subject: Optional[str],
        predicate: Optional[str],
    ) -> Optional[SlotMatch]:
        """
        Get the slot for a fact (useful for debugging/inspection).

        Args:
            subject: The fact subject
            predicate: The fact predicate

        Returns:
            SlotMatch if extraction successful, None otherwise
        """
        return extract_slot(subject, predicate, self._custom_classes)

    def same_slot(
        self,
        fact1: Dict[str, Optional[str]],
        fact2: Dict[str, Optional[str]],
    ) -> bool:
        """
        Check if two facts would be in the same slot.

        Args:
            fact1: First fact (with subject, predicate)
            fact2: Second fact (with subject, predicate)

        Returns:
            True if both facts are in the same slot
        """
        slot1 = extract_slot(
            fact1.get("subject"),
            fact1.get("predicate"),
            self._custom_classes,
        )
        slot2 = extract_slot(
            fact2.get("subject"),
            fact2.get("predicate"),
            self._custom_classes,
        )

        if not slot1 or not slot2:
            return False

        return (
            slot1.subject == slot2.subject
            and slot1.predicate_class == slot2.predicate_class
        )

    def get_predicate_classes(self) -> Dict[str, List[str]]:
        """
        Get all predicate classes (default + custom).

        Returns:
            Dictionary of predicate class names to patterns
        """
        if self._custom_classes:
            return {**DEFAULT_PREDICATE_CLASSES, **self._custom_classes}
        return DEFAULT_PREDICATE_CLASSES

    @staticmethod
    def get_default_predicate_classes() -> Dict[str, List[str]]:
        """
        Get the default predicate classes.

        Returns:
            Dictionary of default predicate class names to patterns
        """
        return DEFAULT_PREDICATE_CLASSES


__all__ = [
    "SlotMatch",
    "SlotMatchingConfig",
    "SlotConflictResult",
    "DEFAULT_PREDICATE_CLASSES",
    "normalize_subject",
    "normalize_predicate",
    "classify_predicate",
    "extract_slot",
    "SlotMatchingService",
]
