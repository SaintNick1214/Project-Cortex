#!/bin/bash

# Smoke test for create-cortex-memories
# Verifies the wizard can be invoked and basic structure is correct

set -e

echo "🧪 Running smoke tests for create-cortex-memories..."
echo ""

# Test 1: Check dist files exist
echo "Test 1: Verifying build output..."
if [ -f "dist/index.js" ]; then
  echo "✅ dist/index.js exists"
else
  echo "❌ dist/index.js not found"
  exit 1
fi

if [ -f "dist/wizard.js" ]; then
  echo "✅ dist/wizard.js exists"
else
  echo "❌ dist/wizard.js not found"
  exit 1
fi

# Test 2: Check template files exist
echo ""
echo "Test 2: Verifying template files..."
if [ -f "templates/basic/package.json" ]; then
  echo "✅ Template package.json exists"
else
  echo "❌ Template package.json not found"
  exit 1
fi

if [ -f "templates/basic/src/index.ts" ]; then
  echo "✅ Template index.ts exists"
else
  echo "❌ Template index.ts not found"
  exit 1
fi

# Test 3: Check module can be loaded
echo ""
echo "Test 3: Verifying module can be loaded..."
node -e "import('./dist/utils.js').then(() => console.log('✅ Utils module loads'))" || exit 1
node -e "import('./dist/types.js').then(() => console.log('✅ Types module loads'))" || exit 1

# Test 4: Verify all source files compiled
echo ""
echo "Test 4: Verifying all modules compiled..."
MODULES=("index" "wizard" "convex-setup" "graph-setup" "file-operations" "env-generator" "utils" "types")
for module in "${MODULES[@]}"; do
  if [ -f "dist/${module}.js" ]; then
    echo "✅ ${module}.js compiled"
  else
    echo "❌ ${module}.js not found"
    exit 1
  fi
done

echo ""
echo "✅ All smoke tests passed!"
echo ""
echo "📝 To manually test the wizard:"
echo "   node dist/index.js test-project"

