#!/bin/bash
#
# Install git hooks for PriceCompare development.
# Run this script once after cloning the repository.
#
# Usage: bash .github/hooks/install.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_HOOKS_DIR="$(git rev-parse --git-dir)/hooks"

echo "📦 Installing git hooks..."

# Copy pre-commit hook
if [ -f "$SCRIPT_DIR/pre-commit" ]; then
    cp "$SCRIPT_DIR/pre-commit" "$GIT_HOOKS_DIR/pre-commit"
    chmod +x "$GIT_HOOKS_DIR/pre-commit"
    echo "✅ Installed pre-commit hook"
else
    echo "⚠️  pre-commit hook not found at $SCRIPT_DIR/pre-commit"
fi

echo ""
echo "✅ Git hooks installed successfully!"
echo "   Hooks are now active in: $GIT_HOOKS_DIR"
