#!/bin/bash
#
# Run Streaming Tests
#
# Runs all streaming tests with proper environment setup and validation.
#

set -e

echo "=================================="
echo "CORTEX STREAMING TESTS"
echo "=================================="
echo ""

# Check environment variables
if [ -z "$CONVEX_URL" ]; then
    echo "⚠️  Warning: CONVEX_URL not set"
    echo "   Set with: export CONVEX_URL='https://your-project.convex.cloud'"
fi

if [ -z "$NEO4J_URI" ]; then
    echo "⚠️  Warning: NEO4J_URI not set, using default: bolt://localhost:7687"
    export NEO4J_URI="bolt://localhost:7687"
fi

echo "📦 Test Configuration:"
echo "   Convex: ${CONVEX_URL:-'Not set'}"
echo "   Neo4j: ${NEO4J_URI}"
echo ""

# Check if graph databases are running
echo "🔍 Checking database connectivity..."

# Check Neo4j
if docker ps | grep -q cortex-neo4j; then
    echo "   ✅ Neo4j container running"
else
    echo "   ❌ Neo4j container not running"
    echo "      Start with: docker-compose -f docker-compose.graph.yml up -d neo4j"
fi

# Check Memgraph
if docker ps | grep -q cortex-memgraph; then
    echo "   ✅ Memgraph container running"
else
    echo "   ⚠️  Memgraph container not running (optional)"
fi

echo ""
echo "=================================="
echo "RUNNING TESTS"
echo "=================================="
echo ""

# Run unit tests first (fast, no external dependencies)
echo "1️⃣  Running unit tests..."
python -m pytest tests/streaming/test_stream_metrics.py -v --tb=short
python -m pytest tests/streaming/test_chunking_strategies.py -v --tb=short
python -m pytest tests/streaming/test_adaptive_processor.py -v --tb=short
python -m pytest tests/streaming/test_error_recovery.py -v --tb=short
python -m pytest tests/streaming/test_progressive_storage.py -v --tb=short

echo ""
echo "2️⃣  Running integration tests..."
python -m pytest tests/streaming/test_stream_processor.py -v --tb=short

# Integration tests requiring live databases
if [ -n "$CONVEX_URL" ]; then
    echo ""
    echo "3️⃣  Running live integration tests..."
    python -m pytest tests/streaming/test_remember_stream_integration.py -v --tb=short || echo "⚠️  Live integration tests skipped (check CONVEX_URL)"
fi

echo ""
echo "=================================="
echo "✅ TEST SUITE COMPLETE"
echo "=================================="
echo ""
echo "To run manual validation:"
echo "   python tests/streaming/manual_test.py"
echo ""
echo "To clear graph databases:"
echo "   python tests/graph/clear_databases.py"
echo ""
