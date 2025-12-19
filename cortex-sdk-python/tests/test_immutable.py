"""
Tests for Immutable Store API (Layer 1b)

Port of: tests/immutable.test.ts

Tests validate:
- SDK API calls
- Storage operations
- Versioning behavior
- Note: Immutable storage is GLOBAL across all memory spaces
"""

import pytest
from datetime import datetime

from cortex import (
    ImmutableEntry,
    ListImmutableFilter,
    SearchImmutableInput,
    CountImmutableFilter,
    PurgeManyFilter,
    ImmutableVersionExpanded,
    ImmutableSearchResult,
    PurgeImmutableResult,
    PurgeManyImmutableResult,
    PurgeVersionsResult,
    StoreImmutableOptions,
)
from cortex.immutable import ImmutableValidationError

# ============================================================================
# store() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_store_creates_version_1(cortex_client):
    """
    Test creating version 1 for new entry.

    Port of: immutable.test.ts - line 83
    """
    import time
    unique_id = f"refund-policy-test-{int(time.time() * 1000)}"

    result = await cortex_client.immutable.store(
        ImmutableEntry(
            type="test-kb-article",
            id=unique_id,
            data={
                "title": "Refund Policy",
                "content": "Refunds available within 30 days",
            },
            metadata={
                "publishedBy": "admin",
                "tags": ["policy", "refunds"],
            },
        )
    )

    # Validate result
    assert result.type == "test-kb-article"
    assert result.id == unique_id
    assert result.version == 1
    assert result.data["title"] == "Refund Policy"
    assert len(result.previous_versions) == 0

    # Cleanup
    await cortex_client.immutable.purge("test-kb-article", unique_id)


@pytest.mark.asyncio
async def test_store_creates_version_2_on_update(cortex_client):
    """
    Test creating version 2 when updating existing entry.

    Port of: immutable.test.ts - versioning tests
    """
    import time
    unique_id = f"test-doc-{int(time.time() * 1000)}"

    # Create version 1
    v1 = await cortex_client.immutable.store(
        ImmutableEntry(
            type="test-article",
            id=unique_id,
            data={"content": "Version 1"},
        )
    )

    assert v1.version == 1

    # Update to version 2
    v2 = await cortex_client.immutable.store(
        ImmutableEntry(
            type="test-article",
            id=unique_id,
            data={"content": "Version 2"},
        )
    )

    assert v2.version == 2
    assert v2.data["content"] == "Version 2"
    # previous_versions is list of version objects with {version, data, timestamp}
    version_numbers = [v.get("version") if isinstance(v, dict) else v.version for v in v2.previous_versions]
    assert 1 in version_numbers

    # Cleanup
    await cortex_client.immutable.purge("test-article", unique_id)


# ============================================================================
# get() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_latest_version(cortex_client, ctx):
    """
    Test getting latest version of an entry.

    Port of: immutable.test.ts - get tests
    """
    # Use ctx-scoped IDs for parallel execution isolation
    test_type = ctx.immutable_type("config")
    test_id = ctx.immutable_id("app-settings")

    # Create entry
    await cortex_client.immutable.store(
        ImmutableEntry(
            type=test_type,
            id=test_id,
            data={"theme": "dark"},
        )
    )

    # Get latest version
    result = await cortex_client.immutable.get(test_type, test_id)

    assert result is not None
    assert result.type == test_type
    assert result.id == test_id
    assert result.data["theme"] == "dark"

    # Cleanup
    await cortex_client.immutable.purge(test_type, test_id)


@pytest.mark.asyncio
async def test_get_nonexistent_returns_none(cortex_client, ctx):
    """
    Test that getting non-existent entry returns None.

    Port of: immutable.test.ts - get tests
    """
    # Use ctx-scoped type for consistency, with a guaranteed non-existent ID
    test_type = ctx.immutable_type("nonexistent-test")
    result = await cortex_client.immutable.get(test_type, "does-not-exist-12345")

    assert result is None


# ============================================================================
# getVersion() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_specific_version(cortex_client, ctx):
    """
    Test retrieving specific version of an entry.

    Port of: immutable.test.ts - getVersion tests
    """
    # Use ctx-scoped IDs for parallel execution isolation
    test_type = ctx.immutable_type("config")
    test_id = ctx.immutable_id("settings-ver")

    # Create version 1
    await cortex_client.immutable.store(
        ImmutableEntry(
            type=test_type,
            id=test_id,
            data={"value": "v1"},
        )
    )

    # Create version 2
    await cortex_client.immutable.store(
        ImmutableEntry(
            type=test_type,
            id=test_id,
            data={"value": "v2"},
        )
    )

    # Get version 1
    retrieved_v1 = await cortex_client.immutable.get_version(test_type, test_id, 1)

    assert retrieved_v1 is not None
    assert retrieved_v1.version == 1
    assert retrieved_v1.data["value"] == "v1"

    # Get version 2
    retrieved_v2 = await cortex_client.immutable.get_version(test_type, test_id, 2)

    assert retrieved_v2 is not None
    assert retrieved_v2.version == 2
    assert retrieved_v2.data["value"] == "v2"

    # Cleanup
    await cortex_client.immutable.purge(test_type, test_id)


# ============================================================================
# getHistory() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_version_history(cortex_client, ctx):
    """
    Test retrieving version history.

    Port of: immutable.test.ts - getHistory tests
    """
    # Use ctx-scoped IDs for parallel execution isolation
    test_type = ctx.immutable_type("doc")
    test_id = ctx.immutable_id("history")

    # Create entry with multiple versions
    await cortex_client.immutable.store(
        ImmutableEntry(type=test_type, id=test_id, data={"content": "Version 1"})
    )

    await cortex_client.immutable.store(
        ImmutableEntry(type=test_type, id=test_id, data={"content": "Version 2"})
    )

    await cortex_client.immutable.store(
        ImmutableEntry(type=test_type, id=test_id, data={"content": "Version 3"})
    )

    # Get history
    history = await cortex_client.immutable.get_history(test_type, test_id)

    assert len(history) >= 3

    # Cleanup
    await cortex_client.immutable.purge(test_type, test_id)


# ============================================================================
# list() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_list_entries(cortex_client, ctx):
    """
    Test listing immutable entries.

    Port of: immutable.test.ts - list tests
    """
    # Use test-specific type to avoid conflicts in parallel runs
    test_type = ctx.immutable_type("list-test")

    # Create multiple entries with unique IDs
    created_ids = []
    for i in range(3):
        entry_id = ctx.immutable_id(f"list-item-{i}")
        created_ids.append(entry_id)
        await cortex_client.immutable.store(
            ImmutableEntry(
                type=test_type,
                id=entry_id,
                data={"value": i},
            )
        )

    # List entries filtered by our test type using filter object
    result = await cortex_client.immutable.list(
        ListImmutableFilter(type=test_type, limit=100)
    )

    # Should return at least 3 entries of our type
    assert len(result) >= 3

    # Cleanup
    for entry_id in created_ids:
        await cortex_client.immutable.purge(test_type, entry_id)


# ============================================================================
# count() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_count_entries(cortex_client, ctx):
    """
    Test counting immutable entries.

    Port of: immutable.test.ts - count tests
    """
    immutable_type = ctx.immutable_type("test-count")

    # Create entries
    for i in range(3):
        await cortex_client.immutable.store(
            ImmutableEntry(
                type=immutable_type,
                id=ctx.immutable_id(f"count-item-{i}"),
                data={"value": i},
            )
        )

    # Count entries
    count = await cortex_client.immutable.count()

    # Should have at least 3
    assert count >= 3


# ============================================================================
# purge() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_purge_entry(cortex_client, ctx):
    """
    Test purging an immutable entry (all versions).

    Port of: immutable.test.ts - purge tests
    """
    immutable_type = ctx.immutable_type("test-purge")
    immutable_id = ctx.immutable_id("purge-test")

    # Create entry with multiple versions
    await cortex_client.immutable.store(
        ImmutableEntry(type=immutable_type, id=immutable_id, data={"content": "Version 1"})
    )

    await cortex_client.immutable.store(
        ImmutableEntry(type=immutable_type, id=immutable_id, data={"content": "Version 2"})
    )

    # Purge entry
    await cortex_client.immutable.purge(immutable_type, immutable_id)

    # Verify purged
    retrieved = await cortex_client.immutable.get(immutable_type, immutable_id)

    assert retrieved is None


# ============================================================================
# search() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_search_immutable(cortex_client, ctx):
    """
    Test searching immutable entries.

    Port of: immutable.test.ts - search tests
    """
    immutable_type = ctx.immutable_type("test-search-article")

    # Create searchable entries
    await cortex_client.immutable.store(
        ImmutableEntry(
            type=immutable_type,
            id=ctx.immutable_id("article-python"),
            data={
                "title": "Getting Started with Python",
                "content": "Python is a great programming language",
            },
        )
    )

    await cortex_client.immutable.store(
        ImmutableEntry(
            type=immutable_type,
            id=ctx.immutable_id("article-js"),
            data={
                "title": "Advanced JavaScript",
                "content": "JavaScript async patterns",
            },
        )
    )

    # Search for "Python" using SearchImmutableInput
    results = await cortex_client.immutable.search(
        SearchImmutableInput(query="Python")
    )

    # Should find the Python article
    # Returns List[ImmutableSearchResult] with entry, score, highlights
    assert len(results) > 0
    assert all(isinstance(r, ImmutableSearchResult) for r in results)
    found_python = any(
        "Python" in str(r.entry.data)
        for r in results
    )
    assert found_python


# ============================================================================
# Client-Side Validation Tests
# ============================================================================


# store() validation tests
@pytest.mark.asyncio
async def test_store_validation_missing_type(cortex_client):
    """Should throw on missing type."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.store(
            ImmutableEntry(type=None, id="test", data={"value": 1})
        )
    assert "Type is required" in str(exc_info.value)
    assert exc_info.value.code == "MISSING_REQUIRED_FIELD"


@pytest.mark.asyncio
async def test_store_validation_empty_type(cortex_client):
    """Should throw on empty type."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.store(
            ImmutableEntry(type="", id="test", data={})
        )
    assert "Type must be a non-empty string" in str(exc_info.value)


@pytest.mark.asyncio
async def test_store_validation_type_invalid_chars(cortex_client):
    """Should throw on type with invalid characters."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.store(
            ImmutableEntry(type="type with spaces", id="test", data={})
        )
    assert "valid characters" in str(exc_info.value)


@pytest.mark.asyncio
async def test_store_validation_missing_id(cortex_client):
    """Should throw on missing id."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.store(
            ImmutableEntry(type="test", id=None, data={})
        )
    assert "ID is required" in str(exc_info.value)


@pytest.mark.asyncio
async def test_store_validation_empty_id(cortex_client):
    """Should throw on empty id."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.store(
            ImmutableEntry(type="test", id="", data={})
        )
    assert "ID must be a non-empty string" in str(exc_info.value)


@pytest.mark.asyncio
async def test_store_validation_missing_data(cortex_client):
    """Should throw on missing data."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.store(
            ImmutableEntry(type="test", id="test-id", data=None)
        )
    assert "Data is required" in str(exc_info.value)


@pytest.mark.asyncio
async def test_store_validation_invalid_data_type(cortex_client):
    """Should throw on invalid data type (list)."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.store(
            ImmutableEntry(type="test", id="test-id", data=[])
        )
    assert "Data must be a valid dict" in str(exc_info.value)


@pytest.mark.asyncio
async def test_store_validation_invalid_metadata(cortex_client):
    """Should throw on invalid metadata type."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.store(
            ImmutableEntry(type="test", id="test-id", data={}, metadata="invalid")
        )
    assert "Metadata must be a dict" in str(exc_info.value)


@pytest.mark.asyncio
async def test_store_validation_empty_user_id(cortex_client):
    """Should throw on empty user_id."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.store(
            ImmutableEntry(type="test", id="test-id", data={}, user_id="")
        )
    assert "user_id cannot be empty" in str(exc_info.value)


# get() validation tests
@pytest.mark.asyncio
async def test_get_validation_empty_type(cortex_client):
    """Should throw on empty type."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.get("", "test-id")
    assert "Type must be a non-empty string" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_validation_empty_id(cortex_client):
    """Should throw on empty id."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.get("test-type", "")
    assert "ID must be a non-empty string" in str(exc_info.value)


# getVersion() validation tests
@pytest.mark.asyncio
async def test_get_version_validation_zero(cortex_client):
    """Should throw on version 0."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.get_version("test", "id", 0)
    assert "Version must be a positive integer >= 1" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_version_validation_negative(cortex_client):
    """Should throw on negative version."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.get_version("test", "id", -1)
    assert "Version must be a positive integer >= 1" in str(exc_info.value)


# getAtTimestamp() validation tests
@pytest.mark.asyncio
async def test_get_at_timestamp_validation_negative(cortex_client):
    """Should throw on negative timestamp."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.get_at_timestamp("test", "id", -1000)
    assert "Timestamp must be a positive integer" in str(exc_info.value)


# search() validation tests
@pytest.mark.asyncio
async def test_search_validation_empty_query(cortex_client):
    """Should throw on empty query."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.search(SearchImmutableInput(query=""))
    assert "Search query is required" in str(exc_info.value)


@pytest.mark.asyncio
async def test_search_validation_invalid_type_filter(cortex_client):
    """Should throw on invalid type filter."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.search(SearchImmutableInput(query="test", type=""))
    assert "Type must be a non-empty string" in str(exc_info.value)


# list() validation tests
@pytest.mark.asyncio
async def test_list_validation_invalid_limit_zero(cortex_client):
    """Should throw on limit = 0."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.list(ListImmutableFilter(limit=0))
    assert "Limit must be a positive integer" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_validation_invalid_limit_negative(cortex_client):
    """Should throw on negative limit."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.list(ListImmutableFilter(limit=-5))
    assert "Limit must be a positive integer" in str(exc_info.value)


# count() validation tests
@pytest.mark.asyncio
async def test_count_validation_empty_type(cortex_client):
    """Should throw on empty type."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.count(CountImmutableFilter(type=""))
    assert "Type must be a non-empty string" in str(exc_info.value)


# purge() validation tests
@pytest.mark.asyncio
async def test_purge_validation_empty_type(cortex_client):
    """Should throw on empty type."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.purge("", "test-id")
    assert "Type must be a non-empty string" in str(exc_info.value)


@pytest.mark.asyncio
async def test_purge_validation_empty_id(cortex_client):
    """Should throw on empty id."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.purge("test-type", "")
    assert "ID must be a non-empty string" in str(exc_info.value)


# purgeMany() validation tests
@pytest.mark.asyncio
async def test_purge_many_validation_no_filters(cortex_client):
    """Should throw when no filters provided."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.purge_many(PurgeManyFilter())
    assert "requires at least one filter" in str(exc_info.value)


@pytest.mark.asyncio
async def test_purge_many_validation_empty_type(cortex_client):
    """Should throw on empty type in filter."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.purge_many(PurgeManyFilter(type=""))
    assert "Type must be a non-empty string" in str(exc_info.value)


# purgeVersions() validation tests
@pytest.mark.asyncio
async def test_purge_versions_validation_keep_latest_zero(cortex_client):
    """Should throw on keep_latest = 0."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.purge_versions("test", "id", keep_latest=0)
    assert "keep_latest must be a positive integer >= 1" in str(exc_info.value)


@pytest.mark.asyncio
async def test_purge_versions_validation_keep_latest_negative(cortex_client):
    """Should throw on negative keep_latest."""
    with pytest.raises(ImmutableValidationError) as exc_info:
        await cortex_client.immutable.purge_versions("test", "id", keep_latest=-5)
    assert "keep_latest must be a positive integer >= 1" in str(exc_info.value)


# Validation error properties tests
@pytest.mark.asyncio
async def test_validation_error_has_code(cortex_client):
    """Should include error code."""
    try:
        await cortex_client.immutable.store(
            ImmutableEntry(type="", id="test", data={})
        )
        assert False, "Should have thrown"
    except ImmutableValidationError as e:
        assert e.code == "INVALID_TYPE"


@pytest.mark.asyncio
async def test_validation_error_has_field(cortex_client):
    """Should include field name."""
    try:
        await cortex_client.immutable.store(
            ImmutableEntry(type="", id="test", data={})
        )
        assert False, "Should have thrown"
    except ImmutableValidationError as e:
        assert e.field == "type"


@pytest.mark.asyncio
async def test_validation_error_is_exception(cortex_client):
    """Should be instance of ImmutableValidationError."""
    try:
        await cortex_client.immutable.store(
            ImmutableEntry(type="", id="test", data={})
        )
        assert False, "Should have thrown"
    except ImmutableValidationError as e:
        assert isinstance(e, ImmutableValidationError)
        assert isinstance(e, Exception)


# ============================================================================
# New 0.21.0 Type Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_version_returns_expanded_type(cortex_client, ctx):
    """
    Test that get_version() returns ImmutableVersionExpanded with type/id info.
    """
    test_type = ctx.immutable_type("expanded-ver-test")
    test_id = ctx.immutable_id("ver-expanded")

    # Create entry
    await cortex_client.immutable.store(
        ImmutableEntry(
            type=test_type,
            id=test_id,
            data={"content": "test"},
            user_id="test-user",
        )
    )

    # Get version - should return ImmutableVersionExpanded
    version = await cortex_client.immutable.get_version(test_type, test_id, 1)

    assert version is not None
    assert isinstance(version, ImmutableVersionExpanded)
    assert version.type == test_type
    assert version.id == test_id
    assert version.version == 1
    assert version.data["content"] == "test"
    assert version.timestamp is not None
    assert version.created_at is not None

    # Cleanup
    await cortex_client.immutable.purge(test_type, test_id)


@pytest.mark.asyncio
async def test_get_history_returns_expanded_types(cortex_client, ctx):
    """
    Test that get_history() returns List[ImmutableVersionExpanded].
    """
    test_type = ctx.immutable_type("expanded-history-test")
    test_id = ctx.immutable_id("history-expanded")

    # Create multiple versions
    await cortex_client.immutable.store(
        ImmutableEntry(type=test_type, id=test_id, data={"v": 1})
    )
    await cortex_client.immutable.store(
        ImmutableEntry(type=test_type, id=test_id, data={"v": 2})
    )

    # Get history - should return List[ImmutableVersionExpanded]
    history = await cortex_client.immutable.get_history(test_type, test_id)

    assert len(history) >= 2
    for version in history:
        assert isinstance(version, ImmutableVersionExpanded)
        assert version.type == test_type
        assert version.id == test_id
        assert version.version >= 1

    # Cleanup
    await cortex_client.immutable.purge(test_type, test_id)


@pytest.mark.asyncio
async def test_get_at_timestamp_with_datetime(cortex_client, ctx):
    """
    Test that get_at_timestamp() accepts datetime objects.
    """
    test_type = ctx.immutable_type("datetime-test")
    test_id = ctx.immutable_id("timestamp-datetime")

    # Create entry
    await cortex_client.immutable.store(
        ImmutableEntry(type=test_type, id=test_id, data={"content": "original"})
    )

    # Get with datetime (now) - should find the entry
    version = await cortex_client.immutable.get_at_timestamp(
        test_type, test_id, datetime.now()
    )

    assert version is not None
    assert isinstance(version, ImmutableVersionExpanded)
    assert version.type == test_type
    assert version.id == test_id

    # Cleanup
    await cortex_client.immutable.purge(test_type, test_id)


@pytest.mark.asyncio
async def test_purge_returns_typed_result(cortex_client, ctx):
    """
    Test that purge() returns PurgeImmutableResult.
    """
    test_type = ctx.immutable_type("purge-typed-test")
    test_id = ctx.immutable_id("purge-typed")

    # Create entry with multiple versions
    await cortex_client.immutable.store(
        ImmutableEntry(type=test_type, id=test_id, data={"v": 1})
    )
    await cortex_client.immutable.store(
        ImmutableEntry(type=test_type, id=test_id, data={"v": 2})
    )

    # Purge - should return typed result
    result = await cortex_client.immutable.purge(test_type, test_id)

    assert isinstance(result, PurgeImmutableResult)
    assert result.deleted is True
    assert result.type == test_type
    assert result.id == test_id
    assert result.versions_deleted >= 2


@pytest.mark.asyncio
async def test_purge_versions_returns_typed_result(cortex_client, ctx):
    """
    Test that purge_versions() returns PurgeVersionsResult.
    """
    test_type = ctx.immutable_type("purge-ver-typed-test")
    test_id = ctx.immutable_id("purge-ver-typed")

    # Create entry with 5 versions
    for i in range(5):
        await cortex_client.immutable.store(
            ImmutableEntry(type=test_type, id=test_id, data={"v": i + 1})
        )

    # Purge versions, keeping 2 - should return typed result
    result = await cortex_client.immutable.purge_versions(test_type, test_id, keep_latest=2)

    assert isinstance(result, PurgeVersionsResult)
    assert result.versions_purged >= 0
    assert result.versions_remaining >= 2

    # Cleanup
    await cortex_client.immutable.purge(test_type, test_id)


@pytest.mark.asyncio
async def test_search_returns_typed_results(cortex_client, ctx):
    """
    Test that search() returns List[ImmutableSearchResult].
    """
    test_type = ctx.immutable_type("search-typed-test")

    # Create searchable entry
    await cortex_client.immutable.store(
        ImmutableEntry(
            type=test_type,
            id=ctx.immutable_id("search-typed-doc"),
            data={
                "title": "Unique Searchable Document ABC123",
                "content": "This is unique content for search test",
            },
        )
    )

    # Search
    results = await cortex_client.immutable.search(
        SearchImmutableInput(query="Unique Searchable Document", type=test_type)
    )

    # Results should be typed
    for result in results:
        assert isinstance(result, ImmutableSearchResult)
        assert hasattr(result, "entry")
        assert hasattr(result, "score")
        assert hasattr(result, "highlights")
        assert isinstance(result.score, (int, float))


@pytest.mark.asyncio
async def test_list_with_filter_object(cortex_client, ctx):
    """
    Test list() with ListImmutableFilter object.
    """
    test_type = ctx.immutable_type("list-filter-test")

    # Create entries
    ids = []
    for i in range(3):
        entry_id = ctx.immutable_id(f"list-filter-{i}")
        ids.append(entry_id)
        await cortex_client.immutable.store(
            ImmutableEntry(type=test_type, id=entry_id, data={"n": i})
        )

    # List with filter object
    results = await cortex_client.immutable.list(
        ListImmutableFilter(type=test_type, limit=10)
    )

    assert len(results) >= 3

    # Cleanup
    for entry_id in ids:
        await cortex_client.immutable.purge(test_type, entry_id)


@pytest.mark.asyncio
async def test_count_with_filter_object(cortex_client, ctx):
    """
    Test count() with CountImmutableFilter object.
    """
    test_type = ctx.immutable_type("count-filter-test")

    # Create entries
    ids = []
    for i in range(2):
        entry_id = ctx.immutable_id(f"count-filter-{i}")
        ids.append(entry_id)
        await cortex_client.immutable.store(
            ImmutableEntry(type=test_type, id=entry_id, data={"n": i})
        )

    # Count with filter object
    count = await cortex_client.immutable.count(
        CountImmutableFilter(type=test_type)
    )

    assert count >= 2

    # Cleanup
    for entry_id in ids:
        await cortex_client.immutable.purge(test_type, entry_id)


@pytest.mark.asyncio
async def test_purge_many_with_filter_object(cortex_client, ctx):
    """
    Test purge_many() with PurgeManyFilter object.
    """
    test_type = ctx.immutable_type("purge-many-filter-test")

    # Create entries
    for i in range(2):
        await cortex_client.immutable.store(
            ImmutableEntry(
                type=test_type,
                id=ctx.immutable_id(f"purge-many-{i}"),
                data={"n": i}
            )
        )

    # Purge many with filter object
    result = await cortex_client.immutable.purge_many(
        PurgeManyFilter(type=test_type)
    )

    assert isinstance(result, PurgeManyImmutableResult)
    assert result.deleted >= 0
    assert hasattr(result, "total_versions_deleted")
    assert hasattr(result, "entries")
