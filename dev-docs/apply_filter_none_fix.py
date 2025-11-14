#!/usr/bin/env python3
"""
Script to apply filter_none_values to all remaining API modules.

This fixes the issue where None values are passed to Convex functions.
"""

import re
from pathlib import Path

def add_import_if_missing(file_path):
    """Add filter_none_values import if missing."""
    content = file_path.read_text()
    
    if 'from .._utils import filter_none_values' in content:
        return False  # Already has import
    
    # Find the imports section and add our import
    pattern = r'(from \.\.errors import.*?)\n'
    replacement = r'\1\nfrom .._utils import filter_none_values\n'
    
    new_content = re.sub(pattern, replacement, content, count=1)
    
    if new_content != content:
        file_path.write_text(new_content)
        return True
    return False

def wrap_client_calls(file_path):
    """Wrap all client.query() and client.mutation() calls with filter_none_values."""
    content = file_path.read_text()
    original = content
    
    # Pattern 1: Single-line dict
    pattern1 = r'(await self\.client\.(query|mutation)\(\s*"[^"]+",\s*)(\{[^}]+\})'
    
    def replace_fn(match):
        prefix = match.group(1)
        dict_content = match.group(3)
        if 'filter_none_values' in dict_content:
            return match.group(0)  # Already filtered
        return f'{prefix}filter_none_values({dict_content})'
    
    content = re.sub(pattern1, replace_fn, content)
    
    # Pattern 2: Multi-line dict (more complex, do manually for these)
    
    if content != original:
        file_path.write_text(content)
        return True
    return False

# Modules to fix
modules = [
    'cortex/vector/__init__.py',
    'cortex/facts/__init__.py',
    'cortex/contexts/__init__.py',
    'cortex/users/__init__.py',
    'cortex/agents/__init__.py',
    'cortex/memory_spaces/__init__.py',
    'cortex/a2a/__init__.py',
]

base_path = Path(__file__).parent

for module in modules:
    file_path = base_path / module
    if file_path.exists():
        print(f"Processing {module}...")
        if add_import_if_missing(file_path):
            print(f"  ✅ Added import")
        if wrap_client_calls(file_path):
            print(f"  ✅ Wrapped client calls")
    else:
        print(f"  ❌ File not found: {file_path}")

print("\n✅ Done! Some multi-line dicts may need manual fixes.")

