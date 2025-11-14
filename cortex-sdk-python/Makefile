.PHONY: test test-local test-managed test-both install dev clean

# Default test target - auto-detects and runs appropriate suite(s)
# Mirrors TypeScript SDK's "npm test" behavior
test:
	@python scripts/run-python-tests.py --mode=auto

# Run local tests only
test-local:
	@python scripts/run-python-tests.py --mode=local

# Run managed tests only
test-managed:
	@python scripts/run-python-tests.py --mode=managed

# Explicitly run both suites
test-both:
	@python scripts/run-python-tests.py --mode=both

# Install package in development mode
install:
	pip install -e ".[dev]"

# Development setup (venv + install)
dev:
	python3 -m venv .venv
	.venv/bin/pip install -e ".[dev]"
	@echo "✅ Development environment ready"
	@echo "   Activate with: source .venv/bin/activate"

# Clean build artifacts
clean:
	rm -rf build/ dist/ *.egg-info .pytest_cache/ .coverage htmlcov/
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# Help
help:
	@echo "Python SDK Test Commands (mirrors TypeScript SDK)"
	@echo ""
	@echo "  make test          - Auto-detect and run appropriate suite(s) (like 'npm test')"
	@echo "  make test-local    - Run LOCAL tests only (like 'npm run test:local')"
	@echo "  make test-managed  - Run MANAGED tests only (like 'npm run test:managed')"
	@echo "  make test-both     - Explicitly run BOTH suites (like 'npm run test:both')"
	@echo ""
	@echo "  make install       - Install package in development mode"
	@echo "  make dev           - Create venv and install (first-time setup)"
	@echo "  make clean         - Remove build artifacts"
	@echo ""
	@echo "Direct pytest (runs single suite based on CONVEX_TEST_MODE):"
	@echo "  pytest tests/      - Uses conftest.py auto-detection (defaults to LOCAL if both present)"
	@echo ""
	@echo "Environment variables:"
	@echo "  CONVEX_TEST_MODE=local|managed|auto  - Override test mode"

