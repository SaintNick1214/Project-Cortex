#!/bin/bash
#
# Staggered Individual Test Suite Runner
#
# Runs specific test files in parallel with staggered starts
# to simulate pipeline timing inconsistency and catch parallel conflicts.
#
# Usage:
#   ./scripts/test-staggered-suite.sh <test-file> [instances] [stagger-seconds]
#
# Examples:
#   ./scripts/test-staggered-suite.sh tests/agents.test.ts 3 5
#   ./scripts/test-staggered-suite.sh tests/mutable.test.ts 5 3
#   ./scripts/test-staggered-suite.sh all 3 5  # Run all test files

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TEST_FILE=${1:-"tests/agents.test.ts"}
INSTANCES=${2:-3}
STAGGER_SECONDS=${3:-5}
LOCAL_CONVEX_URL=${LOCAL_CONVEX_URL:-"http://127.0.0.1:3210"}

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          STAGGERED TEST SUITE RUNNER                          ║${NC}"
echo -e "${BLUE}║   Simulates pipeline timing inconsistency                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}🔍 Config:${NC}"
echo "   Test file:     $TEST_FILE"
echo "   Instances:     $INSTANCES"
echo "   Stagger:       ${STAGGER_SECONDS}s between starts"
echo "   Convex URL:    $LOCAL_CONVEX_URL"
echo ""

# Create logs directory
LOGS_DIR=$(mktemp -d)
echo -e "${CYAN}📁 Logs directory: $LOGS_DIR${NC}"
echo ""

# Function to run a single test instance
run_test_instance() {
    local instance=$1
    local test_file=$2
    local log_file=$3
    
    if [ "$test_file" == "all" ]; then
        CONVEX_TEST_MODE=local npm test > "$log_file" 2>&1
        echo $? > "${log_file%.log}.exit"
    else
        # Extract just the filename for the test pattern
        local test_pattern=$(basename "$test_file" .ts)
        # Use CONVEX_URL to force local mode, and --testPathPatterns for newer jest
        CONVEX_URL="$LOCAL_CONVEX_URL" CONVEX_TEST_MODE=local npm test -- --testPathPatterns="$test_pattern" > "$log_file" 2>&1
        echo $? > "${log_file%.log}.exit"
    fi
}

# Launch instances with stagger
echo -e "${CYAN}🚀 Launching $INSTANCES instances with ${STAGGER_SECONDS}s stagger...${NC}"
echo ""

# Store PIDs in a simple way for macOS bash compatibility
PID_LIST=""
for i in $(seq 1 $INSTANCES); do
    # Stagger start (except first)
    if [ $i -gt 1 ]; then
        echo -e "   ${YELLOW}⏳ Waiting ${STAGGER_SECONDS}s before instance $i...${NC}"
        sleep $STAGGER_SECONDS
    fi
    
    # Launch test
    run_test_instance $i "$TEST_FILE" "$LOGS_DIR/instance-$i.log" &
    PID=$!
    PID_LIST="$PID_LIST $PID"
    echo -e "   ${GREEN}✓${NC} Instance $i started (PID: $PID)"
done

echo ""
echo -e "${CYAN}⏳ Waiting for all instances to complete...${NC}"
echo "   (This may take a while)"
echo ""

# Wait for all processes
for pid in $PID_LIST; do
    wait $pid 2>/dev/null || true
done

# Collect results
RESULT_LIST=""
for i in $(seq 1 $INSTANCES); do
    EXIT_CODE=$(cat "$LOGS_DIR/instance-$i.exit" 2>/dev/null || echo "1")
    RESULT_LIST="$RESULT_LIST $EXIT_CODE"
done

# Show results
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}RESULTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

FAILED=0
IDX=1
for exit_code in $RESULT_LIST; do
    if [ "$exit_code" == "0" ]; then
        echo -e "   ${GREEN}✓${NC} Instance $IDX: PASSED"
    else
        echo -e "   ${RED}✗${NC} Instance $IDX: FAILED (exit $exit_code)"
        FAILED=$((FAILED + 1))
    fi
    IDX=$((IDX + 1))
done

echo ""

# Show failure details
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ $FAILED of $INSTANCES instances failed${NC}"
    echo ""
    echo -e "${YELLOW}Failure summaries:${NC}"
    
    IDX=1
    for exit_code in $RESULT_LIST; do
        if [ "$exit_code" != "0" ]; then
            echo ""
            echo -e "${YELLOW}=== Instance $IDX failures ===${NC}"
            grep -E "FAIL|Error:|expect\(|received|Expected" "$LOGS_DIR/instance-$IDX.log" 2>/dev/null | tail -30
        fi
        IDX=$((IDX + 1))
    done
    
    echo ""
    echo -e "${CYAN}Full logs: $LOGS_DIR${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All $INSTANCES instances passed!${NC}"
    echo ""
    rm -rf "$LOGS_DIR"
    exit 0
fi
