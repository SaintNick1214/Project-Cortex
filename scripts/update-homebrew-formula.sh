#!/bin/bash
# Updates the Homebrew formula with new version and SHA256 hash
# Called by CI after npm publish succeeds
#
# Usage: ./scripts/update-homebrew-formula.sh <version>
# Example: ./scripts/update-homebrew-formula.sh 0.24.0

set -e

VERSION="${1:?Error: Version argument required}"
FORMULA_PATH="homebrew/Formula/cli.rb"
NPM_PACKAGE="@cortexmemory/cli"

echo "════════════════════════════════════════════════════════════"
echo "  Updating Homebrew Formula"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📦 Package: ${NPM_PACKAGE}@${VERSION}"
echo "📄 Formula: ${FORMULA_PATH}"
echo ""

# Construct the npm tarball URL
TARBALL_URL="https://registry.npmjs.org/${NPM_PACKAGE}/-/cli-${VERSION}.tgz"
echo "🔗 Tarball URL: ${TARBALL_URL}"

# Download tarball and compute SHA256
echo "⬇️  Downloading tarball..."
SHA256=$(curl -sL "${TARBALL_URL}" | shasum -a 256 | cut -d ' ' -f 1)

if [ -z "$SHA256" ] || [ ${#SHA256} -ne 64 ]; then
  echo "❌ Error: Failed to compute SHA256 hash"
  exit 1
fi

echo "🔐 SHA256: ${SHA256}"

# Check if formula file exists
if [ ! -f "${FORMULA_PATH}" ]; then
  echo "❌ Error: Formula file not found at ${FORMULA_PATH}"
  exit 1
fi

# Update the URL line with new version
sed -i.bak "s|url \"https://registry.npmjs.org/@cortexmemory/cli/-/cli-[0-9.]*\.tgz\"|url \"https://registry.npmjs.org/@cortexmemory/cli/-/cli-${VERSION}.tgz\"|" "${FORMULA_PATH}"

# Update the SHA256 line
sed -i.bak "s|sha256 \"[a-f0-9]*\"|sha256 \"${SHA256}\"|" "${FORMULA_PATH}"

# Clean up backup file created by sed
rm -f "${FORMULA_PATH}.bak"

echo ""
echo "✅ Formula updated successfully!"
echo ""

# Show the updated formula
echo "📋 Updated formula:"
echo "────────────────────────────────────────────────────────────"
cat "${FORMULA_PATH}"
echo "────────────────────────────────────────────────────────────"
