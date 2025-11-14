#!/bin/bash
#
# Quick script to run helper verification tests
#

set -e

echo "=========================================="
echo "Python SDK - Helper Verification Tests"
echo "=========================================="
echo ""

# Check if venv exists
if [ ! -d ".venv" ]; then
    echo "❌ Error: .venv not found"
    echo "   Run: python3.13 -m venv .venv && source .venv/bin/activate && pip install -e \".[dev]\""
    exit 1
fi

# Activate venv and run tests
echo "→ Activating Python 3.13 environment..."
source .venv/bin/activate

echo "→ Python version:"
python --version

echo ""
echo "→ Running helper verification tests..."
echo "=========================================="
echo ""

pytest tests/test_helpers_verification.py -v -s

echo ""
echo "=========================================="
echo "✅ Helper Verification Complete!"
echo "=========================================="

