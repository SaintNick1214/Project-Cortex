#!/usr/bin/env python3
"""
Python SDK Test Runner

Orchestrates testing against local and/or managed Convex deployments.
Mirrors the TypeScript SDK's dual-testing capability.

Usage:
    python scripts/run-python-tests.py                    # Auto-detect and run appropriate suite(s)
    python scripts/run-python-tests.py --mode=local      # Test LOCAL only
    python scripts/run-python-tests.py --mode=managed    # Test MANAGED only
    python scripts/run-python-tests.py --mode=both       # Test both explicitly
    python scripts/run-python-tests.py --mode=auto       # Auto-detect (default)

Additional pytest args:
    python scripts/run-python-tests.py --mode=local -v -k test_memory
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env.local to get deployment configurations
project_root = Path(__file__).parent.parent.parent
env_file = project_root / ".env.local"
if env_file.exists():
    load_dotenv(env_file)

def has_local_config():
    """Check if LOCAL Convex configuration is available."""
    return bool(os.getenv("LOCAL_CONVEX_URL"))

def has_managed_config():
    """Check if MANAGED Convex configuration is available."""
    return bool(os.getenv("CLOUD_CONVEX_URL"))

def run_tests(mode, pytest_args):
    """
    Run pytest with specific test mode.

    Args:
        mode: "local" or "managed"
        pytest_args: Additional pytest arguments
    """
    env = os.environ.copy()
    env["CONVEX_TEST_MODE"] = mode

    print("\n" + "=" * 60)
    print(f"🚀 Running {mode.upper()} tests...")
    print("=" * 60 + "\n")

    # Build pytest command
    sdk_path = project_root / "cortex-sdk-python"
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "-v",
        "--tb=short",
        *pytest_args
    ]

    # Run tests
    result = subprocess.run(
        cmd,
        cwd=sdk_path,
        env=env,

    )

    if result.returncode == 0:
        print(f"\n✅ {mode.upper()} tests completed successfully\n")
        return True
    else:
        print(f"\n❌ {mode.upper()} tests failed with code {result.returncode}\n")
        return False

def main():
    parser = argparse.ArgumentParser(description="Python SDK Test Runner")
    parser.add_argument(
        "--mode",
        choices=["local", "managed", "both", "auto"],
        default="auto",
        help="Test mode: local, managed, both, or auto-detect (default: auto)"
    )

    args, pytest_args = parser.parse_known_args()

    has_local = has_local_config()
    has_managed = has_managed_config()

    print("\n🔍 [Python SDK] Detecting available Convex configurations...")
    print(f"   Local config (LOCAL_CONVEX_URL): {'✅ Found' if has_local else '❌ Not found'}")
    print(f"   Managed config (CLOUD_CONVEX_URL): {'✅ Found' if has_managed else '❌ Not found'}")
    print(f"   Test mode: {args.mode}\n")

    # Handle explicit test modes
    if args.mode == "local":
        if not has_local:
            print("❌ LOCAL test mode requested but LOCAL_CONVEX_URL not configured in .env.local")
            sys.exit(1)
        success = run_tests("local", pytest_args)
        sys.exit(0 if success else 1)

    elif args.mode == "managed":
        if not has_managed:
            print("❌ MANAGED test mode requested but CLOUD_CONVEX_URL not configured in .env.local")
            sys.exit(1)
        success = run_tests("managed", pytest_args)
        sys.exit(0 if success else 1)

    elif args.mode == "both":
        # Explicitly run both suites
        if not has_local or not has_managed:
            print("❌ BOTH mode requires both LOCAL_CONVEX_URL and CLOUD_CONVEX_URL in .env.local")
            sys.exit(1)

        print("🎯 Both configurations detected - running DUAL TEST SUITE")
        print("   Tests will run against both local AND managed environments\n")

        local_success = run_tests("local", pytest_args)
        managed_success = run_tests("managed", pytest_args)

        if local_success and managed_success:
            print("\n" + "=" * 60)
            print("🎉 SUCCESS: All test suites passed!")
            print("   ✅ Local tests: PASSED")
            print("   ✅ Managed tests: PASSED")
            print("=" * 60 + "\n")
            sys.exit(0)
        else:
            print("\n" + "=" * 60)
            print("❌ FAILURE: Some test suites failed")
            print(f"   {'✅' if local_success else '❌'} Local tests: {'PASSED' if local_success else 'FAILED'}")
            print(f"   {'✅' if managed_success else '❌'} Managed tests: {'PASSED' if managed_success else 'FAILED'}")
            print("=" * 60 + "\n")
            sys.exit(1)

    elif args.mode == "auto":
        # Auto-detect and run appropriate suite(s)
        if not has_local and not has_managed:
            print("❌ No Convex configuration found in .env.local")
            print("Configure either:")
            print("  - LOCAL_CONVEX_URL for local testing")
            print("  - CLOUD_CONVEX_URL for managed testing")
            sys.exit(1)

        test_suites = []
        if has_local:
            test_suites.append("local")
        if has_managed:
            test_suites.append("managed")

        if len(test_suites) == 2:
            print("🎯 Both configurations detected - running DUAL TEST SUITE")
            print("   Tests will run against both local AND managed environments\n")

        # Run each test suite
        all_passed = True
        results = {}
        for suite in test_suites:
            results[suite] = run_tests(suite, pytest_args)
            if not results[suite]:
                all_passed = False

        # Summary
        if len(test_suites) == 2:
            print("\n" + "=" * 60)
            if all_passed:
                print("🎉 SUCCESS: All test suites passed!")
            else:
                print("❌ FAILURE: Some test suites failed")
            for suite in test_suites:
                status = "PASSED" if results[suite] else "FAILED"
                icon = "✅" if results[suite] else "❌"
                print(f"   {icon} {suite.capitalize()} tests: {status}")
            print("=" * 60 + "\n")

        sys.exit(0 if all_passed else 1)

    else:
        print(f"❌ Invalid test mode: {args.mode}")
        print("Valid modes: local, managed, both, auto")
        sys.exit(1)

if __name__ == "__main__":
    main()

