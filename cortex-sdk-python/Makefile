.PHONY: test test-local test-managed test-both test-stress install install-deps dev clean update-deps check-deps

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

# Run manual stress tests (NOT for CI - tests resilience under real load)
test-stress:
	@echo "⚠️  Running MANUAL stress tests - this will create significant database load!"
	@python tests/resilience_stress_manual.py

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

# Update source files (pyproject.toml, requirements*.txt) to latest PyPI versions
# Mirrors `npm run update-deps` behavior
update-deps:
	@python3 scripts/update-deps.py

# Install/upgrade packages in venv to match source file versions
install-deps:
	@if [ -d ".venv" ]; then \
		echo "📦 Using .venv environment..."; \
		.venv/bin/pip install --upgrade --no-deps pytest-split; \
		.venv/bin/pip install --upgrade -e ".[dev,all]"; \
	else \
		echo "⚠️  No .venv found, using current Python environment"; \
		pip install --upgrade --no-deps pytest-split; \
		pip install --upgrade -e ".[dev,all]"; \
	fi
	@echo "✅ Dependencies installed"

# Show outdated packages vs what's installed
check-deps:
	@if [ -d ".venv" ]; then \
		.venv/bin/pip list --outdated; \
	else \
		pip list --outdated; \
	fi

# Help
help:
	@echo "Python SDK Test Commands (mirrors TypeScript SDK)"
	@echo ""
	@echo "  make test          - Auto-detect and run appropriate suite(s) (like 'npm test')"
	@echo "  make test-local    - Run LOCAL tests only (like 'npm run test:local')"
	@echo "  make test-managed  - Run MANAGED tests only (like 'npm run test:managed')"
	@echo "  make test-both     - Explicitly run BOTH suites (like 'npm run test:both')"
	@echo "  make test-stress   - Manual stress tests (NOT for CI) - tests resilience under real load"
	@echo ""
	@echo "  make install       - Install package in development mode"
	@echo "  make dev           - Create venv and install (first-time setup)"
	@echo "  make update-deps   - Update pyproject.toml & requirements to latest (like npm run update-deps)"
	@echo "  make install-deps  - Install updated deps into venv"
	@echo "  make check-deps    - Show outdated packages vs installed"
	@echo "  make clean         - Remove build artifacts"
	@echo ""
	@echo "Direct pytest (runs single suite based on CONVEX_TEST_MODE):"
	@echo "  pytest tests/      - Uses conftest.py auto-detection (defaults to LOCAL if both present)"
	@echo ""
	@echo "Environment variables:"
	@echo "  CONVEX_TEST_MODE=local|managed|auto  - Override test mode"

