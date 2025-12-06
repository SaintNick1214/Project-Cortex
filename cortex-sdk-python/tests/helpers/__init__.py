"""
Test helper utilities for Cortex Python SDK tests.

This module provides utilities for:
- Test data cleanup
- Embedding generation
- Storage validation
- Test data generation
- Test isolation for parallel execution
"""

from .assertions import (
    assert_condition,
    count_agents,
    count_contexts,
    count_conversations,
    count_facts,
    count_immutable,
    count_memories,
    count_memory_spaces,
    count_mutable,
    count_users,
    expect_user_count,
    list_agents,
    list_contexts,
    list_conversations,
    list_facts,
    list_immutable,
    list_memories,
    list_memory_spaces,
    list_mutable,
    list_users,
    wait_for_condition,
    wait_for_count,
)
from .cleanup import BatchDeleter, ScopedCleanup, ScopedCleanupResult, TestCleanup
from .embeddings import (
    build_enriched_content,
    embeddings_available,
    extract_facts_enriched,
    generate_embedding,
    summarize_conversation,
)
from .generators import (
    create_test_conversation_input,
    create_test_fact_input,
    create_test_memory_input,
    generate_e2e_test_memory_space_id,
    generate_test_agent_id,
    generate_test_conversation_id,
    generate_test_memory_space_id,
    generate_test_user_id,
)
from .isolation import (
    TestRunContext,
    create_named_test_run_context,
    create_registered_test_run_context,
    create_test_run_context,
    extract_run_id,
    get_active_test_runs,
    same_test_run,
    unregister_test_run_context,
)
from .storage import (
    validate_conversation_storage,
    validate_fact_storage,
    validate_memory_storage,
    validate_user_storage,
)

__all__ = [
    "BatchDeleter",
    "TestCleanup",
    "ScopedCleanup",
    "ScopedCleanupResult",
    "generate_embedding",
    "embeddings_available",
    "summarize_conversation",
    "extract_facts_enriched",
    "build_enriched_content",
    "validate_conversation_storage",
    "validate_memory_storage",
    "validate_fact_storage",
    "validate_user_storage",
    "generate_test_user_id",
    "generate_test_memory_space_id",
    "generate_e2e_test_memory_space_id",
    "generate_test_conversation_id",
    "generate_test_agent_id",
    "create_test_memory_input",
    "create_test_fact_input",
    "create_test_conversation_input",
    # Isolation helpers for parallel test execution
    "TestRunContext",
    "create_test_run_context",
    "create_named_test_run_context",
    "create_registered_test_run_context",
    "unregister_test_run_context",
    "get_active_test_runs",
    "extract_run_id",
    "same_test_run",
    # Assertion helpers for filtered counts/lists
    "count_users",
    "list_users",
    "expect_user_count",
    "count_agents",
    "list_agents",
    "count_memory_spaces",
    "list_memory_spaces",
    "count_conversations",
    "list_conversations",
    "count_contexts",
    "list_contexts",
    "count_immutable",
    "list_immutable",
    "count_mutable",
    "list_mutable",
    "count_facts",
    "list_facts",
    "count_memories",
    "list_memories",
    "assert_condition",
    "wait_for_condition",
    "wait_for_count",
]

