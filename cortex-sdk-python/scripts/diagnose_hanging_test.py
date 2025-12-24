#!/usr/bin/env python3
"""
Diagnostic script to find hanging tests.

Runs individual test files with aggressive parallelism and short timeouts
to identify which test is causing the 92% hang.

Usage:
    python scripts/diagnose_hanging_test.py                    # Run all suspects
    python scripts/diagnose_hanging_test.py --file test_users  # Run specific file
    python scripts/diagnose_hanging_test.py --timeout 60       # Custom timeout (seconds)
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

# Test files around 92% mark that are suspects
SUSPECT_FILES = [
    "test_users.py",
    "test_vector.py",
    # Files that use context deletion (cleanup may hang)
    "test_contexts.py",
    "test_contexts_filters.py",
    "test_operation_sequences.py",
    "test_cross_layer_integrity.py",
]

# Get project root
script_dir = Path(__file__).parent
sdk_path = script_dir.parent
project_root = sdk_path.parent


def run_test_file(test_file: str, timeout_seconds: int, parallelism: int) -> dict:
    """
    Run a single test file with timeout and parallelism.
    
    Returns dict with:
        - file: test file name
        - passed: bool
        - duration: float (seconds)
        - timeout: bool (True if timed out)
        - error: str or None
    """
    test_path = sdk_path / "tests" / test_file
    
    if not test_path.exists():
        return {
            "file": test_file,
            "passed": False,
            "duration": 0,
            "timeout": False,
            "error": f"File not found: {test_path}"
        }
    
    env = os.environ.copy()
    env["CONVEX_TEST_MODE"] = os.getenv("CONVEX_TEST_MODE", "managed")
    
    cmd = [
        sys.executable,
        "-m", "pytest",
        str(test_path),
        "-v",
        "--tb=short",
        f"-n", str(parallelism),
        f"--timeout={timeout_seconds}",
        "--timeout_method=thread",
    ]
    
    print(f"\n{'='*60}")
    print(f"🔬 Testing: {test_file}")
    print(f"   Parallelism: {parallelism}, Timeout: {timeout_seconds}s per test")
    print(f"{'='*60}")
    
    start = time.time()
    
    try:
        result = subprocess.run(
            cmd,
            cwd=sdk_path,
            env=env,
            timeout=timeout_seconds * 10,  # Overall timeout = 10x per-test timeout
            capture_output=True,
            text=True,
        )
        duration = time.time() - start
        
        passed = result.returncode == 0
        
        # Check for timeout failures in output
        timed_out = "Timeout" in result.stdout or "timeout" in result.stdout.lower()
        
        if not passed:
            # Show last 50 lines of output for failed tests
            output_lines = result.stdout.split('\n')
            print("\n📋 Last 50 lines of output:")
            print('\n'.join(output_lines[-50:]))
            
            if result.stderr:
                print("\n⚠️ Stderr:")
                print(result.stderr[-1000:])
        
        return {
            "file": test_file,
            "passed": passed,
            "duration": duration,
            "timeout": timed_out,
            "error": None if passed else "Tests failed"
        }
        
    except subprocess.TimeoutExpired:
        duration = time.time() - start
        print(f"\n⏰ OVERALL TIMEOUT after {duration:.1f}s")
        print(f"   This file likely contains the hanging test!")
        return {
            "file": test_file,
            "passed": False,
            "duration": duration,
            "timeout": True,
            "error": "Overall timeout expired - likely contains hanging test"
        }
    except Exception as e:
        duration = time.time() - start
        return {
            "file": test_file,
            "passed": False,
            "duration": duration,
            "timeout": False,
            "error": str(e)
        }


def run_individual_tests(test_file: str, timeout_seconds: int) -> list:
    """
    Run each test in a file individually to pinpoint the hanging test.
    """
    test_path = sdk_path / "tests" / test_file
    
    # Collect test names
    collect_cmd = [
        sys.executable,
        "-m", "pytest",
        str(test_path),
        "--collect-only",
        "-q",
    ]
    
    result = subprocess.run(
        collect_cmd,
        cwd=sdk_path,
        capture_output=True,
        text=True,
    )
    
    # Parse test names from output (format: file.py::TestClass::test_name)
    test_names = []
    for line in result.stdout.split('\n'):
        if '::' in line and line.strip():
            test_names.append(line.strip())
    
    print(f"\n🔍 Found {len(test_names)} tests in {test_file}")
    print(f"   Running each with {timeout_seconds}s timeout...\n")
    
    results = []
    for i, test_name in enumerate(test_names):
        # Extract just the test part after the file
        test_spec = test_name.split('::')[-1] if '::' in test_name else test_name
        
        print(f"[{i+1}/{len(test_names)}] {test_spec}...", end=" ", flush=True)
        
        cmd = [
            sys.executable,
            "-m", "pytest",
            test_name,
            "-v",
            "--tb=short",
            f"--timeout={timeout_seconds}",
            "--timeout_method=thread",
            "-n", "0",  # No parallelism for individual tests
        ]
        
        start = time.time()
        
        try:
            proc_result = subprocess.run(
                cmd,
                cwd=sdk_path,
                timeout=timeout_seconds + 10,
                capture_output=True,
                text=True,
            )
            duration = time.time() - start
            passed = proc_result.returncode == 0
            
            status = "✅" if passed else "❌"
            print(f"{status} ({duration:.1f}s)")
            
            results.append({
                "test": test_name,
                "passed": passed,
                "duration": duration,
                "timeout": False,
            })
            
        except subprocess.TimeoutExpired:
            duration = time.time() - start
            print(f"⏰ TIMEOUT ({duration:.1f}s) ← 🎯 FOUND HANGING TEST!")
            
            results.append({
                "test": test_name,
                "passed": False,
                "duration": duration,
                "timeout": True,
            })
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Diagnose hanging Python SDK tests")
    parser.add_argument(
        "--file",
        type=str,
        help="Specific test file to diagnose (e.g., test_users)"
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=120,
        help="Per-test timeout in seconds (default: 120)"
    )
    parser.add_argument(
        "--parallelism",
        "-n",
        type=int,
        default=8,
        help="Number of parallel workers (default: 8)"
    )
    parser.add_argument(
        "--individual",
        action="store_true",
        help="Run tests individually (slower but pinpoints exact test)"
    )
    
    args = parser.parse_args()
    
    # Check for pytest-timeout
    try:
        import pytest_timeout
    except ImportError:
        print("⚠️  pytest-timeout not installed. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pytest-timeout"], check=True)
    
    print("\n" + "="*60)
    print("🔍 PYTHON SDK HANGING TEST DIAGNOSTIC")
    print("="*60)
    print(f"   Timeout per test: {args.timeout}s")
    print(f"   Parallelism: {args.parallelism}")
    print(f"   Mode: {'Individual tests' if args.individual else 'Full file runs'}")
    print("="*60 + "\n")
    
    if args.file:
        # Specific file
        test_file = args.file if args.file.endswith('.py') else f"{args.file}.py"
        files_to_test = [test_file]
    else:
        files_to_test = SUSPECT_FILES
    
    if args.individual:
        # Run individual tests in a file
        for test_file in files_to_test:
            results = run_individual_tests(test_file, args.timeout)
            
            # Summary
            timeouts = [r for r in results if r["timeout"]]
            if timeouts:
                print(f"\n🎯 HANGING TESTS FOUND in {test_file}:")
                for r in timeouts:
                    print(f"   - {r['test']}")
    else:
        # Run full files
        results = []
        for test_file in files_to_test:
            result = run_test_file(test_file, args.timeout, args.parallelism)
            results.append(result)
        
        # Summary
        print("\n" + "="*60)
        print("📊 DIAGNOSTIC SUMMARY")
        print("="*60)
        
        for r in results:
            status = "✅" if r["passed"] else ("⏰" if r["timeout"] else "❌")
            print(f"   {status} {r['file']}: {r['duration']:.1f}s")
            if r["error"]:
                print(f"      Error: {r['error']}")
        
        # Identify likely culprits
        timeouts = [r for r in results if r["timeout"]]
        failures = [r for r in results if not r["passed"] and not r["timeout"]]
        passed = [r for r in results if r["passed"]]
        
        if timeouts:
            print(f"\n🎯 TIMEOUT DETECTED - LIKELY HANGING TEST FILES:")
            for r in timeouts:
                print(f"   - {r['file']}")
            print(f"\nRun with --individual --file {timeouts[0]['file']} to pinpoint exact test")
        elif failures:
            print(f"\n⚠️  {len(failures)} files had failures (but no timeouts)")
            for r in failures:
                print(f"   - {r['file']}")
        elif passed:
            print(f"\n✅ All {len(passed)} files passed!")
            print("   If hang occurs in CI but not locally, it may be due to:")
            print("   - Parallel execution contention (5 Python versions)")
            print("   - Module cleanup/teardown hanging")
            print("   - Test ordering differences")


if __name__ == "__main__":
    main()
