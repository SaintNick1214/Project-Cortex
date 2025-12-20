"""
Unit tests for Cortex SDK - Conflict Resolution Prompts

Tests prompt building, decision parsing, and default heuristics.
"""

import pytest

from cortex.facts.conflict_prompts import (
    CONFLICT_RESOLUTION_EXAMPLES,
    CONFLICT_RESOLUTION_SYSTEM_PROMPT,
    ConflictCandidate,
    ConflictDecision,
    PromptOptions,
    build_conflict_resolution_prompt,
    build_system_prompt,
    build_user_prompt,
    get_default_decision,
    parse_conflict_decision,
    validate_conflict_decision,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# build_system_prompt Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestBuildSystemPrompt:
    """Tests for build_system_prompt function."""

    def test_default_includes_examples(self) -> None:
        """Should include examples by default."""
        prompt = build_system_prompt()
        assert CONFLICT_RESOLUTION_SYSTEM_PROMPT in prompt
        assert CONFLICT_RESOLUTION_EXAMPLES in prompt

    def test_exclude_examples(self) -> None:
        """Should exclude examples when specified."""
        options = PromptOptions(include_examples=False)
        prompt = build_system_prompt(options)
        assert CONFLICT_RESOLUTION_SYSTEM_PROMPT in prompt
        assert CONFLICT_RESOLUTION_EXAMPLES not in prompt

    def test_custom_instructions(self) -> None:
        """Should include custom instructions."""
        options = PromptOptions(custom_instructions="Always prefer SUPERSEDE over UPDATE")
        prompt = build_system_prompt(options)
        assert "Always prefer SUPERSEDE over UPDATE" in prompt
        assert "## Additional Instructions" in prompt

    def test_has_action_definitions(self) -> None:
        """Should include all action definitions."""
        prompt = build_system_prompt()
        assert "**UPDATE**" in prompt
        assert "**SUPERSEDE**" in prompt
        assert "**NONE**" in prompt
        assert "**ADD**" in prompt

    def test_has_output_format(self) -> None:
        """Should include output format specification."""
        prompt = build_system_prompt()
        assert "## Output Format" in prompt
        assert '"action"' in prompt
        assert '"targetFactId"' in prompt


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# build_user_prompt Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestBuildUserPrompt:
    """Tests for build_user_prompt function."""

    def test_includes_new_fact_details(self) -> None:
        """Should include new fact details."""
        new_fact = ConflictCandidate(
            fact="User prefers purple",
            confidence=90,
            fact_type="preference",
            subject="user-123",
            predicate="favorite color",
            object="purple",
            tags=["important"],
        )
        prompt = build_user_prompt(new_fact, [])

        assert "User prefers purple" in prompt
        assert "preference" in prompt
        assert "user-123" in prompt
        assert "favorite color" in prompt
        assert "purple" in prompt
        assert "90" in prompt
        assert "important" in prompt

    def test_no_existing_facts(self) -> None:
        """Should handle no existing facts."""
        new_fact = ConflictCandidate(fact="Test fact", confidence=85)
        prompt = build_user_prompt(new_fact, [])

        assert "No existing facts found" in prompt

    def test_includes_existing_facts(self) -> None:
        """Should include existing facts."""
        new_fact = ConflictCandidate(fact="User prefers purple", confidence=90)
        existing_facts = [
            {
                "factId": "fact-001",
                "fact": "User likes blue",
                "factType": "preference",
                "subject": "user-123",
                "predicate": "favorite color",
                "object": "blue",
                "confidence": 85,
                "createdAt": 1700000000000,
            },
        ]
        prompt = build_user_prompt(new_fact, existing_facts)

        assert "[ID: fact-001]" in prompt
        assert "User likes blue" in prompt
        assert "85" in prompt

    def test_limits_existing_facts(self) -> None:
        """Should limit number of existing facts."""
        new_fact = ConflictCandidate(fact="Test", confidence=90)
        existing_facts = [
            {"factId": f"fact-{i}", "fact": f"Fact {i}", "factType": "preference", "confidence": 80, "createdAt": 1700000000000}
            for i in range(20)
        ]
        options = PromptOptions(max_existing_facts=5)
        prompt = build_user_prompt(new_fact, existing_facts, options)

        # Should only include first 5 facts
        assert "[ID: fact-0]" in prompt
        assert "[ID: fact-4]" in prompt
        assert "[ID: fact-5]" not in prompt


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# build_conflict_resolution_prompt Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestBuildConflictResolutionPrompt:
    """Tests for build_conflict_resolution_prompt function."""

    def test_returns_system_and_user_prompts(self) -> None:
        """Should return both system and user prompts."""
        new_fact = ConflictCandidate(fact="Test", confidence=90)
        result = build_conflict_resolution_prompt(new_fact, [])

        assert result.system is not None
        assert result.user is not None
        assert len(result.system) > 0
        assert len(result.user) > 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# parse_conflict_decision Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestParseConflictDecision:
    """Tests for parse_conflict_decision function."""

    def test_parse_update_decision(self) -> None:
        """Should parse UPDATE decision."""
        response = '''
        Here's my analysis:
        {
            "action": "UPDATE",
            "targetFactId": "fact-001",
            "reason": "New fact is more specific",
            "mergedFact": "User's favorite pizza is pepperoni",
            "confidence": 85
        }
        '''
        decision = parse_conflict_decision(response)

        assert decision.action == "UPDATE"
        assert decision.target_fact_id == "fact-001"
        assert decision.reason == "New fact is more specific"
        assert decision.merged_fact == "User's favorite pizza is pepperoni"
        assert decision.confidence == 85

    def test_parse_supersede_decision(self) -> None:
        """Should parse SUPERSEDE decision."""
        response = '''
        {
            "action": "SUPERSEDE",
            "targetFactId": "fact-002",
            "reason": "User has moved",
            "mergedFact": null,
            "confidence": 90
        }
        '''
        decision = parse_conflict_decision(response)

        assert decision.action == "SUPERSEDE"
        assert decision.target_fact_id == "fact-002"
        assert decision.merged_fact is None
        assert decision.confidence == 90

    def test_parse_none_decision(self) -> None:
        """Should parse NONE decision."""
        response = '''
        {
            "action": "NONE",
            "targetFactId": "fact-003",
            "reason": "Duplicate fact",
            "mergedFact": null,
            "confidence": 95
        }
        '''
        decision = parse_conflict_decision(response)

        assert decision.action == "NONE"
        assert decision.target_fact_id == "fact-003"

    def test_parse_add_decision(self) -> None:
        """Should parse ADD decision."""
        response = '''
        {
            "action": "ADD",
            "targetFactId": null,
            "reason": "New information",
            "mergedFact": null,
            "confidence": 80
        }
        '''
        decision = parse_conflict_decision(response)

        assert decision.action == "ADD"
        assert decision.target_fact_id is None

    def test_default_confidence(self) -> None:
        """Should use default confidence when not provided."""
        response = '''
        {
            "action": "ADD",
            "targetFactId": null,
            "reason": "New information",
            "mergedFact": null
        }
        '''
        decision = parse_conflict_decision(response)
        assert decision.confidence == 75

    def test_default_reason(self) -> None:
        """Should use default reason when not provided."""
        response = '{"action": "ADD", "targetFactId": null, "mergedFact": null}'
        decision = parse_conflict_decision(response)
        assert decision.reason == "No reason provided"

    def test_invalid_action_raises_error(self) -> None:
        """Should raise error for invalid action."""
        response = '{"action": "INVALID", "targetFactId": null}'
        with pytest.raises(ValueError, match="Invalid action"):
            parse_conflict_decision(response)

    def test_no_json_raises_error(self) -> None:
        """Should raise error when no JSON found."""
        response = "This is just plain text without JSON"
        with pytest.raises(ValueError, match="No JSON object found"):
            parse_conflict_decision(response)

    def test_malformed_json_raises_error(self) -> None:
        """Should raise error for malformed JSON."""
        response = '{action: "ADD", targetFactId: null}'  # Missing quotes
        with pytest.raises(ValueError, match="Failed to parse JSON"):
            parse_conflict_decision(response)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# validate_conflict_decision Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestValidateConflictDecision:
    """Tests for validate_conflict_decision function."""

    def test_valid_update_decision(self) -> None:
        """Should validate correct UPDATE decision."""
        decision = ConflictDecision(
            action="UPDATE",
            target_fact_id="fact-001",
            reason="More specific",
            merged_fact="Updated fact text",
            confidence=85,
        )
        existing_facts = [{"factId": "fact-001", "fact": "Old fact"}]

        result = validate_conflict_decision(decision, existing_facts)
        assert result.valid is True
        assert result.error is None

    def test_update_without_target_fails(self) -> None:
        """Should fail UPDATE without targetFactId."""
        decision = ConflictDecision(
            action="UPDATE",
            target_fact_id=None,
            reason="Test",
            merged_fact="Test",
        )

        result = validate_conflict_decision(decision, [])
        assert result.valid is False
        assert "requires a targetFactId" in result.error

    def test_update_without_merged_fact_fails(self) -> None:
        """Should fail UPDATE without mergedFact."""
        decision = ConflictDecision(
            action="UPDATE",
            target_fact_id="fact-001",
            reason="Test",
            merged_fact=None,
        )
        existing_facts = [{"factId": "fact-001"}]

        result = validate_conflict_decision(decision, existing_facts)
        assert result.valid is False
        assert "requires a mergedFact" in result.error

    def test_supersede_without_target_fails(self) -> None:
        """Should fail SUPERSEDE without targetFactId."""
        decision = ConflictDecision(
            action="SUPERSEDE",
            target_fact_id=None,
            reason="Test",
            merged_fact=None,
        )

        result = validate_conflict_decision(decision, [])
        assert result.valid is False
        assert "requires a targetFactId" in result.error

    def test_nonexistent_target_fails(self) -> None:
        """Should fail when targetFactId doesn't exist."""
        decision = ConflictDecision(
            action="UPDATE",
            target_fact_id="fact-nonexistent",
            reason="Test",
            merged_fact="Test",
        )
        existing_facts = [{"factId": "fact-001"}]

        result = validate_conflict_decision(decision, existing_facts)
        assert result.valid is False
        assert "not found in existing facts" in result.error

    def test_invalid_confidence_fails(self) -> None:
        """Should fail for invalid confidence range."""
        decision = ConflictDecision(
            action="ADD",
            target_fact_id=None,
            reason="Test",
            merged_fact=None,
            confidence=150,  # Invalid
        )

        result = validate_conflict_decision(decision, [])
        assert result.valid is False
        assert "Confidence must be between" in result.error

    def test_valid_add_decision(self) -> None:
        """Should validate correct ADD decision."""
        decision = ConflictDecision(
            action="ADD",
            target_fact_id=None,
            reason="New information",
            merged_fact=None,
            confidence=80,
        )

        result = validate_conflict_decision(decision, [])
        assert result.valid is True

    def test_valid_none_decision(self) -> None:
        """Should validate correct NONE decision."""
        decision = ConflictDecision(
            action="NONE",
            target_fact_id="fact-001",
            reason="Duplicate",
            merged_fact=None,
            confidence=95,
        )
        existing_facts = [{"factId": "fact-001"}]

        result = validate_conflict_decision(decision, existing_facts)
        assert result.valid is True


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# get_default_decision Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestGetDefaultDecision:
    """Tests for get_default_decision function."""

    def test_no_existing_facts_returns_add(self) -> None:
        """Should return ADD when no existing facts."""
        new_fact = ConflictCandidate(fact="New fact", confidence=90)
        decision = get_default_decision(new_fact, [])

        assert decision.action == "ADD"
        assert decision.confidence == 100
        assert "No existing facts found" in decision.reason

    def test_high_similarity_lower_confidence_returns_none(self) -> None:
        """Should return NONE for high similarity with lower confidence."""
        # Use identical text to ensure high similarity
        new_fact = ConflictCandidate(
            fact="User likes blue color",
            confidence=70,  # Lower confidence
        )
        existing_facts = [
            {
                "factId": "fact-001",
                "fact": "User likes blue color",  # Identical text for high similarity
                "confidence": 90,  # Higher confidence
            }
        ]
        decision = get_default_decision(new_fact, existing_facts)

        assert decision.action == "NONE"
        assert "duplicate" in decision.reason.lower()

    def test_high_similarity_higher_confidence_returns_update(self) -> None:
        """Should return UPDATE for high similarity with higher confidence."""
        # Use identical text to ensure high similarity
        new_fact = ConflictCandidate(
            fact="User likes blue color",
            confidence=95,  # Higher confidence
        )
        existing_facts = [
            {
                "factId": "fact-001",
                "fact": "User likes blue color",  # Identical text for high similarity
                "confidence": 70,  # Lower confidence
            }
        ]
        decision = get_default_decision(new_fact, existing_facts)

        assert decision.action == "UPDATE"
        assert decision.target_fact_id == "fact-001"
        assert decision.merged_fact == new_fact.fact

    def test_medium_similarity_same_subject_returns_supersede(self) -> None:
        """Should return SUPERSEDE for medium similarity with same subject."""
        # Use overlapping words to achieve medium similarity (>0.5 and <=0.8)
        # Similarity = intersection / union
        # "User currently lives in the city of San Francisco" vs
        # "User currently lives in the city of New York"
        # Common: user, currently, lives, in, the, city, of = 7
        # Different: san, francisco, new, york = 4
        # Union = 11, Intersection = 7, Similarity = 7/11 ≈ 0.636
        new_fact = ConflictCandidate(
            fact="User currently lives in the city of San Francisco",
            confidence=90,
            subject="user-123",
        )
        existing_facts = [
            {
                "factId": "fact-001",
                "fact": "User currently lives in the city of New York",
                "confidence": 85,
                "subject": "user-123",  # Same subject
            }
        ]
        decision = get_default_decision(new_fact, existing_facts)

        assert decision.action == "SUPERSEDE"
        assert decision.target_fact_id == "fact-001"

    def test_low_similarity_returns_add(self) -> None:
        """Should return ADD for low similarity facts."""
        new_fact = ConflictCandidate(
            fact="User enjoys hiking in mountains",
            confidence=90,
        )
        existing_facts = [
            {
                "factId": "fact-001",
                "fact": "User works at a tech company",  # Completely different
                "confidence": 85,
            }
        ]
        decision = get_default_decision(new_fact, existing_facts)

        assert decision.action == "ADD"
        assert "No similar existing facts" in decision.reason


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
