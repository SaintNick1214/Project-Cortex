"""
Recall Orchestration Utilities

Sub-modules for the recall() orchestration API:
- graph_enhancement: Graph traversal and entity expansion
- result_processor: Merge, dedupe, rank, and format results
"""

from .graph_enhancement import (
    GraphExpansionConfig,
    GraphExpansionResult,
    expand_via_graph,
    extract_entities_from_results,
    fetch_related_facts,
    fetch_related_memories,
    perform_graph_expansion,
)
from .result_processor import (
    RANKING_WEIGHTS,
    SCORE_BOOSTS,
    build_source_breakdown,
    deduplicate_results,
    enrich_with_conversations,
    fact_to_recall_item,
    format_for_llm,
    memory_to_recall_item,
    merge_results,
    process_recall_results,
    rank_results,
)

__all__ = [
    # Graph enhancement
    "GraphExpansionConfig",
    "GraphExpansionResult",
    "extract_entities_from_results",
    "expand_via_graph",
    "fetch_related_memories",
    "fetch_related_facts",
    "perform_graph_expansion",
    # Result processing
    "RANKING_WEIGHTS",
    "SCORE_BOOSTS",
    "memory_to_recall_item",
    "fact_to_recall_item",
    "merge_results",
    "deduplicate_results",
    "rank_results",
    "format_for_llm",
    "build_source_breakdown",
    "enrich_with_conversations",
    "process_recall_results",
]
