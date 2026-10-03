"""
LLM Auto-Configuration Tests

Tests the two-gate approach for automatic LLM configuration:
- Gate 1: API key must be present (OPENAI_API_KEY or ANTHROPIC_API_KEY)
- Gate 2: CORTEX_FACT_EXTRACTION must be set to 'true'

These are unit tests that don't require a running Convex instance.
"""

import os
import warnings
from unittest.mock import patch

import pytest

from cortex.client import Cortex
from cortex.types import LLMConfig


class TestLLMAutoConfiguration:
    """Test the two-gate approach for LLM auto-configuration."""

    @pytest.fixture(autouse=True)
    def clean_env(self):
        """Clear relevant env vars before each test."""
        env_vars_to_clear = [
            "CORTEX_FACT_EXTRACTION",
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
        ]
        original_values = {}

        for var in env_vars_to_clear:
            original_values[var] = os.environ.get(var)
            if var in os.environ:
                del os.environ[var]

        yield

        # Restore original values
        for var, value in original_values.items():
            if value is not None:
                os.environ[var] = value
            elif var in os.environ:
                del os.environ[var]

    def test_no_auto_config_when_only_api_key_set(self):
        """Gate 1 satisfied, Gate 2 NOT satisfied - should NOT auto-configure."""
        os.environ["OPENAI_API_KEY"] = "sk-test-key"
        # CORTEX_FACT_EXTRACTION is NOT set

        result = Cortex._auto_configure_llm()

        assert result is None

    def test_no_auto_config_when_only_fact_extraction_set(self):
        """Gate 2 satisfied, Gate 1 NOT satisfied - should NOT auto-configure."""
        os.environ["CORTEX_FACT_EXTRACTION"] = "true"
        # No API key set

        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            result = Cortex._auto_configure_llm()

            assert result is None
            assert len(w) == 1
            assert "CORTEX_FACT_EXTRACTION=true but no API key found" in str(w[0].message)

    def test_auto_config_openai_when_both_gates_satisfied(self):
        """Both gates satisfied with OpenAI - should auto-configure OpenAI."""
        os.environ["CORTEX_FACT_EXTRACTION"] = "true"
        os.environ["OPENAI_API_KEY"] = "sk-test-openai-key"

        result = Cortex._auto_configure_llm()

        assert result is not None
        assert result.provider == "openai"
        assert result.api_key == "sk-test-openai-key"

    def test_auto_config_anthropic_when_both_gates_satisfied(self):
        """Both gates satisfied with Anthropic only - should auto-configure Anthropic."""
        os.environ["CORTEX_FACT_EXTRACTION"] = "true"
        os.environ["ANTHROPIC_API_KEY"] = "sk-test-anthropic-key"

        result = Cortex._auto_configure_llm()

        assert result is not None
        assert result.provider == "anthropic"
        assert result.api_key == "sk-test-anthropic-key"

    def test_prefers_openai_over_anthropic(self):
        """When both API keys present, OpenAI should take priority."""
        os.environ["CORTEX_FACT_EXTRACTION"] = "true"
        os.environ["OPENAI_API_KEY"] = "sk-test-openai-key"
        os.environ["ANTHROPIC_API_KEY"] = "sk-test-anthropic-key"

        result = Cortex._auto_configure_llm()

        assert result is not None
        assert result.provider == "openai"
        assert result.api_key == "sk-test-openai-key"

    def test_no_auto_config_when_fact_extraction_false(self):
        """CORTEX_FACT_EXTRACTION='false' should NOT trigger auto-config."""
        os.environ["CORTEX_FACT_EXTRACTION"] = "false"
        os.environ["OPENAI_API_KEY"] = "sk-test-key"

        result = Cortex._auto_configure_llm()

        assert result is None

    def test_no_auto_config_when_fact_extraction_empty(self):
        """CORTEX_FACT_EXTRACTION='' should NOT trigger auto-config."""
        os.environ["CORTEX_FACT_EXTRACTION"] = ""
        os.environ["OPENAI_API_KEY"] = "sk-test-key"

        result = Cortex._auto_configure_llm()

        assert result is None

    def test_no_auto_config_when_fact_extraction_any_other_value(self):
        """CORTEX_FACT_EXTRACTION='yes' (not 'true') should NOT trigger auto-config."""
        os.environ["CORTEX_FACT_EXTRACTION"] = "yes"
        os.environ["OPENAI_API_KEY"] = "sk-test-key"

        result = Cortex._auto_configure_llm()

        assert result is None


class TestExplicitConfigOverride:
    """Test that explicit CortexConfig.llm takes priority over env vars."""

    def test_explicit_llm_config_structure(self):
        """Explicit LLMConfig should have correct structure."""
        explicit_llm = LLMConfig(
            provider="anthropic",
            api_key="sk-explicit-anthropic-key",
            model="claude-3-haiku-20240307",
        )

        assert explicit_llm.provider == "anthropic"
        assert explicit_llm.api_key == "sk-explicit-anthropic-key"
        assert explicit_llm.model == "claude-3-haiku-20240307"
        assert explicit_llm.max_tokens == 1000  # default
        assert explicit_llm.temperature == 0.1  # default

    def test_llm_config_defaults(self):
        """LLMConfig should have sensible defaults."""
        config = LLMConfig(provider="openai", api_key="sk-test")

        assert config.max_tokens == 1000
        assert config.temperature == 0.1
        assert config.model is None
        assert config.extract_facts is None
