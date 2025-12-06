"""
LLM Client Module for Automatic Fact Extraction

Provides a unified interface for calling OpenAI and Anthropic LLMs
to extract facts from conversations. Uses dynamic imports to avoid
requiring LLM SDKs as hard dependencies.
"""

from __future__ import annotations

import json
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, List, Literal, Optional

if TYPE_CHECKING:
    from ..types import LLMConfig


@dataclass
class ExtractedFact:
    """Extracted fact structure from LLM response."""

    fact: str
    fact_type: Literal[
        "preference",
        "identity",
        "knowledge",
        "relationship",
        "event",
        "observation",
        "custom",
    ]
    confidence: float
    subject: Optional[str] = None
    predicate: Optional[str] = None
    object: Optional[str] = None
    tags: Optional[List[str]] = None


# Default models for each provider
DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-haiku-20240307",
}

# Fact extraction system prompt
EXTRACTION_SYSTEM_PROMPT = """You are a fact extraction assistant. Extract key facts from conversations that should be remembered long-term.

Guidelines:
- Focus on user preferences, attributes, decisions, events, and relationships
- Write facts in third-person, present tense (e.g., "User prefers X")
- Be specific and actionable
- One fact = one statement
- Avoid redundancy
- Only extract facts that are explicitly stated or strongly implied
- Assign confidence based on how clearly the fact was stated (0.5-1.0)

For each fact, determine the type:
- preference: User likes/dislikes, preferred tools/methods
- identity: Personal attributes, name, role, location
- knowledge: Skills, expertise, domain knowledge
- relationship: Connections to people, organizations, projects
- event: Things that happened, milestones, decisions made
- observation: General observations about user behavior
- custom: Other important facts"""


def _build_extraction_prompt(user_message: str, agent_response: str) -> str:
    """Build the user prompt for fact extraction."""
    return f"""Extract facts from this conversation:

User: {user_message}
Agent: {agent_response}

Return ONLY a JSON object with a "facts" array. Each fact should have:
- fact: The fact statement (clear, third-person, present tense)
- factType: One of "preference", "identity", "knowledge", "relationship", "event", "observation", "custom"
- confidence: Your confidence this is meaningful (0.5-1.0)
- subject: (optional) The entity the fact is about
- predicate: (optional) The relationship or action
- object: (optional) The target of the relationship
- tags: (optional) Array of relevant tags

Example response:
{{
  "facts": [
    {{
      "fact": "User prefers TypeScript for backend development",
      "factType": "preference",
      "confidence": 0.95,
      "subject": "User",
      "predicate": "prefers",
      "object": "TypeScript for backend",
      "tags": ["programming", "backend"]
    }}
  ]
}}

If no meaningful facts can be extracted, return: {{"facts": []}}"""


def _normalize_fact_type(
    type_str: str,
) -> Literal[
    "preference",
    "identity",
    "knowledge",
    "relationship",
    "event",
    "observation",
    "custom",
]:
    """Normalize fact type to valid enum value."""
    valid_types = [
        "preference",
        "identity",
        "knowledge",
        "relationship",
        "event",
        "observation",
        "custom",
    ]
    normalized = type_str.lower().strip()
    if normalized in valid_types:
        return normalized  # type: ignore
    return "custom"


def _parse_facts_response(content: str) -> Optional[List[ExtractedFact]]:
    """Parse LLM response into ExtractedFact list."""
    try:
        # Try to extract JSON from the response (handle markdown code blocks)
        json_str = content.strip()

        # Remove markdown code blocks if present
        if json_str.startswith("```"):
            json_str = json_str.replace("```json\n", "").replace("```\n", "")
            json_str = json_str.replace("\n```", "").replace("```", "")

        parsed = json.loads(json_str)
        # Handle both {"facts": [...]} and direct array [...] formats
        if isinstance(parsed, list):
            facts_data = parsed
        else:
            facts_data = parsed.get("facts", parsed)

        if not isinstance(facts_data, list):
            print("[Cortex LLM] Invalid facts response format - not a list")
            return None

        # Validate and normalize each fact
        result: List[ExtractedFact] = []
        for f in facts_data:
            if not isinstance(f, dict):
                continue
            if not isinstance(f.get("fact"), str):
                continue
            if not isinstance(f.get("factType"), str):
                continue

            confidence = f.get("confidence", 0.7)
            if isinstance(confidence, (int, float)):
                confidence = min(1.0, max(0.0, float(confidence)))
            else:
                confidence = 0.7

            tags = f.get("tags")
            if isinstance(tags, list):
                tags = [t for t in tags if isinstance(t, str)]
            else:
                tags = None

            result.append(
                ExtractedFact(
                    fact=f["fact"],
                    fact_type=_normalize_fact_type(f["factType"]),
                    confidence=confidence,
                    subject=f.get("subject") if isinstance(f.get("subject"), str) else None,
                    predicate=f.get("predicate") if isinstance(f.get("predicate"), str) else None,
                    object=f.get("object") if isinstance(f.get("object"), str) else None,
                    tags=tags,
                )
            )

        return result

    except json.JSONDecodeError as e:
        print(f"[Cortex LLM] Failed to parse facts response: {e}")
        return None
    except Exception as e:
        print(f"[Cortex LLM] Error parsing facts: {e}")
        return None


class LLMClient(ABC):
    """Abstract base class for LLM clients."""

    @abstractmethod
    async def extract_facts(
        self, user_message: str, agent_response: str
    ) -> Optional[List[ExtractedFact]]:
        """Extract facts from a conversation exchange."""
        pass


class OpenAIClient(LLMClient):
    """OpenAI LLM Client implementation."""

    def __init__(self, config: "LLMConfig"):
        self.config = config

    async def extract_facts(
        self, user_message: str, agent_response: str
    ) -> Optional[List[ExtractedFact]]:
        """Extract facts using OpenAI API."""
        try:
            # Dynamic import to avoid requiring openai as hard dependency
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=self.config.api_key)

            model = (
                self.config.model
                or os.environ.get("CORTEX_FACT_EXTRACTION_MODEL")
                or DEFAULT_MODELS["openai"]
            )

            # Build request options - some models don't support all parameters
            # Use Any type to avoid strict OpenAI SDK typing issues
            messages: Any = [
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": _build_extraction_prompt(user_message, agent_response),
                },
            ]

            # o1 and o1-mini don't support temperature, max_tokens, or response_format
            is_o1_model = model.startswith("o1")

            if is_o1_model:
                response = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                )
            else:
                response = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=self.config.temperature or 0.1,
                    max_tokens=self.config.max_tokens or 1000,
                    response_format={"type": "json_object"},  # type: ignore[arg-type]
                )

            content = response.choices[0].message.content
            if not content:
                print("[Cortex LLM] OpenAI returned empty response")
                return None

            return _parse_facts_response(content)

        except ImportError:
            print("[Cortex LLM] OpenAI SDK not installed. Run: pip install openai")
            return None
        except Exception as e:
            print(f"[Cortex LLM] OpenAI extraction failed: {e}")
            return None


class AnthropicClient(LLMClient):
    """Anthropic LLM Client implementation."""

    def __init__(self, config: "LLMConfig"):
        self.config = config

    async def extract_facts(
        self, user_message: str, agent_response: str
    ) -> Optional[List[ExtractedFact]]:
        """Extract facts using Anthropic API."""
        try:
            # Dynamic import to avoid requiring anthropic as hard dependency
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic(api_key=self.config.api_key)

            model = (
                self.config.model
                or os.environ.get("CORTEX_FACT_EXTRACTION_MODEL")
                or DEFAULT_MODELS["anthropic"]
            )

            response = await client.messages.create(
                model=model,
                max_tokens=self.config.max_tokens or 1000,
                system=EXTRACTION_SYSTEM_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": _build_extraction_prompt(user_message, agent_response)
                        + "\n\nRespond with ONLY the JSON object, no other text.",
                    }
                ],
                temperature=self.config.temperature or 0.1,
            )

            # Extract text content from response
            text_block = next(
                (block for block in response.content if block.type == "text"), None
            )
            if not text_block:
                print("[Cortex LLM] Anthropic returned no text content")
                return None

            return _parse_facts_response(text_block.text)

        except ImportError:
            print(
                "[Cortex LLM] Anthropic SDK not installed. Run: pip install anthropic"
            )
            return None
        except Exception as e:
            print(f"[Cortex LLM] Anthropic extraction failed: {e}")
            return None


def create_llm_client(config: "LLMConfig") -> Optional[LLMClient]:
    """Create an LLM client based on the provided configuration."""
    if config.provider == "openai":
        return OpenAIClient(config)
    elif config.provider == "anthropic":
        return AnthropicClient(config)
    elif config.provider == "custom":
        # Custom provider requires extract_facts function to be provided
        if config.extract_facts:
            # Wrap the custom function in a client-like interface
            class CustomClient(LLMClient):
                def __init__(self, extract_fn: Any) -> None:
                    self.extract_fn = extract_fn

                async def extract_facts(
                    self, user_message: str, agent_response: str
                ) -> Optional[List[ExtractedFact]]:
                    result = await self.extract_fn(user_message, agent_response)
                    if result is None:
                        return None
                    # Convert dict results to ExtractedFact objects
                    return [
                        ExtractedFact(
                            fact=f.get("fact", ""),
                            fact_type=_normalize_fact_type(
                                f.get("factType", f.get("fact_type", "custom"))
                            ),
                            confidence=f.get("confidence", 0.7),
                            subject=f.get("subject"),
                            predicate=f.get("predicate"),
                            object=f.get("object"),
                            tags=f.get("tags"),
                        )
                        for f in result
                    ]

            return CustomClient(config.extract_facts)
        print("[Cortex LLM] Custom provider requires extract_facts function in config")
        return None
    else:
        print(f"[Cortex LLM] Unknown provider: {config.provider}")
        return None


async def is_llm_available(provider: Literal["openai", "anthropic"]) -> bool:
    """Check if LLM SDK is available for the given provider."""
    try:
        if provider == "openai":
            import openai  # noqa: F401

            return True
        elif provider == "anthropic":
            import anthropic  # noqa: F401

            return True
        return False
    except ImportError:
        return False


__all__ = [
    "ExtractedFact",
    "LLMClient",
    "OpenAIClient",
    "AnthropicClient",
    "create_llm_client",
    "is_llm_available",
]
