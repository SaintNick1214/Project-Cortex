#!/bin/bash
set -e

# Local Pipeline Test Script
# Compatible with macOS bash 3.2+
# Simulates the GitHub Actions PR pipeline locally against local Convex

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                 LOCAL PIPELINE SIMULATOR                       ║"
echo "║          Tests run in parallel against local Convex            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Load .env.local if it exists
if [ -f ".env.local" ]; then
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        if [[ $key =~ ^[A-Z_]+ ]]; then
            # Remove inline comments from value
            value=$(echo "$value" | sed 's/#.*$//' | xargs)
            export "$key=$value"
        fi
    done < .env.local
fi

# Check for local Convex
if [ -z "$LOCAL_CONVEX_URL" ]; then
    echo -e "${RED}✗ LOCAL_CONVEX_URL not set${NC}"
    echo "  Please set LOCAL_CONVEX_URL in .env.local"
    exit 1
fi

echo -e "${CYAN}🔍 Configuration:${NC}"
echo "   Convex URL: $LOCAL_CONVEX_URL"
echo "   Working Dir: $(pwd)"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STAGE 1: Detect Changes (simulates dorny/paths-filter)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STAGE 1: Detect File Changes (simulating paths-filter)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Detect changes against main branch (or all if no main)
if git rev-parse main >/dev/null 2>&1; then
    BASE="main"
else
    BASE="HEAD~1"
fi

echo "   Comparing against: $BASE"
echo ""

# Check each package for changes
CHANGED_TYPESCRIPT=false
CHANGED_PYTHON=false
CHANGED_CONVEX=false
CHANGED_VERCEL_AI=false
CHANGED_CLI=false

if git diff --name-only $BASE | grep -qE '^(src/|tests/|package\.json|tsconfig\.json|jest\.config\.js)'; then
    CHANGED_TYPESCRIPT=true
    echo -e "   ${GREEN}✓${NC} TypeScript SDK changed"
else
    echo -e "   ${YELLOW}⊘${NC} TypeScript SDK unchanged"
fi

if git diff --name-only $BASE | grep -qE '^cortex-sdk-python/'; then
    CHANGED_PYTHON=true
    echo -e "   ${GREEN}✓${NC} Python SDK changed"
else
    echo -e "   ${YELLOW}⊘${NC} Python SDK unchanged"
fi

if git diff --name-only $BASE | grep -qE '^convex-dev/'; then
    CHANGED_CONVEX=true
    echo -e "   ${GREEN}✓${NC} Convex backend changed"
else
    echo -e "   ${YELLOW}⊘${NC} Convex backend unchanged"
fi

if git diff --name-only $BASE | grep -qE '^packages/vercel-ai-provider/'; then
    CHANGED_VERCEL_AI=true
    echo -e "   ${GREEN}✓${NC} Vercel AI Provider changed"
else
    echo -e "   ${YELLOW}⊘${NC} Vercel AI Provider unchanged"
fi

if git diff --name-only $BASE | grep -qE '^packages/cortex-cli/'; then
    CHANGED_CLI=true
    echo -e "   ${GREEN}✓${NC} Cortex CLI changed"
else
    echo -e "   ${YELLOW}⊘${NC} Cortex CLI unchanged"
fi

echo ""

# Force run all tests if requested
if [ "$1" == "--all" ]; then
    echo -e "${CYAN}   --all flag detected, running ALL tests${NC}"
    CHANGED_TYPESCRIPT=true
    CHANGED_PYTHON=true
    CHANGED_CONVEX=true
    CHANGED_VERCEL_AI=true
    CHANGED_CLI=true
    echo ""
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STAGE 2: Deploy & Purge (runs once before all tests)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STAGE 2: Deploy & Purge Database (setup-and-purge)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$CHANGED_TYPESCRIPT" == "true" ] || [ "$CHANGED_PYTHON" == "true" ] || [ "$CHANGED_CONVEX" == "true" ] || [ "$CHANGED_CLI" == "true" ]; then
    echo -e "${CYAN}🧹 Purging test database...${NC}"
    npx tsx scripts/cleanup-test-data.ts $LOCAL_CONVEX_URL 2>&1 | grep -E "✅|TOTAL|Deleted" || true
    echo ""
else
    echo -e "${YELLOW}⊘ No changes detected - skipping deploy & purge${NC}"
    echo ""
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STAGE 3: Run Tests in Parallel
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STAGE 3: Run Tests in Parallel${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Create temp directory for logs
LOGS_DIR=$(mktemp -d)
echo -e "${CYAN}   Test logs: $LOGS_DIR${NC}"
echo ""

# Track PIDs and job names using indexed arrays (bash 3.2 compatible)
PIDS=()
JOB_NAMES=()
JOB_IDS=()
JOB_COUNT=0

# Start time
START_TIME=$(date +%s)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TypeScript SDK Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ "$CHANGED_TYPESCRIPT" == "true" ] || [ "$CHANGED_CONVEX" == "true" ]; then
    echo -e "${CYAN}📦 TypeScript SDK Tests${NC}"
    (
        CONVEX_TEST_MODE=local npm test > "$LOGS_DIR/ts-tests.log" 2>&1
        echo $? > "$LOGS_DIR/ts-tests.exit"
    ) &
    PIDS+=($!)
    JOB_NAMES+=("TypeScript SDK")
    JOB_IDS+=("ts-tests")
    echo "   Started (PID: $!)"
    JOB_COUNT=$((JOB_COUNT + 1))
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Python SDK Tests (current version only locally)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ "$CHANGED_PYTHON" == "true" ]; then
    echo -e "${CYAN}🐍 Python SDK Tests (current version only)${NC}"
    (
        cd cortex-sdk-python
        CONVEX_URL=$LOCAL_CONVEX_URL CONVEX_TEST_MODE=local pytest tests/ -v > "$LOGS_DIR/python-tests.log" 2>&1
        echo $? > "$LOGS_DIR/python-tests.exit"
    ) &
    PIDS+=($!)
    JOB_NAMES+=("Python SDK")
    JOB_IDS+=("python-tests")
    echo "   Started (PID: $!)"
    echo -e "   ${YELLOW}Note: CI runs 5 Python versions (3.10-3.14)${NC}"
    JOB_COUNT=$((JOB_COUNT + 1))
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Vercel AI Provider Tests (unit tests - no DB required)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ "$CHANGED_VERCEL_AI" == "true" ] || [ "$CHANGED_TYPESCRIPT" == "true" ]; then
    echo -e "${CYAN}⚡ Vercel AI Provider Tests${NC}"
    (
        {
            # Build main SDK first (provider depends on it)
            npm run build 2>&1
            
            # Install and test Vercel AI Provider
            cd packages/vercel-ai-provider
            npm install 2>&1
            npm test 2>&1
            npm run lint 2>&1
            npm run build 2>&1
        } > "$LOGS_DIR/vercel-ai-tests.log" 2>&1
        echo $? > "$LOGS_DIR/vercel-ai-tests.exit"
    ) &
    PIDS+=($!)
    JOB_NAMES+=("Vercel AI Provider")
    JOB_IDS+=("vercel-ai-tests")
    echo "   Started (PID: $!)"
    echo -e "   ${YELLOW}Note: Unit tests only (no DB)${NC}"
    JOB_COUNT=$((JOB_COUNT + 1))
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Cortex CLI Tests (unit + integration - integration hits DB!)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ "$CHANGED_CLI" == "true" ] || [ "$CHANGED_TYPESCRIPT" == "true" ]; then
    echo -e "${CYAN}🔧 Cortex CLI Tests${NC}"
    (
        {
            # Build main SDK first (CLI depends on it)
            npm run build 2>&1
            
            # Install and test CLI
            cd packages/cortex-cli
            npm install 2>&1
            
            # Run unit tests (pure unit tests)
            echo "=== Running CLI unit tests ==="
            npm run test:unit 2>&1
            
            # Run integration tests (these hit the database - potential conflicts!)
            echo "=== Running CLI integration tests ==="
            CONVEX_URL=$LOCAL_CONVEX_URL npm run test:integration 2>&1
            
            npm run lint 2>&1
            npm run build 2>&1
        } > "$LOGS_DIR/cli-tests.log" 2>&1
        echo $? > "$LOGS_DIR/cli-tests.exit"
    ) &
    PIDS+=($!)
    JOB_NAMES+=("Cortex CLI")
    JOB_IDS+=("cli-tests")
    echo "   Started (PID: $!)"
    echo -e "   ${YELLOW}⚠ Integration tests hit DB${NC}"
    JOB_COUNT=$((JOB_COUNT + 1))
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Code Quality (can run in parallel with tests)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ "$CHANGED_TYPESCRIPT" == "true" ] || [ "$CHANGED_PYTHON" == "true" ]; then
    echo -e "${CYAN}🔍 Code Quality (Lint & Type Check)${NC}"
    (
        {
            if [ "$CHANGED_TYPESCRIPT" == "true" ]; then
                echo "Running ESLint..."
                npm run lint 2>&1
                echo "Running TypeScript type check..."
                npx tsc --noEmit 2>&1
            fi
            
            if [ "$CHANGED_PYTHON" == "true" ]; then
                echo "Running mypy..."
                cd cortex-sdk-python
                mypy cortex --ignore-missing-imports 2>&1
                echo "Running ruff..."
                ruff check cortex/ 2>&1
            fi
        } > "$LOGS_DIR/code-quality.log" 2>&1
        echo $? > "$LOGS_DIR/code-quality.exit"
    ) &
    PIDS+=($!)
    JOB_NAMES+=("Code Quality")
    JOB_IDS+=("code-quality")
    echo "   Started (PID: $!)"
    JOB_COUNT=$((JOB_COUNT + 1))
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Wait for all jobs and collect results
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ $JOB_COUNT -eq 0 ]; then
    echo -e "${YELLOW}⊘ No tests to run (no changes detected)${NC}"
    echo ""
    echo "   Run with --all flag to force all tests:"
    echo "   ./scripts/test-pipeline-local.sh --all"
    echo ""
    exit 0
fi

echo -e "${CYAN}⏳ Waiting for $JOB_COUNT parallel job(s) to complete...${NC}"
echo ""

# Wait for each job and track status
RESULTS=()
ALL_PASSED=true

for i in $(seq 0 $((JOB_COUNT - 1))); do
    PID=${PIDS[$i]}
    NAME=${JOB_NAMES[$i]}
    JOB_ID=${JOB_IDS[$i]}
    
    # Show which job we're waiting for
    echo -ne "   ${CYAN}◌${NC} $NAME (PID: $PID)... "
    
    # Wait for this specific PID
    wait $PID 2>/dev/null || true
    
    # Read exit code from file
    EXIT_CODE=1
    if [ -f "$LOGS_DIR/$JOB_ID.exit" ]; then
        EXIT_CODE=$(cat "$LOGS_DIR/$JOB_ID.exit")
    fi
    
    RESULTS+=($EXIT_CODE)
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "\r   ${GREEN}✓${NC} $NAME                    "
    else
        echo -e "\r   ${RED}✗${NC} $NAME (exit code: $EXIT_CODE)"
        ALL_PASSED=false
    fi
done

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}RESULTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Show detailed results for each job
for i in $(seq 0 $((JOB_COUNT - 1))); do
    EXIT_CODE=${RESULTS[$i]}
    NAME=${JOB_NAMES[$i]}
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "   ${GREEN}✓${NC} $NAME: PASSED"
    else
        echo -e "   ${RED}✗${NC} $NAME: FAILED (see logs below)"
    fi
done

echo ""
echo "   Total duration: ${DURATION}s"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Show logs for failed jobs
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ "$ALL_PASSED" != "true" ]; then
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}FAILURE LOGS${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    for i in $(seq 0 $((JOB_COUNT - 1))); do
        if [ ${RESULTS[$i]} -ne 0 ]; then
            NAME=${JOB_NAMES[$i]}
            JOB_ID=${JOB_IDS[$i]}
            echo -e "${YELLOW}▼ $NAME Logs:${NC}"
            echo ""
            
            if [ -f "$LOGS_DIR/$JOB_ID.log" ]; then
                tail -50 "$LOGS_DIR/$JOB_ID.log"
            fi
            
            echo ""
            echo -e "${YELLOW}   Full log: $LOGS_DIR/$JOB_ID.log${NC}"
            echo ""
        fi
    done
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Final Summary
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$ALL_PASSED" == "true" ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
    echo ""
    echo "   All test jobs completed successfully in ${DURATION}s"
    echo "   Logs available at: $LOGS_DIR"
    echo ""
    exit 0
else
    echo -e "${RED}❌ SOME CHECKS FAILED${NC}"
    echo ""
    echo "   Check logs above or in: $LOGS_DIR"
    echo ""
    exit 1
fi
