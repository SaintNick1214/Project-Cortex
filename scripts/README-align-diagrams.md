# Markdown Diagram Alignment Utility

Automatically aligns ASCII box diagrams in markdown files by making boxes in the same row have consistent widths.

## Problem

When creating ASCII diagrams in markdown, it's easy to create boxes with inconsistent widths:

```
┌────────────────────┐    ┌─────────────────────┐
│  Box 1             │    │  Box 2              │
└────────────────────┘    └─────────────────────┘
```

The boxes above have different widths (20 vs 21 characters), making the diagram look messy.

## Solution

This utility automatically detects boxes in the same row and makes them have consistent widths:

```
┌────────────────────┐    ┌────────────────────┐
│  Box 1             │    │  Box 2             │
└────────────────────┘    └────────────────────┘
```

Now both boxes are 20 characters wide.

## Usage

### Process a Single File

```bash
npx ts-node --esm scripts/align-diagrams.ts path/to/file.md
```

### Preview Changes (Dry Run)

```bash
npx ts-node --esm scripts/align-diagrams.ts --dry-run path/to/file.md
```

### Process All Markdown Files in a Directory

```bash
npx ts-node --esm scripts/align-diagrams.ts path/to/directory/
```

### Process All Documentation Files

```bash
npx ts-node --esm scripts/align-diagrams.ts --all
```

This will process all `.md` files in the `Documentation/` directory.

## Features

- ✅ Detects ASCII box diagrams in markdown code blocks
- ✅ Identifies boxes that are side-by-side (in the same row)
- ✅ Makes all boxes in the same row have consistent widths
- ✅ Preserves box content and spacing
- ✅ Handles nested diagrams
- ✅ Works with different box-drawing character sets (─, ═, ━, etc.)
- ✅ Safe: only modifies diagrams, leaves other content unchanged

## How It Works

1. **Detects Code Blocks**: Finds all ` ```...``` ` code blocks in markdown files
2. **Identifies Boxes**: Looks for complete box structures with top border, bottom border, and vertical bars
3. **Groups Boxes**: Groups boxes that are side-by-side (same row)
4. **Calculates Max Width**: Finds the maximum width among boxes in the same row
5. **Aligns Boxes**: Adjusts all boxes to match the maximum width by:
   - Extending horizontal borders (top/bottom)
   - Moving vertical bars (left/right edges)
   - Preserving content spacing

## Examples

### Before

```
┌──────────┐    ┌─────────────────┐
│  Short   │    │  Much Longer    │
└──────────┘    └─────────────────┘
```

### After

```
┌─────────────────┐    ┌─────────────────┐
│  Short          │    │  Much Longer    │
└─────────────────┘    └─────────────────┘
```

## Limitations

- Only processes diagrams inside markdown code blocks (` ``` `)
- Only aligns boxes in the same horizontal row
- Requires complete box structures (top, bottom, left, right borders)
- May not handle extremely complex or irregular diagrams perfectly

## Development

The script is written in TypeScript and requires:

- Node.js
- TypeScript (`ts-node`)

Run with:

```bash
npx ts-node --esm scripts/align-diagrams.ts
```

## Testing

Test on a single file first to verify the alignment works as expected:

```bash
# Dry run to preview changes
npx ts-node --esm scripts/align-diagrams.ts --dry-run test-file.md

# Apply changes
npx ts-node --esm scripts/align-diagrams.ts test-file.md

# Check the result
git diff test-file.md
```

If the result looks good, process the entire directory:

```bash
npx ts-node --esm scripts/align-diagrams.ts --all
```
