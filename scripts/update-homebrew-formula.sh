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
TARBALL_FILE=$(mktemp)
echo "🔗 Tarball URL: ${TARBALL_URL}"

# Download tarball with retry logic for CDN propagation delay
MAX_RETRIES=6
RETRY_DELAY=10

for i in $(seq 1 $MAX_RETRIES); do
  echo "⬇️  Downloading tarball (attempt $i/$MAX_RETRIES)..."
  
  # Download with HTTP status code check
  HTTP_STATUS=$(curl -sL -w "%{http_code}" -o "$TARBALL_FILE" "${TARBALL_URL}")
  
  if [ "$HTTP_STATUS" = "200" ]; then
    # Verify it's actually a gzip tarball (magic bytes: 1f 8b)
    MAGIC=$(xxd -l 2 -p "$TARBALL_FILE" 2>/dev/null || echo "")
    if [ "$MAGIC" = "1f8b" ]; then
      echo "✅ Valid tarball downloaded (HTTP $HTTP_STATUS)"
      break
    else
      echo "⚠️  Downloaded file is not a valid gzip tarball"
    fi
  else
    echo "⚠️  HTTP $HTTP_STATUS - tarball not yet available"
  fi
  
  if [ $i -lt $MAX_RETRIES ]; then
    echo "   Retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
  fi
done

# Final validation
if [ ! -f "$TARBALL_FILE" ] || [ ! -s "$TARBALL_FILE" ]; then
  echo "❌ Error: Failed to download tarball after $MAX_RETRIES attempts"
  rm -f "$TARBALL_FILE"
  exit 1
fi

MAGIC=$(xxd -l 2 -p "$TARBALL_FILE" 2>/dev/null || echo "")
if [ "$MAGIC" != "1f8b" ]; then
  echo "❌ Error: Downloaded file is not a valid gzip tarball"
  echo "   First 100 bytes:"
  head -c 100 "$TARBALL_FILE" | cat -v
  rm -f "$TARBALL_FILE"
  exit 1
fi

# Compute SHA256 from validated tarball
SHA256=$(shasum -a 256 "$TARBALL_FILE" | cut -d ' ' -f 1)
rm -f "$TARBALL_FILE"

if [ -z "$SHA256" ] || [ ${#SHA256} -ne 64 ]; then
  echo "❌ Error: Invalid SHA256 hash computed"
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
