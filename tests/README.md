# Cortex SDK - E2E Tests

## Overview

This directory contains comprehensive end-to-end tests for the Cortex SDK. Each test validates:

1. **SDK API** - TypeScript interface works correctly
2. **Convex Backend** - Mutations and queries execute properly
3. **Storage Validation** - Data is stored correctly in Convex

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Watch mode (for development)
npm run test:watch

# Coverage report
npm run test:coverage
```

## Test Structure

Each API layer has its own test file:

- `conversations.test.ts` - Layer 1a (ACID conversations)
- `immutable.test.ts` - Layer 1b (Immutable store) - TODO
- `mutable.test.ts` - Layer 1c (Mutable store) - TODO
- `memories.test.ts` - Layer 2 (Vector memory) - TODO
- `memory-api.test.ts` - Layer 3 (Memory convenience API) - TODO

## Prerequisites

- Convex must be running locally: `npm run dev`
- Tests use `CONVEX_URL` environment variable (defaults to `http://127.0.0.1:3210`)

## Test Patterns

### Storage Validation

Every test validates both SDK response AND Convex storage:

```typescript
// Create via SDK
const result = await cortex.conversations.create({ ... });

// Validate SDK response
expect(result.conversationId).toBeDefined();

// Validate Convex storage
const stored = await client.query(api.conversations.get, {
  conversationId: result.conversationId,
});
expect(stored).toMatchObject({ ... });
```

### ACID Properties

Tests verify:

- **Atomicity** - All operations complete or fail together
- **Consistency** - Data constraints are maintained
- **Isolation** - Operations don't interfere
- **Durability** - Data persists correctly

## Coverage Goals

- **80%** minimum coverage for all metrics
- **100%** coverage for critical paths (GDPR, cascade operations)

## Current Status

✅ Layer 1a (Conversations) - Complete with 13 test cases
⏳ Layer 1b (Immutable) - Pending
⏳ Layer 1c (Mutable) - Pending
⏳ Layer 2 (Memories) - Pending
⏳ Layer 3 (Memory API) - Pending
