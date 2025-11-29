"""
Fact Extraction Example

Demonstrates fact extraction from conversations for structured knowledge.
"""

import asyncio
import os
import re

from cortex import (
    Cortex,
    CortexConfig,
    RememberParams,
)


async def extract_facts(user_message: str, agent_response: str):
    """
    Simple fact extraction function.

    In production, you would use an LLM here.
    """
    facts = []

    # Extract name
    name_match = re.search(r"my name is (\w+)", user_message, re.IGNORECASE)
    if name_match:
        facts.append(
            {
                "fact": f"User's name is {name_match.group(1)}",
                "factType": "identity",
                "subject": "user",
                "predicate": "has_name",
                "object": name_match.group(1),
                "confidence": 95,
                "tags": ["name", "identity"],
            }
        )

    # Extract preferences
    prefer_match = re.search(r"prefer (\w+\s*\w*)", user_message, re.IGNORECASE)
    if prefer_match:
        facts.append(
            {
                "fact": f"User prefers {prefer_match.group(1)}",
                "factType": "preference",
                "subject": "user",
                "predicate": "prefers",
                "object": prefer_match.group(1),
                "confidence": 85,
                "tags": ["preference"],
            }
        )

    # Extract location
    location_match = re.search(r"I(?:'m| am) (?:from|in) (\w+)", user_message, re.IGNORECASE)
    if location_match:
        facts.append(
            {
                "fact": f"User is from {location_match.group(1)}",
                "factType": "identity",
                "subject": "user",
                "predicate": "located_in",
                "object": location_match.group(1),
                "confidence": 90,
                "tags": ["location", "identity"],
            }
        )

    return facts if facts else None


async def main():
    """Run fact extraction example."""

    # Initialize Cortex
    cortex = Cortex(
        CortexConfig(convex_url=os.getenv("CONVEX_URL", "http://localhost:3210"))
    )

    print("🧠 Fact Extraction Example")
    print("=" * 50)

    # Conversation with fact extraction
    memory_space_id = "fact-extraction-agent"
    user_id = "user-bob"
    conversation_id = "conv-bob-facts"

    # Messages that contain extractable facts
    exchanges = [
        ("My name is Bob", "Nice to meet you, Bob!"),
        ("I prefer email notifications", "I'll remember you prefer email!"),
        ("I'm from San Francisco", "Got it, you're from San Francisco!"),
    ]

    for user_msg, bot_response in exchanges:
        print(f"\n👤 User: {user_msg}")
        print(f"🤖 Bot: {bot_response}")

        # Remember with fact extraction
        result = await cortex.memory.remember(
            RememberParams(
                memory_space_id=memory_space_id,
                conversation_id=conversation_id,
                user_message=user_msg,
                agent_response=bot_response,
                user_id=user_id,
                user_name="Bob",
                extract_facts=extract_facts,  # Enable fact extraction
            )
        )

        if result.facts:
            print(f"   🎯 Extracted {len(result.facts)} facts:")
            for fact in result.facts:
                print(f"      - {fact.fact} ({fact.confidence}% confidence)")

    # Query extracted facts
    print("\n" + "=" * 50)
    print("📋 All Facts About User:")

    all_facts = await cortex.facts.list(
        memory_space_id, subject=user_id, limit=100
    )

    for fact in all_facts:
        print(f"   - {fact.fact}")
        print(f"     Type: {fact.fact_type}, Confidence: {fact.confidence}%")

    # Query by fact type
    print("\n📍 User Preferences:")
    preferences = await cortex.facts.list(
        memory_space_id, fact_type="preference", subject=user_id
    )

    for pref in preferences:
        print(f"   - {pref.fact}")

    # Clean up
    await cortex.close()
    print("\n✅ Example complete!")


if __name__ == "__main__":
    asyncio.run(main())

