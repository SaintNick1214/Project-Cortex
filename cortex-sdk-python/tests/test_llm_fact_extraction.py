"""
LLM Fact Extraction Tests

Unit tests for the LLM-based fact extraction module.
Tests the extraction logic, response parsing, and error handling
with mocked LLM responses.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cortex.llm import (
    ExtractedFact,
    OpenAIClient,
    AnthropicClient,
    create_llm_client,
    _parse_facts_response,
    _normalize_fact_type,
)
from cortex.types import LLMConfig


class TestCreateLLMClient:
    """Tests for create_llm_client factory function."""

    def test_creates_openai_client(self):
        """Creates OpenAI client for openai provider."""
        config = LLMConfig(provider="openai", api_key="test-key")
        client = create_llm_client(config)
        assert client is not None
        assert isinstance(client, OpenAIClient)

    def test_creates_anthropic_client(self):
        """Creates Anthropic client for anthropic provider."""
        config = LLMConfig(provider="anthropic", api_key="test-key")
        client = create_llm_client(config)
        assert client is not None
        assert isinstance(client, AnthropicClient)

    def test_returns_none_for_custom_without_extract_facts(self):
        """Returns None for custom provider without extractFacts."""
        config = LLMConfig(provider="custom", api_key="test-key")
        client = create_llm_client(config)
        assert client is None

    @pytest.mark.asyncio
    async def test_creates_custom_client_with_extract_facts(self):
        """Creates custom client with extractFacts function."""
        async def custom_extractor(user_msg, agent_msg):
            return [{"fact": "Custom fact", "factType": "preference", "confidence": 0.9}]

        config = LLMConfig(
            provider="custom",
            api_key="test-key",
            extract_facts=custom_extractor,
        )
        client = create_llm_client(config)
        assert client is not None

        facts = await client.extract_facts("test", "response")
        assert len(facts) == 1
        assert facts[0].fact == "Custom fact"


class TestOpenAIClient:
    """Tests for OpenAI client implementation."""

    @pytest.mark.asyncio
    async def test_extracts_facts_from_valid_response(self):
        """Extracts facts from valid JSON response."""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=json.dumps({
                        "facts": [
                            {
                                "fact": "User prefers TypeScript",
                                "factType": "preference",
                                "confidence": 0.95,
                                "subject": "User",
                                "predicate": "prefers",
                                "object": "TypeScript",
                                "tags": ["programming"],
                            }
                        ]
                    })
                )
            )
        ]

        with patch("cortex.llm.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_openai.return_value = mock_client

            config = LLMConfig(provider="openai", api_key="test-key")
            client = OpenAIClient(config)

            facts = await client.extract_facts("I love TypeScript", "Great choice!")

            assert facts is not None
            assert len(facts) == 1
            assert facts[0].fact == "User prefers TypeScript"
            assert facts[0].fact_type == "preference"
            assert facts[0].confidence == 0.95

    @pytest.mark.asyncio
    async def test_handles_empty_facts_array(self):
        """Handles empty facts array response."""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(message=MagicMock(content=json.dumps({"facts": []})))
        ]

        with patch("cortex.llm.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_openai.return_value = mock_client

            config = LLMConfig(provider="openai", api_key="test-key")
            client = OpenAIClient(config)

            facts = await client.extract_facts("Hello", "Hi there!")

            assert facts is not None
            assert len(facts) == 0

    @pytest.mark.asyncio
    async def test_handles_api_errors_gracefully(self):
        """Handles API errors gracefully."""
        with patch("cortex.llm.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(
                side_effect=Exception("API Error")
            )
            mock_openai.return_value = mock_client

            config = LLMConfig(provider="openai", api_key="test-key")
            client = OpenAIClient(config)

            facts = await client.extract_facts("Test", "Response")

            assert facts is None

    @pytest.mark.asyncio
    async def test_uses_custom_model_from_config(self):
        """Uses custom model from configuration."""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(message=MagicMock(content=json.dumps({"facts": []})))
        ]

        with patch("cortex.llm.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_openai.return_value = mock_client

            config = LLMConfig(provider="openai", api_key="test-key", model="gpt-4o")
            client = OpenAIClient(config)

            await client.extract_facts("Test", "Response")

            # Verify the model was passed correctly
            call_args = mock_client.chat.completions.create.call_args
            assert call_args.kwargs["model"] == "gpt-4o"


class TestAnthropicClient:
    """Tests for Anthropic client implementation."""

    @pytest.mark.asyncio
    async def test_extracts_facts_from_valid_response(self):
        """Extracts facts from valid response."""
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(
                type="text",
                text=json.dumps({
                    "facts": [
                        {
                            "fact": "User works at Acme Corp",
                            "factType": "identity",
                            "confidence": 0.9,
                        }
                    ]
                }),
            )
        ]

        with patch("cortex.llm.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create = AsyncMock(return_value=mock_response)
            mock_anthropic.return_value = mock_client

            config = LLMConfig(provider="anthropic", api_key="test-key")
            client = AnthropicClient(config)

            facts = await client.extract_facts("I work at Acme Corp", "Interesting!")

            assert facts is not None
            assert len(facts) == 1
            assert facts[0].fact == "User works at Acme Corp"
            assert facts[0].fact_type == "identity"

    @pytest.mark.asyncio
    async def test_handles_api_errors_gracefully(self):
        """Handles API errors gracefully."""
        with patch("cortex.llm.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create = AsyncMock(side_effect=Exception("API Error"))
            mock_anthropic.return_value = mock_client

            config = LLMConfig(provider="anthropic", api_key="test-key")
            client = AnthropicClient(config)

            facts = await client.extract_facts("Test", "Response")

            assert facts is None


class TestParseFactsResponse:
    """Tests for response parsing logic."""

    def test_parses_valid_json(self):
        """Parses valid JSON response."""
        content = json.dumps({
            "facts": [
                {"fact": "Test fact", "factType": "preference", "confidence": 0.9}
            ]
        })
        facts = _parse_facts_response(content)

        assert facts is not None
        assert len(facts) == 1
        assert facts[0].fact == "Test fact"

    def test_handles_markdown_wrapped_json(self):
        """Handles markdown code block wrapped JSON."""
        content = "```json\n" + json.dumps({
            "facts": [{"fact": "Markdown fact", "factType": "identity", "confidence": 0.85}]
        }) + "\n```"

        facts = _parse_facts_response(content)

        assert facts is not None
        assert len(facts) == 1
        assert facts[0].fact == "Markdown fact"

    def test_handles_direct_array_response(self):
        """Handles response that is just an array."""
        content = json.dumps([
            {"fact": "Direct array fact", "factType": "preference", "confidence": 0.9}
        ])

        facts = _parse_facts_response(content)

        assert facts is not None
        assert len(facts) == 1
        assert facts[0].fact == "Direct array fact"

    def test_filters_invalid_fact_objects(self):
        """Filters out invalid fact objects."""
        content = json.dumps({
            "facts": [
                {"fact": "Valid fact", "factType": "preference", "confidence": 0.9},
                {"invalid": "object"},  # Missing required fields
                {"fact": "Another valid", "factType": "event", "confidence": 0.8},
            ]
        })

        facts = _parse_facts_response(content)

        assert facts is not None
        assert len(facts) == 2
        assert facts[0].fact == "Valid fact"
        assert facts[1].fact == "Another valid"

    def test_clamps_confidence_to_valid_range(self):
        """Clamps confidence values to 0-1 range."""
        content = json.dumps({
            "facts": [
                {"fact": "High confidence", "factType": "preference", "confidence": 1.5},
                {"fact": "Low confidence", "factType": "preference", "confidence": -0.5},
            ]
        })

        facts = _parse_facts_response(content)

        assert facts is not None
        assert len(facts) == 2
        assert facts[0].confidence == 1.0
        assert facts[1].confidence == 0.0

    def test_handles_malformed_json(self):
        """Handles malformed JSON gracefully."""
        content = "This is not JSON {{{"

        facts = _parse_facts_response(content)

        assert facts is None

    def test_filters_non_string_tags(self):
        """Filters non-string values from tags array."""
        content = json.dumps({
            "facts": [
                {
                    "fact": "Fact with mixed tags",
                    "factType": "preference",
                    "confidence": 0.9,
                    "tags": ["valid", 123, None, "another-valid"],
                }
            ]
        })

        facts = _parse_facts_response(content)

        assert facts is not None
        assert len(facts) == 1
        assert facts[0].tags == ["valid", "another-valid"]

    def test_uses_default_confidence_for_missing(self):
        """Uses default confidence when not provided."""
        content = json.dumps({
            "facts": [{"fact": "No confidence", "factType": "preference"}]
        })

        facts = _parse_facts_response(content)

        assert facts is not None
        assert facts[0].confidence == 0.7  # Default value


class TestNormalizeFactType:
    """Tests for fact type normalization."""

    def test_normalizes_valid_types(self):
        """Returns valid types unchanged."""
        assert _normalize_fact_type("preference") == "preference"
        assert _normalize_fact_type("identity") == "identity"
        assert _normalize_fact_type("knowledge") == "knowledge"
        assert _normalize_fact_type("relationship") == "relationship"
        assert _normalize_fact_type("event") == "event"
        assert _normalize_fact_type("observation") == "observation"
        assert _normalize_fact_type("custom") == "custom"

    def test_normalizes_case_insensitive(self):
        """Handles case-insensitive matching."""
        assert _normalize_fact_type("PREFERENCE") == "preference"
        assert _normalize_fact_type("Identity") == "identity"
        assert _normalize_fact_type("EVENT") == "event"

    def test_returns_custom_for_invalid_types(self):
        """Returns 'custom' for invalid types."""
        assert _normalize_fact_type("invalid") == "custom"
        assert _normalize_fact_type("unknown_type") == "custom"
        assert _normalize_fact_type("") == "custom"


class TestExtractedFact:
    """Tests for ExtractedFact dataclass."""

    def test_creates_with_required_fields(self):
        """Creates fact with required fields."""
        fact = ExtractedFact(
            fact="Test fact",
            fact_type="preference",
            confidence=0.9,
        )

        assert fact.fact == "Test fact"
        assert fact.fact_type == "preference"
        assert fact.confidence == 0.9
        assert fact.subject is None
        assert fact.predicate is None
        assert fact.object is None
        assert fact.tags is None

    def test_creates_with_all_fields(self):
        """Creates fact with all fields."""
        fact = ExtractedFact(
            fact="User prefers TypeScript",
            fact_type="preference",
            confidence=0.95,
            subject="User",
            predicate="prefers",
            object="TypeScript",
            tags=["programming", "backend"],
        )

        assert fact.fact == "User prefers TypeScript"
        assert fact.subject == "User"
        assert fact.predicate == "prefers"
        assert fact.object == "TypeScript"
        assert fact.tags == ["programming", "backend"]
