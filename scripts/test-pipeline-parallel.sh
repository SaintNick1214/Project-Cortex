#!/bin/bash
set -e

# Advanced Local Pipeline Test Script
# Runs MULTIPLE Python test processes in parallel to truly simulate CI matrix

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          ADVANCED LOCAL PIPELINE SIMULATOR                     ║"
echo "║   Runs 5 parallel Python test suites + TypeScript tests       ║"
echo "║             (Simulates full CI matrix locally)                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check for local Convex
if [ -z "$LOCAL_CONVEX_URL" ]; then
    echo -e "${RED}✗ LOCAL_CONVEX_URL not set${NC}"
    echo "  Please set LOCAL_CONVEX_URL in .env.local"
    exit 1
fi

# Check number of parallel runs (default 5 to match CI)
PARALLEL_RUNS=${1:-5}

echo -e "${CYAN}🔍 Configuration:${NC}"
echo "   Convex URL: $LOCAL_CONVEX_URL"
echo "   Parallel Python runs: $PARALLEL_RUNS"
echo "   Working Dir: $(pwd)"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STAGE 1: Purge Database
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STAGE 1: Purge Test Database${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}🧹 Purging test database...${NC}"
npx tsx scripts/cleanup-test-data.ts $LOCAL_CONVEX_URL
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STAGE 2: Run Tests in Parallel
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STAGE 2: Launch ${PARALLEL_RUNS} Parallel Test Processes${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Create temp directory for logs
LOGS_DIR=$(mktemp -d)
echo -e "${CYAN}   Test logs: $LOGS_DIR${NC}"
echo ""

# Track PIDs
declare -A PIDS
declare -A JOB_NAMES
START_TIME=$(date +%s)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Launch TypeScript Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${MAGENTA}📦 TypeScript SDK${NC}"
(
    CONVEX_TEST_MODE=local npm test > "$LOGS_DIR/ts.log" 2>&1
    echo $? > "$LOGS_DIR/ts.exit"
) &
PIDS["ts"]=$!
JOB_NAMES["ts"]="TypeScript SDK"
echo "   Started (PID: ${PIDS["ts"]})"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Launch N Parallel Python Test Runs
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${MAGENTA}🐍 Python SDK (${PARALLEL_RUNS} parallel runs)${NC}"

for i in $(seq 1 $PARALLEL_RUNS); do
    (
        cd cortex-sdk-python
        CONVEX_URL=$LOCAL_CONVEX_URL \
        CONVEX_TEST_MODE=local \
        pytest tests/ -q > "$LOGS_DIR/python-$i.log" 2>&1
        echo $? > "$LOGS_DIR/python-$i.exit"
    ) &
    PIDS["python-$i"]=$!
    JOB_NAMES["python-$i"]="Python Run $i"
    echo "   Run $i started (PID: ${PIDS["python-$i"]})"
done

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Real-time Progress Updates
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${CYAN}⏳ Monitoring $((PARALLEL_RUNS + 1)) parallel jobs...${NC}"
echo ""

# Show live progress
COMPLETED=0
TOTAL=$((PARALLEL_RUNS + 1))

while [ $COMPLETED -lt $TOTAL ]; do
    COMPLETED=0
    
    # Clear line and show status
    echo -ne "\r   Progress: "
    
    for job in "${!PIDS[@]}"; do
        PID=${PIDS[$job]}
        
        if ! kill -0 $PID 2>/dev/null; then
            # Job completed
            COMPLETED=$((COMPLETED + 1))
            echo -ne "${GREEN}●${NC}"
        else
            # Job still running
            echo -ne "${CYAN}○${NC}"
        fi
    done
    
    echo -ne " ($COMPLETED/$TOTAL complete)"
    
    if [ $COMPLETED -lt $TOTAL ]; then
        sleep 1
    fi
done

echo "" # New line after progress
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Collect Results
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

declare -A RESULTS
ALL_PASSED=true

for job in "${!PIDS[@]}"; do
    if [ -f "$LOGS_DIR/$job.exit" ]; then
        EXIT_CODE=$(cat "$LOGS_DIR/$job.exit")
    else
        EXIT_CODE=1
    fi
    
    RESULTS[$job]=$EXIT_CODE
    
    if [ $EXIT_CODE -ne 0 ]; then
        ALL_PASSED=false
    fi
done

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Show Results
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}FINAL RESULTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Group by job type
echo -e "${CYAN}TypeScript SDK:${NC}"
for job in "${!RESULTS[@]}"; do
    if [[ $job == "ts" ]]; then
        EXIT_CODE=${RESULTS[$job]}
        if [ $EXIT_CODE -eq 0 ]; then
            echo -e "   ${GREEN}✓${NC} ${JOB_NAMES[$job]}"
        else
            echo -e "   ${RED}✗${NC} ${JOB_NAMES[$job]}"
        fi
    fi
done

echo ""
echo -e "${CYAN}Python SDK (Parallel Runs):${NC}"
PYTHON_PASS=0
PYTHON_FAIL=0

for i in $(seq 1 $PARALLEL_RUNS); do
    job="python-$i"
    EXIT_CODE=${RESULTS[$job]}
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "   ${GREEN}✓${NC} Run $i"
        PYTHON_PASS=$((PYTHON_PASS + 1))
    else
        echo -e "   ${RED}✗${NC} Run $i (see: $LOGS_DIR/python-$i.log)"
        PYTHON_FAIL=$((PYTHON_FAIL + 1))
    fi
done

echo ""
echo -e "${CYAN}Summary:${NC}"
echo "   Total jobs: $TOTAL"
echo "   Duration: ${DURATION}s"
echo "   Python SDK: $PYTHON_PASS/$PARALLEL_RUNS passed"

# Show test counts if all passed
if [ "$ALL_PASSED" == "true" ]; then
    echo ""
    echo -e "   ${GREEN}Test Counts:${NC}"
    
    # Extract TypeScript test count
    if [ -f "$LOGS_DIR/ts.log" ]; then
        TS_COUNT=$(grep -oE 'Tests:.*[0-9]+ passed' "$LOGS_DIR/ts.log" | grep -oE '[0-9]+ passed' | head -1 | grep -oE '[0-9]+' || echo "?")
        echo "      TypeScript: $TS_COUNT tests"
    fi
    
    # Extract Python test count (from first run)
    if [ -f "$LOGS_DIR/python-1.log" ]; then
        PY_COUNT=$(grep -oE '[0-9]+ passed' "$LOGS_DIR/python-1.log" | tail -1 | grep -oE '[0-9]+' || echo "?")
        echo "      Python: $PY_COUNT tests (per run)"
        echo "      Python Total: $((PY_COUNT * PARALLEL_RUNS)) test executions"
    fi
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Show Failures
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ "$ALL_PASSED" != "true" ]; then
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}FAILURES DETECTED${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    for job in "${!RESULTS[@]}"; do
        if [ ${RESULTS[$job]} -ne 0 ]; then
            NAME=${JOB_NAMES[$job]}
            echo -e "${YELLOW}▼ $NAME Failed:${NC}"
            echo "   Log: $LOGS_DIR/$job.log"
            echo ""
            
            # Show last 30 lines of failures
            if [ -f "$LOGS_DIR/$job.log" ]; then
                echo "   Last 30 lines:"
                tail -30 "$LOGS_DIR/$job.log" | sed 's/^/   │ /'
            fi
            echo ""
        fi
    done
    
    echo -e "${RED}❌ PIPELINE FAILED${NC}"
    echo ""
    echo "   Review logs in: $LOGS_DIR"
    echo ""
    exit 1
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Success
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ ALL PARALLEL TESTS PASSED${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "   🎉 Successfully ran $PARALLEL_RUNS parallel Python test suites"
echo "      with zero conflicts in ${DURATION}s!"
echo ""
echo "   This proves the test isolation system works correctly."
echo "   Logs saved at: $LOGS_DIR"
echo ""

exit 0
