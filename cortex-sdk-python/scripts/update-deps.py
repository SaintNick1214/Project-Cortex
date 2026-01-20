#!/usr/bin/env python3
"""
Update Python dependencies to latest versions in pyproject.toml and requirements files.
Equivalent to `npm run update-deps` for the TypeScript SDK.
"""

import re
import sys
import urllib.request
import json
from pathlib import Path


def get_latest_version(package_name: str) -> str | None:
    """Query PyPI for the latest version of a package."""
    # Normalize package name for PyPI API
    normalized = package_name.lower().replace("_", "-")
    url = f"https://pypi.org/pypi/{normalized}/json"
    
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode())
            return data["info"]["version"]
    except Exception as e:
        print(f"  ⚠️  Could not fetch {package_name}: {e}")
        return None


def update_version_in_line(line: str, new_version: str) -> str:
    """Update a version constraint in a dependency line."""
    # Match patterns like: package>=1.0, package>=1.0.0, package[extra]>=1.0
    # Captures: prefix, package (with optional extras), operator, version, and rest (comments only)
    pattern = r'^(\s*["\']?)([a-zA-Z0-9_-]+(?:\[[^\]]+\])?)([><=!~]+)([\d.]+)(\s*#.*)?$'
    match = re.match(pattern, line)
    if match:
        prefix = match.group(1)
        package_with_extras = match.group(2)
        operator = match.group(3)
        # old_version = match.group(4)  # Not needed, we replace it
        comment = match.group(5) or ''
        return f"{prefix}{package_with_extras}{operator}{new_version}{comment}"
    return line


def extract_package_name(line: str) -> str | None:
    """Extract package name from a dependency line."""
    # Match package name, handling extras like [dev]
    match = re.match(r'^[\s"\']*([a-zA-Z0-9_-]+)', line.strip())
    if match:
        return match.group(1)
    return None


def update_pyproject_toml(filepath: Path) -> list[tuple[str, str, str]]:
    """Update pyproject.toml dependencies. Returns list of (package, old, new) tuples."""
    content = filepath.read_text()
    updates = []
    
    # Find all dependencies with version constraints
    # Matches: "package>=1.0" or 'package>=1.0' or package>=1.0
    pattern = r'["\']?([a-zA-Z0-9_-]+)(?:\[[^\]]+\])?[><=!~]+([\d.]+)'
    
    for match in re.finditer(pattern, content):
        package = match.group(1)
        old_version = match.group(2)
        
        # Skip build system packages and packages with stale metadata
        # pytest-split hasn't updated its metadata for pytest 9, installed separately
        if package in ('setuptools', 'wheel', 'pytest-split'):
            continue
            
        new_version = get_latest_version(package)
        if new_version and new_version != old_version:
            updates.append((package, old_version, new_version))
            # Replace this specific occurrence
            old_pattern = f'{package}([><=!~]+){re.escape(old_version)}'
            new_replacement = f'{package}\\g<1>{new_version}'
            content = re.sub(old_pattern, new_replacement, content, count=1)
            
            # Handle quoted versions with extras
            old_pattern_extras = f'"{package}(\\[[^\\]]+\\])?([><=!~]+){re.escape(old_version)}"'
            new_replacement_extras = f'"{package}\\g<1>\\g<2>{new_version}"'
            content = re.sub(old_pattern_extras, new_replacement_extras, content)
    
    filepath.write_text(content)
    return updates


def update_requirements_file(filepath: Path) -> list[tuple[str, str, str]]:
    """Update a requirements.txt file. Returns list of (package, old, new) tuples."""
    if not filepath.exists():
        return []
    
    lines = filepath.read_text().splitlines()
    updates = []
    new_lines = []
    
    for line in lines:
        # Skip comments and empty lines
        if not line.strip() or line.strip().startswith('#'):
            new_lines.append(line)
            continue
        
        package = extract_package_name(line)
        if not package:
            new_lines.append(line)
            continue
        
        # Skip packages with stale metadata (installed separately)
        if package in ('pytest-split',):
            new_lines.append(line)
            continue
        
        # Extract current version
        version_match = re.search(r'[><=!~]+([\d.]+)', line)
        if not version_match:
            new_lines.append(line)
            continue
        
        old_version = version_match.group(1)
        new_version = get_latest_version(package)
        
        if new_version and new_version != old_version:
            updates.append((package, old_version, new_version))
            new_line = update_version_in_line(line, new_version)
            new_lines.append(new_line)
        else:
            new_lines.append(line)
    
    filepath.write_text('\n'.join(new_lines) + '\n')
    return updates


def main():
    script_dir = Path(__file__).parent
    sdk_root = script_dir.parent
    
    print("🔍 Checking PyPI for latest versions...\n")
    
    all_updates: dict[str, tuple[str, str]] = {}
    
    # Update pyproject.toml
    pyproject = sdk_root / "pyproject.toml"
    if pyproject.exists():
        print(f"📦 Updating {pyproject.name}...")
        updates = update_pyproject_toml(pyproject)
        for pkg, old, new in updates:
            all_updates[pkg] = (old, new)
    
    # Update requirements.txt
    requirements = sdk_root / "requirements.txt"
    if requirements.exists():
        print(f"📦 Updating {requirements.name}...")
        updates = update_requirements_file(requirements)
        for pkg, old, new in updates:
            if pkg not in all_updates:
                all_updates[pkg] = (old, new)
    
    # Update requirements-dev.txt
    requirements_dev = sdk_root / "requirements-dev.txt"
    if requirements_dev.exists():
        print(f"📦 Updating {requirements_dev.name}...")
        updates = update_requirements_file(requirements_dev)
        for pkg, old, new in updates:
            if pkg not in all_updates:
                all_updates[pkg] = (old, new)
    
    # Print summary
    print("\n" + "=" * 50)
    if all_updates:
        print(f"✅ Updated {len(all_updates)} package(s):\n")
        for pkg in sorted(all_updates.keys()):
            old, new = all_updates[pkg]
            print(f"  {pkg}: {old} → {new}")
        print("\n💡 Run 'make install-deps' to install the new versions")
    else:
        print("✅ All dependencies are already at latest versions!")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
