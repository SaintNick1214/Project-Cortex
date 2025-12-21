"""
Cortex SDK - Conflict Resolution Prompts

LLM prompt templates for nuanced conflict resolution when
slot or semantic matching finds potential duplicates.
"""

import json
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Conflict resolution action types
ConflictAction = Literal["UPDATE", "SUPERSEDE", "NONE", "ADD"]

VALID_ACTIONS = {"UPDATE", "SUPERSEDE", "NONE", "ADD"}


@dataclass
class ConflictDecision:
    """LLM decision for conflict resolution."""

    action: ConflictAction
    """The action to take"""

    target_fact_id: Optional[str]
    """The fact ID to act on (for UPDATE/SUPERSEDE)"""

    reason: str
    """Human-readable explanation"""

    merged_fact: Optional[str]
    """Merged/refined fact text (for UPDATE action)"""

    confidence: int = 75
    """Confidence in the decision (0-100)"""


@dataclass
class ConflictCandidate:
    """Candidate fact for conflict resolution."""

    fact: str
    """The fact text"""

    confidence: int
    """Confidence level (0-100)"""

    fact_type: Optional[str] = None
    """Type of fact (preference, identity, etc.)"""

    subject: Optional[str] = None
    """Subject entity"""

    predicate: Optional[str] = None
    """Predicate/relationship"""

    object: Optional[str] = None
    """Object entity"""

    tags: Optional[List[str]] = None
    """Tags for categorization"""


@dataclass
class PromptOptions:
    """Options for prompt generation."""

    include_examples: bool = True
    """Include examples in the prompt"""

    custom_instructions: Optional[str] = None
    """Custom system instructions"""

    max_existing_facts: int = 10
    """Maximum facts to include in prompt"""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Prompt Templates
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONFLICT_RESOLUTION_SYSTEM_PROMPT = """You are a knowledge base manager responsible for maintaining accurate, non-redundant facts about entities.

Your task is to determine the correct action when a new fact is added that may conflict with existing facts.

## Available Actions

1. **UPDATE**: The new fact refines, corrects, or provides newer information about the same concept. The existing fact should be updated with merged information.

2. **SUPERSEDE**: The new fact explicitly contradicts or replaces an existing fact. The old fact should be marked as superseded (kept for history) and the new fact becomes current.

3. **NONE**: The new fact is already captured by existing facts (duplicate or less specific). No action needed - return the existing fact.

4. **ADD**: The new fact is genuinely new information not covered by existing facts. Create a new fact record.

## Decision Guidelines

- Prefer UPDATE when the new fact adds detail to an existing fact
- Use SUPERSEDE when facts are mutually exclusive (e.g., "lives in NYC" vs "lives in LA")
- Use NONE when the new fact doesn't add value
- Use ADD when facts can coexist (different aspects of the same topic)
- Consider temporal context - newer information typically supersedes older
- Consider confidence levels - higher confidence facts take precedence

## Output Format

Return a JSON object with this exact structure:
{
  "action": "UPDATE" | "SUPERSEDE" | "NONE" | "ADD",
  "targetFactId": "fact-xxx" | null,
  "reason": "Brief explanation of the decision",
  "mergedFact": "Combined fact text if UPDATE, null otherwise",
  "confidence": 0-100
}"""


CONFLICT_RESOLUTION_EXAMPLES = """## Examples

### Example 1: UPDATE (More Specific)
New Fact: "User's favorite pizza is pepperoni"
Existing Facts:
1. [ID: fact-001] "User likes cheese pizza"

Decision:
{
  "action": "UPDATE",
  "targetFactId": "fact-001",
  "reason": "New fact is more specific about pizza preference - pepperoni over generic cheese",
  "mergedFact": "User's favorite pizza is pepperoni",
  "confidence": 85
}

### Example 2: SUPERSEDE (Location Change)
New Fact: "User moved to San Francisco"
Existing Facts:
1. [ID: fact-002] "User lives in New York"

Decision:
{
  "action": "SUPERSEDE",
  "targetFactId": "fact-002",
  "reason": "User has moved - new location supersedes old location",
  "mergedFact": null,
  "confidence": 90
}

### Example 3: NONE (Duplicate)
New Fact: "User enjoys outdoor activities"
Existing Facts:
1. [ID: fact-003] "User likes hiking and camping outdoors"

Decision:
{
  "action": "NONE",
  "targetFactId": "fact-003",
  "reason": "New fact is less specific - existing fact already captures outdoor activities",
  "mergedFact": null,
  "confidence": 95
}

### Example 4: ADD (Different Aspect)
New Fact: "User's age is 25"
Existing Facts:
1. [ID: fact-004] "User was born in 1999"

Decision:
{
  "action": "ADD",
  "targetFactId": null,
  "reason": "Age and birth year are related but distinct facts - both valid",
  "mergedFact": null,
  "confidence": 80
}

### Example 5: UPDATE (Refinement)
New Fact: "User has a dog named Rex"
Existing Facts:
1. [ID: fact-005] "User has a dog"

Decision:
{
  "action": "UPDATE",
  "targetFactId": "fact-005",
  "reason": "New fact adds the dog's name - a refinement of existing fact",
  "mergedFact": "User has a dog named Rex",
  "confidence": 90
}

### Example 6: SUPERSEDE (Preference Change)
New Fact: "User prefers purple as favorite color"
Existing Facts:
1. [ID: fact-006] "User's favorite color is blue"

Decision:
{
  "action": "SUPERSEDE",
  "targetFactId": "fact-006",
  "reason": "Color preference has changed - purple replaces blue",
  "mergedFact": null,
  "confidence": 85
}"""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Prompt Builders
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def build_system_prompt(options: Optional[PromptOptions] = None) -> str:
    """
    Build the system prompt for conflict resolution.

    Args:
        options: Optional prompt options

    Returns:
        Complete system prompt string
    """
    prompt = CONFLICT_RESOLUTION_SYSTEM_PROMPT

    if options is None or options.include_examples:
        prompt += "\n\n" + CONFLICT_RESOLUTION_EXAMPLES

    if options and options.custom_instructions:
        prompt += "\n\n## Additional Instructions\n" + options.custom_instructions

    return prompt


def build_user_prompt(
    new_fact: ConflictCandidate,
    existing_facts: List[Any],
    options: Optional[PromptOptions] = None,
) -> str:
    """
    Build the user prompt with the new fact and existing facts.

    Args:
        new_fact: The candidate fact to evaluate
        existing_facts: List of existing facts to compare against
        options: Optional prompt options

    Returns:
        Complete user prompt string
    """
    max_facts = options.max_existing_facts if options else 10
    facts_to_include = existing_facts[:max_facts]

    prompt = f"""## New Fact to Evaluate

Fact: "{new_fact.fact}"
Type: {new_fact.fact_type or "unknown"}
Subject: {new_fact.subject or "unknown"}
Predicate: {new_fact.predicate or "unknown"}
Object: {new_fact.object or "unknown"}
Confidence: {new_fact.confidence}
Tags: {", ".join(new_fact.tags) if new_fact.tags else "none"}

## Existing Facts

"""

    if not facts_to_include:
        prompt += "No existing facts found.\n"
    else:
        for index, fact in enumerate(facts_to_include, 1):
            # Handle both dict and object access
            fact_id = _get_attr(fact, "fact_id", "factId", "unknown")
            fact_text = _get_attr(fact, "fact", None, "unknown")
            fact_type = _get_attr(fact, "fact_type", "factType", "unknown")
            subject = _get_attr(fact, "subject", None, "unknown")
            predicate = _get_attr(fact, "predicate", None, "unknown")
            obj = _get_attr(fact, "object", None, "unknown")
            confidence = _get_attr(fact, "confidence", None, "unknown")
            created_at = _get_attr(fact, "created_at", "createdAt", None)

            # Format created_at
            if created_at:
                if isinstance(created_at, (int, float)):
                    created_str = datetime.fromtimestamp(created_at / 1000).isoformat()
                else:
                    created_str = str(created_at)
            else:
                created_str = "unknown"

            prompt += f"""{index}. [ID: {fact_id}] "{fact_text}"
   Type: {fact_type}
   Subject: {subject}
   Predicate: {predicate}
   Object: {obj}
   Confidence: {confidence}
   Created: {created_str}

"""

    prompt += """## Your Task

Analyze the new fact against the existing facts and determine the appropriate action.
Return ONLY a valid JSON object with your decision."""

    return prompt


def _get_attr(obj: Any, snake_attr: str, camel_attr: Optional[str], default: Any) -> Any:
    """Helper to get attribute from dict or object with snake/camel case support."""
    if isinstance(obj, dict):
        if snake_attr in obj:
            return obj[snake_attr]
        if camel_attr and camel_attr in obj:
            return obj[camel_attr]
        return default

    if hasattr(obj, snake_attr):
        return getattr(obj, snake_attr)
    if camel_attr and hasattr(obj, camel_attr):
        return getattr(obj, camel_attr)
    return default


@dataclass
class ConflictResolutionPrompt:
    """Complete prompt for conflict resolution."""

    system: str
    """System prompt"""

    user: str
    """User prompt"""


def build_conflict_resolution_prompt(
    new_fact: ConflictCandidate,
    existing_facts: List[Any],
    options: Optional[PromptOptions] = None,
) -> ConflictResolutionPrompt:
    """
    Build a complete prompt for conflict resolution.

    Args:
        new_fact: The candidate fact to evaluate
        existing_facts: List of existing facts to compare against
        options: Optional prompt options

    Returns:
        ConflictResolutionPrompt with system and user prompts
    """
    return ConflictResolutionPrompt(
        system=build_system_prompt(options),
        user=build_user_prompt(new_fact, existing_facts, options),
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Response Parsing
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def parse_conflict_decision(response: str) -> ConflictDecision:
    """
    Parse LLM response into a ConflictDecision.

    Handles various response formats and extracts JSON from text.

    Args:
        response: The LLM response string

    Returns:
        Parsed ConflictDecision

    Raises:
        ValueError: If response cannot be parsed
    """
    # Try to extract JSON from the response
    json_match = re.search(r"\{[\s\S]*\}", response)
    if not json_match:
        raise ValueError("No JSON object found in response")

    try:
        parsed = json.loads(json_match.group(0))

        # Validate required fields
        action = parsed.get("action")
        if not action or action not in VALID_ACTIONS:
            raise ValueError(f"Invalid action: {action}")

        # Normalize the response
        return ConflictDecision(
            action=action,
            target_fact_id=parsed.get("targetFactId"),
            reason=parsed.get("reason", "No reason provided"),
            merged_fact=parsed.get("mergedFact"),
            confidence=parsed.get("confidence", 75) if isinstance(parsed.get("confidence"), int) else 75,
        )
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON: {e}")


@dataclass
class ValidationResult:
    """Result of conflict decision validation."""

    valid: bool
    """Whether the decision is valid"""

    error: Optional[str] = None
    """Error message if invalid"""


def validate_conflict_decision(
    decision: ConflictDecision,
    existing_facts: List[Any],
) -> ValidationResult:
    """
    Validate a parsed conflict decision.

    Args:
        decision: The decision to validate
        existing_facts: List of existing facts for targetFactId verification

    Returns:
        ValidationResult with valid status and optional error
    """
    # UPDATE and SUPERSEDE require a targetFactId
    if decision.action in ("UPDATE", "SUPERSEDE") and not decision.target_fact_id:
        return ValidationResult(
            valid=False,
            error=f"{decision.action} action requires a targetFactId",
        )

    # Verify targetFactId exists in existing facts (but only for UPDATE/SUPERSEDE)
    # NONE and ADD actions don't require a valid targetFactId - the LLM may have
    # determined the fact is already captured without identifying the exact existing fact
    if decision.target_fact_id and decision.action in ("UPDATE", "SUPERSEDE"):
        target_exists = any(
            _get_attr(f, "fact_id", "factId", None) == decision.target_fact_id
            for f in existing_facts
        )
        if not target_exists:
            return ValidationResult(
                valid=False,
                error=f"targetFactId {decision.target_fact_id} not found in existing facts",
            )

    # UPDATE requires a mergedFact
    if decision.action == "UPDATE" and not decision.merged_fact:
        return ValidationResult(
            valid=False,
            error="UPDATE action requires a mergedFact",
        )

    # Confidence should be in range
    if decision.confidence < 0 or decision.confidence > 100:
        return ValidationResult(
            valid=False,
            error="Confidence must be between 0 and 100",
        )

    return ValidationResult(valid=True)


def get_default_decision(
    new_fact: ConflictCandidate,
    existing_facts: List[Any],
) -> ConflictDecision:
    """
    Get a default decision when LLM is unavailable.

    Falls back to simple heuristics based on similarity.

    Args:
        new_fact: The candidate fact
        existing_facts: List of existing facts

    Returns:
        ConflictDecision based on heuristics
    """
    # If no existing facts, always ADD
    if not existing_facts:
        return ConflictDecision(
            action="ADD",
            target_fact_id=None,
            reason="No existing facts found - adding new fact",
            merged_fact=None,
            confidence=100,
        )

    # Find the most similar existing fact (simple text comparison)
    normalized_new = new_fact.fact.lower().strip()
    best_match: Optional[Dict[str, Any]] = None
    best_similarity = 0.0

    for existing in existing_facts:
        existing_text = _get_attr(existing, "fact", None, "")
        if not existing_text:
            continue

        normalized_existing = existing_text.lower().strip()

        # Calculate simple word overlap similarity
        new_words = set(normalized_new.split())
        existing_words = set(normalized_existing.split())
        intersection = new_words & existing_words
        union = new_words | existing_words
        similarity = len(intersection) / len(union) if union else 0

        if similarity > best_similarity:
            best_similarity = similarity
            best_match = {
                "fact": existing,
                "similarity": similarity,
            }

    # High similarity - likely duplicate or update
    if best_match and best_match["similarity"] > 0.8:
        existing_fact = best_match["fact"]
        existing_confidence = _get_attr(existing_fact, "confidence", None, 0)
        existing_fact_id = _get_attr(existing_fact, "fact_id", "factId", None)

        # If new confidence is higher, update
        if new_fact.confidence > existing_confidence:
            return ConflictDecision(
                action="UPDATE",
                target_fact_id=existing_fact_id,
                reason="High similarity with existing fact - updating with higher confidence",
                merged_fact=new_fact.fact,
                confidence=70,
            )
        # Otherwise, skip (duplicate)
        return ConflictDecision(
            action="NONE",
            target_fact_id=existing_fact_id,
            reason="High similarity with existing fact - likely duplicate",
            merged_fact=None,
            confidence=70,
        )

    # Medium similarity - might be a supersession
    if best_match and best_match["similarity"] > 0.5:
        existing_fact = best_match["fact"]
        existing_subject = _get_attr(existing_fact, "subject", None, None)
        existing_fact_id = _get_attr(existing_fact, "fact_id", "factId", None)

        # Check if same subject - might be supersession
        if (
            new_fact.subject
            and existing_subject
            and new_fact.subject.lower() == existing_subject.lower()
        ):
            return ConflictDecision(
                action="SUPERSEDE",
                target_fact_id=existing_fact_id,
                reason="Same subject with different content - possible update to existing knowledge",
                merged_fact=None,
                confidence=60,
            )

    # Low similarity - new fact
    return ConflictDecision(
        action="ADD",
        target_fact_id=None,
        reason="No similar existing facts found - adding new fact",
        merged_fact=None,
        confidence=80,
    )


__all__ = [
    "ConflictAction",
    "ConflictDecision",
    "ConflictCandidate",
    "PromptOptions",
    "ConflictResolutionPrompt",
    "ValidationResult",
    "CONFLICT_RESOLUTION_SYSTEM_PROMPT",
    "CONFLICT_RESOLUTION_EXAMPLES",
    "build_system_prompt",
    "build_user_prompt",
    "build_conflict_resolution_prompt",
    "parse_conflict_decision",
    "validate_conflict_decision",
    "get_default_decision",
]
