#!/bin/bash
set -e

# Local Pipeline Test Script
# Simulates the GitHub Actions PR pipeline locally against local Convex
# Runs tests in parallel just like CI/CD, but much faster (local DB)

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
    export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
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

echo ""

# Force run all tests if requested
if [ "$1" == "--all" ]; then
    echo -e "${CYAN}   --all flag detected, running ALL tests${NC}"
    CHANGED_TYPESCRIPT=true
    CHANGED_PYTHON=true
    CHANGED_CONVEX=true
    echo ""
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STAGE 2: Deploy & Purge (runs once before all tests)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STAGE 2: Deploy & Purge Database (setup-and-purge)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$CHANGED_TYPESCRIPT" == "true" ] || [ "$CHANGED_PYTHON" == "true" ] || [ "$CHANGED_CONVEX" == "true" ]; then
    echo -e "${CYAN}🚀 Deploying Convex backend...${NC}"
    npx convex dev --once --run 'scripts/cleanup-test-data.ts' > /dev/null 2>&1 &
    DEPLOY_PID=$!
    
    # Wait for deploy with spinner
    SPIN='-\|/'
    i=0
    while kill -0 $DEPLOY_PID 2>/dev/null; do
        i=$(( (i+1) %4 ))
        printf "\r   ${SPIN:$i:1} Deploying..."
        sleep 0.1
    done
    wait $DEPLOY_PID
    DEPLOY_EXIT=$?
    
    if [ $DEPLOY_EXIT -eq 0 ]; then
        echo -e "\r   ${GREEN}✓${NC} Convex deployed successfully"
    else
        echo -e "\r   ${RED}✗${NC} Convex deploy failed"
        exit 1
    fi
    
    echo ""
    echo -e "${CYAN}🧹 Purging test database...${NC}"
    npx tsx scripts/cleanup-test-data.ts $LOCAL_CONVEX_URL
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

# Track PIDs and job names
declare -A PIDS
declare -A JOB_NAMES

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
    PIDS["ts"]=$!
    JOB_NAMES["ts"]="TypeScript SDK"
    echo "   Started (PID: ${PIDS["ts"]})"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Python SDK Tests (5 versions in parallel - simulates matrix)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ "$CHANGED_PYTHON" == "true" ]; then
    echo -e "${CYAN}🐍 Python SDK Tests (current version only - simulates 1 of 5 matrix jobs)${NC}"
    (
        cd cortex-sdk-python
        CONVEX_URL=$LOCAL_CONVEX_URL CONVEX_TEST_MODE=local pytest tests/ -v > "$LOGS_DIR/python-tests.log" 2>&1
        echo $? > "$LOGS_DIR/python-tests.exit"
    ) &
    PIDS["python"]=$!
    JOB_NAMES["python"]="Python SDK"
    echo "   Started (PID: ${PIDS["python"]})"
    echo -e "   ${YELLOW}Note: Only running current Python version locally${NC}"
    echo -e "   ${YELLOW}      CI will run all 5 versions (3.10, 3.11, 3.12, 3.13, 3.14)${NC}"
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
    PIDS["quality"]=$!
    JOB_NAMES["quality"]="Code Quality"
    echo "   Started (PID: ${PIDS["quality"]})"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Wait for all jobs and collect results
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ ${#PIDS[@]} -eq 0 ]; then
    echo -e "${YELLOW}⊘ No tests to run (no changes detected)${NC}"
    echo ""
    echo "   Run with --all flag to force all tests:"
    echo "   ./scripts/test-pipeline-local.sh --all"
    echo ""
    exit 0
fi

echo -e "${CYAN}⏳ Waiting for ${#PIDS[@]} parallel job(s) to complete...${NC}"
echo ""

# Wait for each job and track status
declare -A RESULTS
ALL_PASSED=true

for job in "${!PIDS[@]}"; do
    PID=${PIDS[$job]}
    NAME=${JOB_NAMES[$job]}
    
    # Show spinner while waiting
    echo -ne "   ${CYAN}◌${NC} $NAME (PID: $PID)... "
    
    wait $PID
    
    # Read exit code from file
    if [ -f "$LOGS_DIR/$job-tests.exit" ]; then
        EXIT_CODE=$(cat "$LOGS_DIR/$job-tests.exit")
    elif [ -f "$LOGS_DIR/$job.exit" ]; then
        EXIT_CODE=$(cat "$LOGS_DIR/$job.exit")
    else
        EXIT_CODE=0
    fi
    
    RESULTS[$job]=$EXIT_CODE
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "\r   ${GREEN}✓${NC} $NAME"
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
for job in "${!RESULTS[@]}"; do
    EXIT_CODE=${RESULTS[$job]}
    NAME=${JOB_NAMES[$job]}
    
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
    
    for job in "${!RESULTS[@]}"; do
        if [ ${RESULTS[$job]} -ne 0 ]; then
            NAME=${JOB_NAMES[$job]}
            echo -e "${YELLOW}▼ $NAME Logs:${NC}"
            echo ""
            
            if [ -f "$LOGS_DIR/$job-tests.log" ]; then
                tail -50 "$LOGS_DIR/$job-tests.log"
            elif [ -f "$LOGS_DIR/$job.log" ]; then
                tail -50 "$LOGS_DIR/$job.log"
            fi
            
            echo ""
            echo -e "${YELLOW}   Full log: $LOGS_DIR/$job-tests.log${NC}"
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
