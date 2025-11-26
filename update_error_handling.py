#!/usr/bin/env python3
"""
Automated refactoring script to replace createErrorResponse with handleRouteError
across all route files.
"""

import re
import sys
from pathlib import Path

# Base directory
BASE_DIR = Path("/Users/williamtower/projects/PriceCompare/.worktrees/standardize-error-handling/server/routes")

# Files to process
FILES_TO_UPDATE = [
    "admin-aggregation-routes.ts",
    "aggregation-metrics-routes.ts",
    "cache-routes.ts",
    "price-analytics-routes.ts",
    "advanced-search-routes.ts",
    "scraping-routes.ts",
    "community-routes.ts",
    "enhanced-forum-routes.ts",
    "discourse-routes.ts",
    "specification-routes.ts",
    "affiliate-routes.ts",
    "price-history-routes.ts",
    "wishlist-routes.ts",
]

def update_imports(content: str) -> str:
    """Update imports to use handleRouteError and notFound instead of createErrorResponse."""

    # Remove createErrorResponse import
    content = re.sub(
        r'import\s*{\s*createErrorResponse\s*}\s*from\s*["\']\.\.\/utils\/error-sanitizer["\']\s*;\s*\n',
        '',
        content
    )

    # Check if helpers import exists
    helpers_import_match = re.search(r'import\s*{([^}]+)}\s*from\s*["\']\.\/helpers["\']', content)

    if helpers_import_match:
        imports = helpers_import_match.group(1)
        imports_list = [i.strip() for i in imports.split(',')]

        # Add handleRouteError and notFound if not already there
        if 'handleRouteError' not in imports_list:
            imports_list.append('handleRouteError')
        if 'notFound' not in imports_list:
            imports_list.append('notFound')

        new_imports = ', '.join(imports_list)
        content = re.sub(
            r'import\s*{[^}]+}\s*from\s*["\']\.\/helpers["\']',
            f'import {{ {new_imports} }} from "./helpers"',
            content
        )
    else:
        # Add new helpers import after last import
        last_import_pos = 0
        for match in re.finditer(r'import\s+.*?;', content):
            last_import_pos = match.end()

        if last_import_pos > 0:
            content = content[:last_import_pos] + '\nimport { handleRouteError, notFound } from "./helpers";' + content[last_import_pos:]

    return content

def replace_error_patterns(content: str) -> tuple[str, int]:
    """Replace all createErrorResponse patterns with handleRouteError."""

    replacements = 0

    # Pattern 1: Full pattern with logger + createErrorResponse
    pattern1 = re.compile(
        r'logger\.error\([^;]+\);\s*\n\s*const errorResponse = createErrorResponse\(error,\s*["\']([^"\']+)["\']\);\s*\n\s*res\.status\(errorResponse\.status\)\.json\(\{\s*error:\s*errorResponse\.error\s*\}\);',
        re.MULTILINE
    )

    def replace1(match):
        nonlocal replacements
        replacements += 1
        op_name = match.group(1)
        return f'handleRouteError(res, error, \'{op_name}\');'

    content = pattern1.sub(replace1, content)

    # Pattern 2: createErrorResponse without logger
    pattern2 = re.compile(
        r'const errorResponse = createErrorResponse\(error,\s*["\']([^"\']+)["\']\);\s*\n\s*res\.status\(errorResponse\.status\)\.json\(\{\s*error:\s*errorResponse\.error\s*\}\);',
        re.MULTILINE
    )

    def replace2(match):
        nonlocal replacements
        replacements += 1
        op_name = match.group(1)
        return f'handleRouteError(res, error, \'{op_name}\');'

    content = pattern2.sub(replace2, content)

    # Pattern 3: createErrorResponse with custom response format (e.g., { success: false, error: ... })
    pattern3 = re.compile(
        r'const errorResponse = createErrorResponse\(error,\s*["\']([^"\']+)["\']\);\s*\n\s*res\.status\(errorResponse\.status\)\.json\(\{[^}]*error:\s*errorResponse\.error[^}]*\}\);',
        re.MULTILINE
    )

    def replace3(match):
        nonlocal replacements
        replacements += 1
        op_name = match.group(1)
        return f'handleRouteError(res, error, \'{op_name}\');'

    content = pattern3.sub(replace3, content)

    return content, replacements

def replace_404_patterns(content: str) -> tuple[str, int]:
    """Replace manual 404 patterns with notFound() helper."""

    replacements = 0

    # Pattern: res.status(404).json({ error: 'Resource not found' })
    pattern = re.compile(
        r'res\.status\(404\)\.json\(\{\s*error:\s*["\']([^"\']+)\s+not\s+found["\']\s*\}\);',
        re.IGNORECASE
    )

    def replace_404(match):
        nonlocal replacements
        replacements += 1
        resource = match.group(1)
        return f'notFound(res, \'{resource}\');'

    content = pattern.sub(replace_404, content)

    return content, replacements

def process_file(filepath: Path) -> dict:
    """Process a single file and return statistics."""

    print(f"Processing {filepath.name}...")

    try:
        content = filepath.read_text()
        original_content = content

        # Update imports
        content = update_imports(content)

        # Replace error patterns
        content, error_replacements = replace_error_patterns(content)

        # Replace 404 patterns
        content, notfound_replacements = replace_404_patterns(content)

        # Write back if changed
        if content != original_content:
            filepath.write_text(content)
            print(f"  ✓ Updated {filepath.name}")
            print(f"    - Error patterns replaced: {error_replacements}")
            print(f"    - 404 patterns replaced: {notfound_replacements}")
            return {
                'file': filepath.name,
                'success': True,
                'error_patterns': error_replacements,
                'notfound_patterns': notfound_replacements
            }
        else:
            print(f"  - No changes needed for {filepath.name}")
            return {
                'file': filepath.name,
                'success': True,
                'error_patterns': 0,
                'notfound_patterns': 0
            }

    except Exception as e:
        print(f"  ✗ Error processing {filepath.name}: {e}")
        return {
            'file': filepath.name,
            'success': False,
            'error': str(e)
        }

def main():
    """Main execution function."""

    print("=" * 60)
    print("Error Handling Refactoring Script")
    print("=" * 60)
    print()

    results = []

    for filename in FILES_TO_UPDATE:
        filepath = BASE_DIR / filename
        if not filepath.exists():
            print(f"Skipping {filename} (not found)")
            continue

        result = process_file(filepath)
        results.append(result)
        print()

    # Print summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)

    successful = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]

    total_error_patterns = sum(r.get('error_patterns', 0) for r in successful)
    total_404_patterns = sum(r.get('notfound_patterns', 0) for r in successful)

    print(f"Files processed: {len(successful)}/{len(results)}")
    print(f"Error patterns replaced: {total_error_patterns}")
    print(f"404 patterns replaced: {total_404_patterns}")

    if failed:
        print(f"\nFailed files: {len(failed)}")
        for r in failed:
            print(f"  - {r['file']}: {r.get('error', 'Unknown error')}")

    print()
    print("Done!")

if __name__ == "__main__":
    main()
