#!/bin/bash
set -e

# Advanced Local Pipeline Test Script  
# Compatible with macOS default bash (3.2+)

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
echo "║   Runs parallel Python + TypeScript test suites               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Load .env.local
if [ -f ".env.local" ]; then
    while IFS='=' read -r key value; do
        if [[ $key =~ ^[A-Z_]+ ]]; then
            value=$(echo "$value" | sed 's/#.*$//' | xargs)
            export "$key=$value"
        fi
    done < .env.local
fi

# Check for local Convex
if [ -z "$LOCAL_CONVEX_URL" ]; then
    echo -e "${RED}✗ LOCAL_CONVEX_URL not set${NC}"
    exit 1
fi

PYTHON_PARALLEL=${1:-5}
TS_PARALLEL=${2:-3}
TOTAL_JOBS=$((PYTHON_PARALLEL + TS_PARALLEL))

echo -e "${CYAN}🔍 Config: $TOTAL_JOBS jobs ($TS_PARALLEL TS + $PYTHON_PARALLEL Python)${NC}"
echo ""

# Purge
echo -e "${CYAN}🧹 Purging database...${NC}"
npx tsx scripts/cleanup-test-data.ts $LOCAL_CONVEX_URL 2>&1 | grep -E "✅|TOTAL"
echo ""

# Launch tests
LOGS_DIR=$(mktemp -d)
echo -e "${CYAN}📦 Launching TypeScript ($TS_PARALLEL runs)...${NC}"

for i in $(seq 1 $TS_PARALLEL); do
    (CONVEX_TEST_MODE=local npm test > "$LOGS_DIR/ts-$i.log" 2>&1; echo $? > "$LOGS_DIR/ts-$i.exit") &
    echo "   Run $i (PID: $!)"
done

echo ""
echo -e "${CYAN}🐍 Launching Python ($PYTHON_PARALLEL runs)...${NC}"

for i in $(seq 1 $PYTHON_PARALLEL); do
    (cd cortex-sdk-python && CONVEX_URL=$LOCAL_CONVEX_URL CONVEX_TEST_MODE=local pytest tests/ -q > "$LOGS_DIR/python-$i.log" 2>&1; echo $? > "$LOGS_DIR/python-$i.exit") &
    echo "   Run $i (PID: $!)"
done

echo ""
echo -e "${CYAN}⏳ Waiting for completion...${NC}"

# Wait for all background jobs
wait

# Check results
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}RESULTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

ALL_PASSED=true

echo -e "${CYAN}TypeScript SDK:${NC}"
for i in $(seq 1 $TS_PARALLEL); do
    exit_code=$(cat "$LOGS_DIR/ts-$i.exit" 2>/dev/null || echo 1)
    if [ $exit_code -eq 0 ]; then
        echo -e "   ${GREEN}✓${NC} Run $i"
    else
        echo -e "   ${RED}✗${NC} Run $i"
        ALL_PASSED=false
    fi
done

echo ""
echo -e "${CYAN}Python SDK:${NC}"
for i in $(seq 1 $PYTHON_PARALLEL); do
    exit_code=$(cat "$LOGS_DIR/python-$i.exit" 2>/dev/null || echo 1)
    if [ $exit_code -eq 0 ]; then
        echo -e "   ${GREEN}✓${NC} Run $i"
    else
        echo -e "   ${RED}✗${NC} Run $i"
        ALL_PASSED=false
    fi
done

echo ""

if [ "$ALL_PASSED" = "true" ]; then
    echo -e "${GREEN}✅ ALL $TOTAL_JOBS PARALLEL TESTS PASSED${NC}"
    echo "   Logs: $LOGS_DIR"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo "   Check logs: $LOGS_DIR"
    exit 1
fi
