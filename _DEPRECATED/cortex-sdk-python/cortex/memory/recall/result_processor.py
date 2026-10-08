"""
Result Processing Utilities for recall() Orchestration

These utilities handle:
- Merging results from multiple sources (vector, facts, graph-expanded)
- Deduplicating items that appear in multiple sources
- Ranking items using a multi-signal scoring algorithm
- Formatting results for LLM injection
"""

import math
import time
from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from ...types import (
        Conversation,
        FactRecord,
        MemoryEntry,
        RecallItem,
        RecallSourceBreakdown,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Ranking Configuration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RANKING_WEIGHTS = {
    "semantic": 0.35,       # Weight for vector similarity score
    "confidence": 0.20,     # Weight for fact confidence (0-100 → 0-1)
    "importance": 0.15,     # Weight for importance (0-100 → 0-1)
    "recency": 0.15,        # Weight for recency (time decay)
    "graph_connectivity": 0.15,  # Weight for graph connectivity
}

SCORE_BOOSTS = {
    "highly_connected": 1.2,    # Boost for items with many graph connections
    "user_message": 1.1,        # Boost for user messages (more likely to contain preferences)
    "highly_connected_threshold": 3,  # Threshold for highly connected (number of entities)
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Conversion Functions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def memory_to_recall_item(
    memory: "MemoryEntry",
    source: str,
    base_score: float = 0.5,
) -> "RecallItem":
    """
    Convert a memory entry to a RecallItem.

    Args:
        memory: Memory entry to convert
        source: Source of this item ('vector' or 'graph-expanded')
        base_score: Base score for this item

    Returns:
        RecallItem representing the memory
    """
    from ...types import RecallGraphContext, RecallItem

    return RecallItem(
        type="memory",
        id=memory.memory_id,
        content=memory.content,
        score=base_score,
        source=source,  # type: ignore
        memory=memory,
        fact=None,
        graph_context=RecallGraphContext(connected_entities=[]),
        conversation=None,
        source_messages=None,
    )


def fact_to_recall_item(
    fact: "FactRecord",
    source: str,
    base_score: float = 0.5,
) -> "RecallItem":
    """
    Convert a fact record to a RecallItem.

    Args:
        fact: Fact record to convert
        source: Source of this item ('facts' or 'graph-expanded')
        base_score: Base score for this item

    Returns:
        RecallItem representing the fact
    """
    from ...types import RecallGraphContext, RecallItem

    connected = []
    if fact.subject:
        connected.append(fact.subject)
    if fact.object:
        connected.append(fact.object)

    return RecallItem(
        type="fact",
        id=fact.fact_id,
        content=fact.fact,
        score=base_score,
        source=source,  # type: ignore
        memory=None,
        fact=fact,
        graph_context=RecallGraphContext(connected_entities=connected),
        conversation=None,
        source_messages=None,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Merge Results
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def merge_results(
    vector_memories: List["MemoryEntry"],
    direct_facts: List["FactRecord"],
    graph_expanded_memories: List["MemoryEntry"],
    graph_expanded_facts: List["FactRecord"],
    discovered_entities: Optional[List[str]] = None,
) -> List["RecallItem"]:
    """
    Merge results from all sources into a unified list.

    Args:
        vector_memories: Memories from vector search
        direct_facts: Facts from direct facts search
        graph_expanded_memories: Memories found via graph expansion
        graph_expanded_facts: Facts found via graph expansion
        discovered_entities: Entities discovered through graph

    Returns:
        List of RecallItems with source tracking
    """
    from ...types import RecallGraphContext

    if discovered_entities is None:
        discovered_entities = []

    items: List["RecallItem"] = []

    # Add vector memories
    for memory in vector_memories:
        item = memory_to_recall_item(memory, "vector", 0.7)
        items.append(item)

    # Add direct facts (primary source search)
    for fact in direct_facts:
        item = fact_to_recall_item(fact, "facts", 0.7)
        items.append(item)

    # Add graph-expanded memories (slightly lower base score since indirect)
    for memory in graph_expanded_memories:
        item = memory_to_recall_item(memory, "graph-expanded", 0.5)
        # Add discovered entities to graph context
        item.graph_context = RecallGraphContext(
            connected_entities=discovered_entities,
            relationship_path="graph-traversal",
        )
        items.append(item)

    # Add graph-expanded facts
    for fact in graph_expanded_facts:
        item = fact_to_recall_item(fact, "graph-expanded", 0.5)
        # Add discovered entities to graph context
        connected = []
        if fact.subject:
            connected.append(fact.subject)
        if fact.object:
            connected.append(fact.object)
        connected.extend(discovered_entities)

        item.graph_context = RecallGraphContext(
            connected_entities=connected,
            relationship_path="graph-traversal",
        )
        items.append(item)

    return items


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Deduplication
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def deduplicate_results(items: List["RecallItem"]) -> List["RecallItem"]:
    """
    Deduplicate items that appear in multiple sources.

    When the same memory or fact is found via vector search AND graph expansion,
    keep the one with the better source (primary over graph-expanded) and
    merge the graph context.

    Args:
        items: List of RecallItems to deduplicate

    Returns:
        Deduplicated list of RecallItems
    """
    from ...types import RecallGraphContext

    seen: Dict[str, "RecallItem"] = {}

    for item in items:
        existing = seen.get(item.id)

        if not existing:
            seen[item.id] = item
            continue

        # If existing is from primary source, keep it but merge graph context
        if existing.source != "graph-expanded" and item.source == "graph-expanded":
            # Merge graph context from the graph-expanded version
            existing_entities = (
                existing.graph_context.connected_entities
                if existing.graph_context
                else []
            )
            item_entities = (
                item.graph_context.connected_entities if item.graph_context else []
            )

            existing.graph_context = RecallGraphContext(
                connected_entities=list(set(existing_entities + item_entities)),
                relationship_path=(
                    existing.graph_context.relationship_path
                    if existing.graph_context
                    else item.graph_context.relationship_path
                    if item.graph_context
                    else None
                ),
            )
            # Boost score since it was found in multiple sources
            existing.score = min(1.0, existing.score * 1.1)
            continue

        # If new item is from primary source, replace
        if item.source != "graph-expanded" and existing.source == "graph-expanded":
            # Merge graph context from the existing graph-expanded version
            existing_entities = (
                existing.graph_context.connected_entities
                if existing.graph_context
                else []
            )
            item_entities = (
                item.graph_context.connected_entities if item.graph_context else []
            )

            item.graph_context = RecallGraphContext(
                connected_entities=list(set(existing_entities + item_entities)),
                relationship_path=(
                    item.graph_context.relationship_path
                    if item.graph_context
                    else existing.graph_context.relationship_path
                    if existing.graph_context
                    else None
                ),
            )
            item.score = min(1.0, item.score * 1.1)
            seen[item.id] = item
            continue

        # Both from same priority level - keep higher score
        if item.score > existing.score:
            seen[item.id] = item

    return list(seen.values())


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Ranking
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def _calculate_recency_score(timestamp: int) -> float:
    """
    Calculate time decay score (0-1).
    More recent items score higher.

    Uses exponential decay with half-life of 30 days.

    Args:
        timestamp: Unix timestamp in milliseconds

    Returns:
        Recency score between 0 and 1
    """
    now = int(time.time() * 1000)
    age_ms = now - timestamp
    half_life_ms = 30 * 24 * 60 * 60 * 1000  # 30 days

    # Exponential decay: score = 2^(-age/halfLife)
    return math.pow(2, -age_ms / half_life_ms)


def _calculate_connectivity_score(connected_entities: List[str]) -> float:
    """
    Calculate graph connectivity score (0-1).
    Items connected to more entities score higher.

    Args:
        connected_entities: List of connected entity names

    Returns:
        Connectivity score between 0 and 1
    """
    count = len(connected_entities)
    # Logarithmic scale with max at ~10 connections
    return min(1.0, math.log2(count + 1) / math.log2(11))


def rank_results(items: List["RecallItem"]) -> List["RecallItem"]:
    """
    Rank items using a multi-signal scoring algorithm.

    Score = weighted sum of:
    - Semantic similarity (from vector search)
    - Confidence (for facts)
    - Importance
    - Recency (time decay)
    - Graph connectivity

    Plus boosts for:
    - Highly connected items (>3 entities)
    - User messages (more likely to contain preferences)

    Args:
        items: List of RecallItems to rank

    Returns:
        Sorted list of RecallItems (highest score first)
    """
    for item in items:
        score = 0.0

        # Base semantic score (from source)
        semantic_score = item.score if item.score else 0.5
        score += semantic_score * RANKING_WEIGHTS["semantic"]

        # Confidence score (facts only)
        if item.type == "fact" and item.fact:
            confidence_score = item.fact.confidence / 100
            score += confidence_score * RANKING_WEIGHTS["confidence"]
        else:
            # For memories, use a default confidence of 0.8
            score += 0.8 * RANKING_WEIGHTS["confidence"]

        # Importance score
        if item.type == "memory" and item.memory:
            importance_score = item.memory.importance / 100
            score += importance_score * RANKING_WEIGHTS["importance"]
        elif item.type == "fact" and item.fact:
            # Facts don't have importance, use confidence as proxy
            score += (item.fact.confidence / 100) * RANKING_WEIGHTS["importance"]

        # Recency score
        timestamp = 0
        if item.type == "memory" and item.memory:
            timestamp = item.memory.created_at or int(time.time() * 1000)
        elif item.type == "fact" and item.fact:
            timestamp = item.fact.created_at or int(time.time() * 1000)
        else:
            timestamp = int(time.time() * 1000)

        recency_score = _calculate_recency_score(timestamp)
        score += recency_score * RANKING_WEIGHTS["recency"]

        # Graph connectivity score
        connected_entities = (
            item.graph_context.connected_entities if item.graph_context else []
        )
        connectivity_score = _calculate_connectivity_score(connected_entities)
        score += connectivity_score * RANKING_WEIGHTS["graph_connectivity"]

        # Boost for highly connected items
        if len(connected_entities) > SCORE_BOOSTS["highly_connected_threshold"]:
            score *= SCORE_BOOSTS["highly_connected"]

        # Boost for user messages
        if item.type == "memory" and item.memory:
            if item.memory.message_role == "user":
                score *= SCORE_BOOSTS["user_message"]

        # Clamp to [0, 1]
        item.score = min(1.0, max(0, score))

    # Sort by score descending
    return sorted(items, key=lambda x: x.score, reverse=True)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LLM Context Formatting
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def format_for_llm(items: List["RecallItem"]) -> str:
    """
    Generate LLM-ready context string from ranked items.

    Output format:
    ```
    ## Relevant Context

    ### Known Facts
    - User prefers dark mode (confidence: 95%)
    - User works at Acme Corp (confidence: 88%)

    ### Conversation History
    [user]: I prefer dark mode
    [agent]: I'll remember that!
    ```

    Args:
        items: Ranked list of RecallItems

    Returns:
        Formatted markdown context string
    """
    facts = [i for i in items if i.type == "fact"]
    memories = [i for i in items if i.type == "memory"]

    sections: List[str] = []

    # Facts section
    if facts:
        fact_lines = []
        for item in facts:
            confidence = item.fact.confidence if item.fact else 0
            fact_lines.append(f"- {item.content} (confidence: {confidence}%)")
        sections.append(f"### Known Facts\n{chr(10).join(fact_lines)}")

    # Memories/conversation section
    if memories:
        memory_lines = []
        for item in memories:
            role = item.memory.message_role if item.memory else "unknown"
            memory_lines.append(f"[{role}]: {item.content}")
        sections.append(f"### Conversation History\n{chr(10).join(memory_lines)}")

    if not sections:
        return ""

    return f"## Relevant Context\n\n{chr(10).join(sections)}"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Source Breakdown
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def build_source_breakdown(
    vector_memories: List["MemoryEntry"],
    direct_facts: List["FactRecord"],
    graph_expanded_memories: List["MemoryEntry"],
    graph_expanded_facts: List["FactRecord"],
    discovered_entities: List[str],
) -> "RecallSourceBreakdown":
    """
    Build source breakdown for RecallResult.

    Args:
        vector_memories: Memories from vector search
        direct_facts: Facts from direct search
        graph_expanded_memories: Memories from graph expansion
        graph_expanded_facts: Facts from graph expansion
        discovered_entities: Entities discovered through graph

    Returns:
        RecallSourceBreakdown with counts and items
    """
    from ...types import RecallSourceBreakdown

    return RecallSourceBreakdown(
        vector={
            "count": len(vector_memories),
            "items": vector_memories,
        },
        facts={
            "count": len(direct_facts),
            "items": direct_facts,
        },
        graph={
            "count": len(graph_expanded_memories) + len(graph_expanded_facts),
            "expanded_entities": discovered_entities,
        },
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Conversation Enrichment
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def enrich_with_conversations(
    items: List["RecallItem"],
    conversations_map: Dict[str, "Conversation"],
) -> List["RecallItem"]:
    """
    Enrich recall items with conversation data.

    Fetches full conversation and source messages for each memory item.

    Args:
        items: List of RecallItems to enrich
        conversations_map: Map of conversationId to Conversation

    Returns:
        Enriched list of RecallItems
    """
    enriched: List["RecallItem"] = []

    for item in items:
        if item.type != "memory" or not item.memory or not item.memory.conversation_ref:
            enriched.append(item)
            continue

        # Get conversation reference
        conv_ref = item.memory.conversation_ref
        conv_id: Optional[str] = (
            conv_ref.get("conversation_id")
            if isinstance(conv_ref, dict)
            else conv_ref.conversation_id
        )

        if not conv_id:
            enriched.append(item)
            continue

        conversation = conversations_map.get(conv_id)

        if not conversation:
            enriched.append(item)
            continue

        # Extract source messages
        message_ids: Optional[List[str]] = (
            conv_ref.get("message_ids")
            if isinstance(conv_ref, dict)
            else conv_ref.message_ids
        )

        source_messages = []
        if message_ids:
            for msg in conversation.messages:
                msg_id = msg.get("id") if isinstance(msg, dict) else msg.id
                if msg_id in message_ids:
                    source_messages.append(msg)

        # Create new item with enrichment
        item.conversation = conversation
        item.source_messages = source_messages
        enriched.append(item)

    return enriched


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Full Processing Pipeline
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def process_recall_results(
    vector_memories: List["MemoryEntry"],
    direct_facts: List["FactRecord"],
    graph_expanded_memories: List["MemoryEntry"],
    graph_expanded_facts: List["FactRecord"],
    discovered_entities: List[str],
    options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Full processing pipeline for recall results.

    1. Merge results from all sources
    2. Deduplicate
    3. Rank
    4. Optionally format for LLM

    Args:
        vector_memories: Memories from vector search
        direct_facts: Facts from direct search
        graph_expanded_memories: Memories from graph expansion
        graph_expanded_facts: Facts from graph expansion
        discovered_entities: Entities discovered through graph
        options: Processing options (limit, formatForLLM)

    Returns:
        Dict with items, sources, and optional context
    """
    if options is None:
        options = {}

    # Step 1: Merge
    merged = merge_results(
        vector_memories,
        direct_facts,
        graph_expanded_memories,
        graph_expanded_facts,
        discovered_entities,
    )

    # Step 2: Deduplicate
    deduped = deduplicate_results(merged)

    # Step 3: Rank
    ranked = rank_results(deduped)

    # Step 4: Apply limit
    limit = options.get("limit")
    limited = ranked[:limit] if limit else ranked

    # Step 5: Build source breakdown
    sources = build_source_breakdown(
        vector_memories,
        direct_facts,
        graph_expanded_memories,
        graph_expanded_facts,
        discovered_entities,
    )

    # Step 6: Format for LLM (if requested)
    format_llm = options.get("format_for_llm", True)
    context = format_for_llm(limited) if format_llm else None

    return {
        "items": limited,
        "sources": sources,
        "context": context,
    }
