# Remaining Test Ports - Complete List

## Status: IN PROGRESS

**Completed**: 288/500 tests (57%)
**Remaining**: ~212 tests

## Files Requiring Expansion

### 1. test_conversations.py (15 → 69, +54 tests)

**Missing scenarios from conversations.test.ts:**

- Custom conversationId acceptance
- Duplicate conversationId error handling
- Invalid participant combinations
- Null checks for non-existent
- Multiple message appends (immutability)
- Custom messageId
- Storage validation
- Index usage validation
- Message pagination (limit/offset)
- Message ordering (asc/desc)
- Offset beyond messages edge case
- Search with highlights
- Search relevance scores
- Search empty results
- Export JSON/CSV formats
- Export with/without metadata
- Export filtering by IDs/type/date
- Message propagation tests
- Deletion propagation
- 100+ message handling
- Empty message content
- Very long message content
- Special characters in IDs
- Concurrent message additions
- GetMessagesByIds
- GetMessagesByIds filtering

### 2. test_immutable.py (13 → 54, +41 tests)

**Missing from immutable.test.ts:**

- Version conflict resolution
- Concurrent version creation
- Version retention limits
- Complex search queries
- Type-specific filtering
- UserId combinations
- Export with versioning
- Timestamp-based queries
- Previous version navigation
- Version diff scenarios
- Metadata inheritance
- Purge with history
- GetAtTimestamp edge cases
- List pagination
- Search combinations
- Update scenarios
- Archive/restore
- Bulk operations

### 3. test_facts.py (14 → 63, +49 tests)

**Missing from facts.test.ts:**

- Subject-predicate-object queries
- Confidence threshold filtering
- Graph triple validation
- Complex source references
- Tag-based searches
- Confidence updates
- Fact relationship queries
- Cross-layer extraction
- Export scenarios
- Bulk operations
- Merge/deduplication
- Version chain integrity
- Superseding logic
- QueryByPredicate
- QueryByObject
- Search combinations
- Update edge cases
- Delete cascades

### 4. test_memory.py (18 → 41, +23 tests)

**Missing from memory.test.ts:**

- Complex remember scenarios
- Fact extraction callbacks (more variations)
- Auto-summarization
- Importance calculation edge cases
- Tag propagation variations
- Conversation auto-creation
- Enriched memory retrieval
- Search with embedding fallback
- Memory versioning
- Forget with restoration
- Bulk remember operations
- Memory merge scenarios
- Auto-embed variations
- Extract content edge cases

### 5. test_vector.py (24 → 43, +19 tests)

**Missing from vector.test.ts:**

- Embedding generation edge cases
- Vector search ranking
- Similar memory deduplication
- Update with version tracking
- Archive and restoration
- Export with embeddings
- Bulk operations
- Content type variations
- Source tracking validation
- Access count tracking
- Last accessed updates
- GetAtTimestamp
- DeleteMany variations

### 6. test_integration.py (6 → 20, +14 tests)

**Missing integration scenarios:**

- Multi-layer data flow
- Transaction-like operations
- Rollback scenarios
- Complex cascade operations
- Cross-API workflows
- Performance benchmarks
- Consistency checks

## Implementation Plan

All expansions will:

- Follow TypeScript test structure exactly
- Include all assertions
- Handle dict/object access patterns
- Use proper fixtures
- Include cleanup

## Estimated Lines of Code

- Conversations expansion: ~2,700 lines
- Immutable expansion: ~2,050 lines
- Facts expansion: ~2,450 lines
- Memory expansion: ~1,150 lines
- Vector expansion: ~950 lines
- Integration expansion: ~700 lines

**Total**: ~10,000 lines of test code to add
